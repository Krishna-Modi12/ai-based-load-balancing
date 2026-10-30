from __future__ import annotations

import bisect
import hashlib
import math
import time
from dataclasses import dataclass
from enum import Enum
from typing import Protocol

from .models import BackendNode


class CircuitState(str, Enum):
    CLOSED = "CLOSED"         # Normal operation: node receiving full traffic
    OPEN = "OPEN"             # Tripped: node outlier ejected, fast-failing
    HALF_OPEN = "HALF_OPEN"   # Recovery probe: canary request evaluating recovery


@dataclass
class NodeBreakerStatus:
    backend_id: str
    state: CircuitState = CircuitState.CLOSED
    consecutive_failures: int = 0
    total_ejections: int = 0
    last_failure_time: float | None = None
    ejected_until: float | None = None
    latency_ewma_ms: float = 0.0


class CircuitBreakerManager:
    """Outlier ejection and circuit breaking for distributed worker nodes."""

    def __init__(
        self,
        failure_threshold: int = 3,
        slow_latency_threshold_ms: float = 85.0,
        cooldown_seconds: float = 15.0,
        alpha_ewma: float = 0.25,
    ) -> None:
        self.failure_threshold = failure_threshold
        self.slow_latency_threshold_ms = slow_latency_threshold_ms
        self.cooldown_seconds = cooldown_seconds
        self.alpha_ewma = alpha_ewma
        self.breakers: dict[str, NodeBreakerStatus] = {}

    def _get(self, backend_id: str) -> NodeBreakerStatus:
        if backend_id not in self.breakers:
            self.breakers[backend_id] = NodeBreakerStatus(backend_id=backend_id)
        return self.breakers[backend_id]

    def is_available(self, backend_id: str) -> bool:
        breaker = self._get(backend_id)
        now = time.time()
        if breaker.state == CircuitState.OPEN:
            if breaker.ejected_until and now >= breaker.ejected_until:
                breaker.state = CircuitState.HALF_OPEN
                return True
            return False
        return True

    def filter_healthy(self, candidates: list[BackendNode]) -> tuple[list[BackendNode], list[str]]:
        """Eject nodes in OPEN circuit state. If all nodes are OPEN, falls back to all candidates."""
        healthy = [b for b in candidates if self.is_available(b.id)]
        ejected = [b.id for b in candidates if not self.is_available(b.id)]
        if not healthy:
            return candidates, ejected
        return healthy, ejected

    def record_success(self, backend_id: str, latency_ms: float) -> None:
        breaker = self._get(backend_id)
        if breaker.state == CircuitState.HALF_OPEN:
            breaker.state = CircuitState.CLOSED
        breaker.consecutive_failures = 0
        if breaker.latency_ewma_ms <= 0.0:
            breaker.latency_ewma_ms = latency_ms
        else:
            breaker.latency_ewma_ms = (self.alpha_ewma * latency_ms) + ((1 - self.alpha_ewma) * breaker.latency_ewma_ms)

    def record_failure(self, backend_id: str, is_slow: bool = False, latency_ms: float = 0.0) -> None:
        breaker = self._get(backend_id)
        breaker.consecutive_failures += 1
        breaker.last_failure_time = time.time()
        if latency_ms > 0:
            breaker.latency_ewma_ms = latency_ms
        if breaker.consecutive_failures >= self.failure_threshold or (is_slow and breaker.consecutive_failures >= 2):
            breaker.state = CircuitState.OPEN
            breaker.total_ejections += 1
            breaker.ejected_until = time.time() + self.cooldown_seconds

    def inject_fault(self, backend_id: str, action: str) -> dict:
        breaker = self._get(backend_id)
        if action == "trip":
            breaker.state = CircuitState.OPEN
            breaker.total_ejections += 1
            breaker.consecutive_failures = self.failure_threshold
            breaker.ejected_until = time.time() + self.cooldown_seconds
        elif action == "reset":
            breaker.state = CircuitState.CLOSED
            breaker.consecutive_failures = 0
            breaker.ejected_until = None
        return self.get_status(backend_id)

    def get_status(self, backend_id: str) -> dict:
        breaker = self._get(backend_id)
        now = time.time()
        remaining_cooldown = max(0.0, (breaker.ejected_until - now)) if breaker.ejected_until and breaker.state == CircuitState.OPEN else 0.0
        return {
            "backend_id": backend_id,
            "state": breaker.state.value,
            "consecutive_failures": breaker.consecutive_failures,
            "total_ejections": breaker.total_ejections,
            "remaining_cooldown_seconds": round(remaining_cooldown, 1),
            "latency_ewma_ms": round(breaker.latency_ewma_ms, 2),
            "is_available": self.is_available(backend_id),
        }

    def get_all_statuses(self) -> dict[str, dict]:
        return {bid: self.get_status(bid) for bid in self.breakers}


