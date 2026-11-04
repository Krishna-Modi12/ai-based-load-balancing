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


class ContextualBanditRouter:
    """
    Online Reinforcement Learning using Upper Confidence Bound (UCB1).
    Balances exploration of uncertain workers with exploitation of fast workers.
    """

    def __init__(self, c: float = 1.414) -> None:
        self.c = c
        self.pulls: dict[str, int] = {}
        self.total_pulls: int = 0
        self.total_reward: dict[str, float] = {}
        self.avg_reward: dict[str, float] = {}
        self.last_latency: dict[str, float] = {}

    def select(self, candidates: list[BackendNode]) -> SelectedRoute:
        self.total_pulls += 1
        # Warmup: try each candidate arm at least once
        for b in candidates:
            if self.pulls.get(b.id, 0) == 0:
                return SelectedRoute(b, "contextual_bandit", predicted_latency_ms=self.last_latency.get(b.id, 25.0))

        # UCB1 scoring: avg_reward + c * sqrt(ln(t) / n_i)
        best_score = -float("inf")
        best_node = candidates[0]
        for b in candidates:
            n_i = max(1, self.pulls.get(b.id, 1))
            mu_i = self.avg_reward.get(b.id, 1.0)
            bonus = self.c * math.sqrt(math.log(max(1, self.total_pulls)) / n_i)
            score = mu_i + bonus
            if score > best_score:
                best_score = score
                best_node = b

        return SelectedRoute(best_node, "contextual_bandit", predicted_latency_ms=self.last_latency.get(best_node.id, 25.0))

    def record_feedback(self, backend_id: str, latency_ms: float) -> None:
        # Inverse latency reward: 100 / max(1.0, latency_ms)
        reward = 100.0 / max(1.0, latency_ms)
        self.pulls[backend_id] = self.pulls.get(backend_id, 0) + 1
        self.total_reward[backend_id] = self.total_reward.get(backend_id, 0.0) + reward
        self.avg_reward[backend_id] = self.total_reward[backend_id] / self.pulls[backend_id]
        self.last_latency[backend_id] = latency_ms

    def get_stats(self) -> dict:
        return {
            "total_pulls": self.total_pulls,
            "arms": {
                bid: {
                    "pulls": self.pulls.get(bid, 0),
                    "avg_reward": round(self.avg_reward.get(bid, 0.0), 3),
                    "last_latency_ms": round(self.last_latency.get(bid, 0.0), 2),
                }
                for bid in self.pulls
            },
        }


class DynamicWorkerDelayManager:
    """Dynamic latency override registry for live chaos & hardware delay tuning."""

    def __init__(self) -> None:
        self.delays: dict[str, float] = {}

    def set_delay(self, name_or_id: str, delay_ms: float) -> None:
        self.delays[name_or_id] = max(0.0, delay_ms)

    def get_delay(self, name_or_id: str, default_ms: float = 0.0) -> float:
        return self.delays.get(name_or_id, default_ms)

    def reset(self, name_or_id: str | None = None) -> None:
        if name_or_id:
            self.delays.pop(name_or_id, None)
        else:
            self.delays.clear()

    def get_all(self) -> dict[str, float]:
        return dict(self.delays)


class TokenBucketRateLimiter:
    """RFC 6585 Token Bucket rate limiter with configurable capacity and refill rate."""

    def __init__(self, capacity: int = 60, refill_rate_per_sec: float = 20.0, enabled: bool = False) -> None:
        self.capacity = capacity
        self.refill_rate = refill_rate_per_sec
        self.tokens = float(capacity)
        self.last_refill = time.time()
        self.enabled = enabled

    def configure(self, enabled: bool, capacity: int, refill_rate: float) -> None:
        self.enabled = enabled
        self.capacity = capacity
        self.refill_rate = refill_rate
        self.tokens = min(self.tokens, float(capacity))

    def allow_request(self) -> tuple[bool, float, int]:
        if not self.enabled:
            return True, 0.0, int(self.capacity)
        now = time.time()
        delta = now - self.last_refill
        self.tokens = min(float(self.capacity), self.tokens + delta * self.refill_rate)
        self.last_refill = now

        if self.tokens >= 1.0:
            self.tokens -= 1.0
            return True, 0.0, int(self.tokens)
        else:
            retry_after = (1.0 - self.tokens) / max(0.1, self.refill_rate)
            return False, round(retry_after, 2), 0

    def get_status(self) -> dict:
        now = time.time()
        delta = now - self.last_refill
        cur_tokens = min(float(self.capacity), self.tokens + delta * self.refill_rate)
        return {
            "enabled": self.enabled,
            "capacity": self.capacity,
            "refill_rate_per_sec": self.refill_rate,
            "tokens_remaining": round(cur_tokens, 1),
        }


class CanaryDeployer:
    """Canary traffic splitting between baseline and candidate routing policies."""

    def __init__(self) -> None:
        import random
        self.enabled = False
        self.baseline_policy = "least_connections"
        self.canary_policy = "ai_latency"
        self.canary_percentage = 20.0

    def configure(
        self,
        enabled: bool,
        baseline_policy: str | None = None,
        canary_policy: str | None = None,
        canary_percentage: float | None = None,
        baseline: str | None = None,
        canary: str | None = None,
        percentage: float | None = None,
    ) -> None:
        self.enabled = enabled
        if baseline_policy is not None:
            self.baseline_policy = baseline_policy
        elif baseline is not None:
            self.baseline_policy = baseline

        if canary_policy is not None:
            self.canary_policy = canary_policy
        elif canary is not None:
            self.canary_policy = canary

        pct = canary_percentage if canary_percentage is not None else percentage
        if pct is not None:
            self.canary_percentage = max(0.0, min(100.0, pct))

    def resolve_policy(self, active_policy: str) -> tuple[str, bool]:
        if not self.enabled:
            return active_policy, False
        import random
        roll = random.uniform(0, 100)
        if roll < self.canary_percentage:
            return self.canary_policy, True
        return self.baseline_policy, False

    def get_status(self) -> dict:
        return {
            "enabled": self.enabled,
            "baseline_policy": self.baseline_policy,
            "canary_policy": self.canary_policy,
            "canary_percentage": self.canary_percentage,
        }


class Router:
    def __init__(self) -> None:
        self._cursor = 0
        self.inflight: dict[str, int] = {}
        self.circuit_breaker = CircuitBreakerManager()
        self.bandit = ContextualBanditRouter()
        self.delays = DynamicWorkerDelayManager()
        self.rate_limiter = TokenBucketRateLimiter()
        self.canary = CanaryDeployer()

    def select_contextual_bandit(self, candidates: list[BackendNode]) -> SelectedRoute:
        return self.bandit.select(candidates)

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
