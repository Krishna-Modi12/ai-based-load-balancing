from app.models import BackendNode
from app.routing import Router


def nodes():
    return [BackendNode(id="a", name="a", base_url="http://a"), BackendNode(id="b", name="b", base_url="http://b")]


def test_round_robin_cycles_in_stable_order():
    routing = Router(); candidates = nodes()
    assert [routing.select_round_robin(candidates).backend.name for _ in range(4)] == ["a", "b", "a", "b"]


def test_weighted_round_robin_respects_capacity_weights():
    routing = Router()
    candidates = [
        BackendNode(id="a", name="a", base_url="http://a", capacity_weight=2.0),
        BackendNode(id="b", name="b", base_url="http://b", capacity_weight=1.0),
    ]
    assert [routing.select_weighted_round_robin(candidates).backend.name for _ in range(6)] == [
        "a", "a", "b", "a", "a", "b"
    ]


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


def test_consistent_hash_is_deterministic_for_same_key():
    routing = Router()
    candidates = nodes()
    route1 = routing.select_consistent_hash(candidates, key="user-session-1234")
    route2 = routing.select_consistent_hash(candidates, key="user-session-1234")
    assert route1.backend.name == route2.backend.name
    assert route1.policy == "consistent_hash"


def test_consistent_hash_distributes_across_ring():
    routing = Router()
    candidates = [
        BackendNode(id="a", name="a", base_url="http://a", capacity_weight=1.0),
        BackendNode(id="b", name="b", base_url="http://b", capacity_weight=1.0),
        BackendNode(id="c", name="c", base_url="http://c", capacity_weight=1.0),
    ]
    seen_backends = {
        routing.select_consistent_hash(candidates, key=f"session-key-{i}").backend.name
        for i in range(100)
    }
    # All 3 nodes should receive traffic across 100 distinct session keys
    assert seen_backends == {"a", "b", "c"}


def test_circuit_breaker_trips_and_ejects_outlier():
    routing = Router()
    candidates = nodes()
    cb = routing.circuit_breaker

    # Record 3 failures on node a
    for _ in range(3):
        cb.record_failure("a", is_slow=False)

    status_a = cb.get_status("a")
    assert status_a["state"] == "OPEN"
    assert status_a["consecutive_failures"] == 3
    assert status_a["total_ejections"] == 1
    assert not cb.is_available("a")

    healthy, ejected = cb.filter_healthy(candidates)
    assert [b.name for b in healthy] == ["b"]
    assert ejected == ["a"]


def test_circuit_breaker_total_blackout_fallback():
    routing = Router()
    candidates = nodes()
    cb = routing.circuit_breaker

    # Trip both nodes
    cb.record_failure("a")
    cb.record_failure("a")
    cb.record_failure("a")
    cb.record_failure("b")
    cb.record_failure("b")
    cb.record_failure("b")

    # When all nodes are open, filter_healthy falls back to all candidates to prevent hard drop
    healthy, ejected = cb.filter_healthy(candidates)
    assert len(healthy) == 2
    assert set(ejected) == {"a", "b"}


def test_circuit_breaker_recovery_flow():
    routing = Router()
    cb = routing.circuit_breaker
    cb.cooldown_seconds = 0.05  # Short cooldown for test

    cb.record_failure("a")
    cb.record_failure("a")
    cb.record_failure("a")
    assert cb.get_status("a")["state"] == "OPEN"

    import time
    time.sleep(0.06)

    # After cooldown, probe should be allowed (transitions to HALF_OPEN)
    assert cb.is_available("a")
    assert cb.get_status("a")["state"] == "HALF_OPEN"

    # Canary success resets breaker to CLOSED
    cb.record_success("a", latency_ms=15.0)
    assert cb.get_status("a")["state"] == "CLOSED"
    assert cb.get_status("a")["consecutive_failures"] == 0


def test_circuit_breaker_chaos_injection():
    routing = Router()
    cb = routing.circuit_breaker

    res = cb.inject_fault("a", "trip")
    assert res["state"] == "OPEN"
    assert not cb.is_available("a")

    res = cb.inject_fault("a", "reset")
    assert res["state"] == "CLOSED"
    assert cb.is_available("a")