class ConsistentHashRing:
    """Consistent hash ring using 32-bit MD5 tokens and virtual node replicas."""

    def __init__(self, candidates: list[BackendNode], replicas_per_weight: int = 50) -> None:
        self.ring: list[tuple[int, BackendNode]] = []
        for b in candidates:
            raw_w = b.capacity_weight if b.capacity_weight is not None else 1.0
            weight = max(1, int(round(raw_w)))
            total_replicas = weight * replicas_per_weight
            for r in range(total_replicas):
                token = f"{b.id}:{b.name}:{r}".encode("utf-8")
                val = int(hashlib.md5(token).hexdigest(), 16) & 0xFFFFFFFF
                self.ring.append((val, b))
        self.ring.sort(key=lambda item: item[0])

    def get_node(self, key: str) -> BackendNode | None:
        if not self.ring:
            return None
        key_hash = int(hashlib.md5(key.encode("utf-8")).hexdigest(), 16) & 0xFFFFFFFF
        keys = [item[0] for item in self.ring]
        idx = bisect.bisect_right(keys, key_hash)
        if idx >= len(self.ring):
            idx = 0
        return self.ring[idx][1]


@dataclass
class SelectedRoute:
    backend: BackendNode
    policy: str
    predicted_latency_ms: float | None = None
    fallback_reason: str | None = None
    model_version_id: str | None = None


class Predictor(Protocol):
    version_id: str | None
    def predict(self, features: list[float]) -> float: ...


class Router:
    def __init__(self) -> None:
        self._cursor = 0
        self.inflight: dict[str, int] = {}
        self.circuit_breaker = CircuitBreakerManager()

    def select_round_robin(self, candidates: list[BackendNode]) -> SelectedRoute:
        backend = candidates[self._cursor % len(candidates)]
        self._cursor += 1
        return SelectedRoute(backend, "round_robin")

    def select_weighted_round_robin(self, candidates: list[BackendNode]) -> SelectedRoute:
        flat_cycle: list[BackendNode] = []
        for b in candidates:
            w = max(1, int(round(b.capacity_weight)))
            flat_cycle.extend([b] * w)
        if not flat_cycle:
            return self.select_round_robin(candidates)
        backend = flat_cycle[self._cursor % len(flat_cycle)]
        self._cursor += 1
        return SelectedRoute(backend, "weighted_round_robin")

    def select_least_connections(self, candidates: list[BackendNode]) -> SelectedRoute:
        backend = min(candidates, key=lambda b: (self.inflight.get(b.id, 0), b.name))
        return SelectedRoute(backend, "least_connections")

    def select_consistent_hash(self, candidates: list[BackendNode], key: str = "default-session") -> SelectedRoute:
        if not candidates:
            raise ValueError("No candidates available for consistent hashing")
        ring = ConsistentHashRing(candidates)
        backend = ring.get_node(key) or candidates[0]
        return SelectedRoute(backend, "consistent_hash")

    def select_ai(self, candidates: list[BackendNode], feature_rows: dict[str, list[float]], predictor: Predictor | None) -> SelectedRoute:
        if predictor is None:
            result = self.select_least_connections(candidates)
            result.policy = "ai_latency"
            result.fallback_reason = "MODEL_UNAVAILABLE"
            return result
        try:
            scored = [(float(predictor.predict(feature_rows[b.id])), b) for b in candidates]
            if any(not math.isfinite(value) or value < 0 or value > 120_000 for value, _ in scored):
                raise ValueError("invalid prediction")
            prediction, backend = min(scored, key=lambda item: (item[0], item[1].name))
            return SelectedRoute(backend, "ai_latency", prediction, model_version_id=predictor.version_id)
        except Exception:
            result = self.select_least_connections(candidates)
            result.policy = "ai_latency"
            result.fallback_reason = "MODEL_INFERENCE_FAILED"
            return result
