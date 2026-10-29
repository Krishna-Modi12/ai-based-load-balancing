from app.models import BackendNode
from app.routing import Router


def nodes():
    return [BackendNode(id="a", name="a", base_url="http://a"), BackendNode(id="b", name="b", base_url="http://b")]


def test_round_robin_cycles_in_stable_order():
    routing = Router(); candidates = nodes()
    assert [routing.select_round_robin(candidates).backend.name for _ in range(4)] == ["a", "b", "a", "b"]


def test_least_connections_uses_name_as_deterministic_tie_breaker():
    routing = Router(); candidates = nodes(); routing.inflight = {"a": 3, "b": 1}
    assert routing.select_least_connections(candidates).backend.name == "b"


def test_ai_invalid_prediction_uses_safe_fallback():
    class BadPredictor:
        version_id = "x"
        def predict(self, _): return float("nan")
    route = Router().select_ai(nodes(), {"a": [0] * 8, "b": [0] * 8}, BadPredictor())
    assert route.backend.name == "a"
    assert route.fallback_reason == "MODEL_INFERENCE_FAILED"


def test_missing_ai_model_uses_safe_fallback():
    route = Router().select_ai(nodes(), {"a": [0] * 8, "b": [0] * 8}, None)
    assert route.policy == "ai_latency"
    assert route.fallback_reason == "MODEL_UNAVAILABLE"
