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


def test_contextual_bandit_learning_and_reward():
    node_fast = BackendNode(id="fast", name="fast-node", base_url="http://fast.local", capacity_weight=1.0)
    node_slow = BackendNode(id="slow", name="slow-node", base_url="http://slow.local", capacity_weight=1.0)
    candidates = [node_fast, node_slow]

    router = Router()

    # Initial warm-up pulls
    r1 = router.select_contextual_bandit(candidates)
    router.bandit.record_feedback(r1.backend.id, latency_ms=15.0 if r1.backend.id == "fast" else 80.0)

    r2 = router.select_contextual_bandit(candidates)
    router.bandit.record_feedback(r2.backend.id, latency_ms=15.0 if r2.backend.id == "fast" else 80.0)

    # Train bandit with 20 feedbacks: fast node gets 15ms (~6.6 reward), slow node gets 80ms (~1.25 reward)
    for _ in range(20):
        route = router.select_contextual_bandit(candidates)
        lat = 15.0 if route.backend.id == "fast" else 80.0
        router.bandit.record_feedback(route.backend.id, lat)

    stats = router.bandit.get_stats()
    assert stats["total_pulls"] > 20
    # Fast node should accumulate significantly higher average reward than slow node
    assert stats["arms"]["fast"]["avg_reward"] > stats["arms"]["slow"]["avg_reward"]


def test_token_bucket_rate_limiter():
    from app.routing import TokenBucketRateLimiter
    rl = TokenBucketRateLimiter(capacity=3, refill_rate_per_sec=1.0, enabled=True)

    # 3 allowed requests
    allow1, _, rem1 = rl.allow_request()
    allow2, _, rem2 = rl.allow_request()
    allow3, _, rem3 = rl.allow_request()
    assert allow1 and allow2 and allow3
    assert rem3 == 0

    # 4th request must be rejected
    allow4, retry_after, rem4 = rl.allow_request()
    assert not allow4
    assert retry_after > 0.0


def test_dynamic_worker_delay_manager():
    from app.routing import DynamicWorkerDelayManager
    mgr = DynamicWorkerDelayManager()
    assert mgr.get_delay("worker-a") == 0.0

    mgr.set_delay("worker-a", 45.0)
    assert mgr.get_delay("worker-a") == 45.0
    assert mgr.get_all() == {"worker-a": 45.0}

    mgr.reset("worker-a")
    assert mgr.get_delay("worker-a") == 0.0


def test_canary_deployer_traffic_resolution():
    from app.routing import CanaryDeployer
    canary = CanaryDeployer()
    assert canary.resolve_policy("least_connections") == ("least_connections", False)

    # Enable 100% canary to ai_latency
    canary.configure(enabled=True, baseline="least_connections", canary_policy="ai_latency", percentage=100.0)
    pol, is_canary = canary.resolve_policy("least_connections")
    assert pol == "ai_latency"
    assert is_canary is True

