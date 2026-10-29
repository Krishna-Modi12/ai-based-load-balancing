from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Protocol

from .models import BackendNode


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

    def select_round_robin(self, candidates: list[BackendNode]) -> SelectedRoute:
        backend = candidates[self._cursor % len(candidates)]
        self._cursor += 1
        return SelectedRoute(backend, "round_robin")

    def select_least_connections(self, candidates: list[BackendNode]) -> SelectedRoute:
        backend = min(candidates, key=lambda b: (self.inflight.get(b.id, 0), b.name))
        return SelectedRoute(backend, "least_connections")

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
