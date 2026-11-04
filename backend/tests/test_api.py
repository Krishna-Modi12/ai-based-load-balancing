from fastapi.testclient import TestClient

from app.main import app


def test_liveness_and_readiness():
    with TestClient(app) as client:
        assert client.get("/health/live").json() == {"status": "alive"}
        assert client.get("/health/ready").status_code == 200


def test_backend_mutation_works_without_token():
    with TestClient(app) as client:
        response = client.post("/api/v1/backends", json={"name": "open-test-node", "base_url": "http://open.test", "capacity_weight": 1})
    assert response.status_code == 200


def test_policy_change_allowed_without_token():
    with TestClient(app) as client:
        allowed = client.post("/api/v1/policies", json={"policy": "least_connections"})
    assert allowed.status_code == 200
    assert allowed.json() == {"policy": "least_connections"}


def test_routing_contract_alias_and_error_correlation():
    with TestClient(app) as client:
        mode = client.get("/api/v1/routing/mode")
        assert mode.status_code == 200
        response = client.get("/api/v1/route", headers={"X-Request-ID": "phase11-request"})
    assert response.status_code in {200, 503}
    if response.status_code == 503:
        assert response.json()["error"]["code"] == "NO_HEALTHY_BACKENDS"
        assert response.json()["error"]["request_id"] == "phase11-request"


def test_policy_update_supports_consistent_hash():
    with TestClient(app) as client:
        resp = client.put("/api/v1/routing/mode", json={"policy": "consistent_hash"}, headers={"X-Admin-Token": "change-me"})
        assert resp.status_code == 200
        assert resp.json()["policy"] == "consistent_hash"
        # Reset to round_robin
        client.put("/api/v1/routing/mode", json={"policy": "round_robin"}, headers={"X-Admin-Token": "change-me"})


def test_circuit_breakers_api_endpoint():
    with TestClient(app) as client:
        resp = client.get("/api/v1/system/circuit-breakers")
        assert resp.status_code == 200
        items = resp.json()
        assert isinstance(items, list)
        for item in items:
            assert "backend_id" in item
            assert item["state"] in {"CLOSED", "OPEN", "HALF_OPEN"}
            assert "is_available" in item


def test_chaos_injection_api_execution():
    with TestClient(app) as client:
        # Get real backend
        cbs = client.get("/api/v1/system/circuit-breakers").json()
        if cbs:
            bid = cbs[0]["backend_id"]
            tripped = client.post(
                "/api/v1/system/chaos/inject",
                json={"backend_id": bid, "action": "trip"},
            )
            assert tripped.status_code == 200
            assert tripped.json()["circuit_breaker"]["state"] == "OPEN"

            # Reset back
            reset = client.post(
                "/api/v1/system/chaos/inject",
                json={"backend_id": bid, "action": "reset"},
            )
            assert reset.status_code == 200
            assert reset.json()["circuit_breaker"]["state"] == "CLOSED"


def test_model_tournament_endpoint():
    with TestClient(app) as client:
        resp = client.get("/api/v1/models/tournament")
        assert resp.status_code == 200
        data = resp.json()
        assert "models" in data
        assert len(data["models"]) == 3
        algos = {m["algorithm_name"] for m in data["models"]}
        assert "RandomForestRegressor" in algos
        assert "HistGradientBoostingRegressor" in algos
        assert "Ridge" in algos


def test_prometheus_metrics_endpoint():
    with TestClient(app) as client:
        resp = client.get("/metrics")
        assert resp.status_code == 200
        text = resp.text
        assert "http_requests_total" in text
        assert "circuit_breaker_state" in text
        assert "rate_limit_tokens_available" in text


def test_bandit_arms_api():
    with TestClient(app) as client:
        resp = client.get("/api/v1/system/bandit/arms")
        assert resp.status_code == 200
        data = resp.json()
        assert "total_pulls" in data
        assert "arms" in data


def test_worker_delay_api():
    with TestClient(app) as client:
        resp = client.post("/api/v1/system/workers/delay", json={"worker_name": "worker-a", "delay_ms": 50.0})
        assert resp.status_code == 200
        assert resp.json()["delays"]["worker-a"] == 50.0

        # Reset
        reset = client.post("/api/v1/system/workers/delay/reset")
        assert reset.status_code == 200
        assert reset.json()["delays"] == {}


def test_rate_limiter_api():
    with TestClient(app) as client:
        status = client.get("/api/v1/system/ratelimit")
        assert status.status_code == 200
        assert "tokens_remaining" in status.json()

        # Configure
        conf = client.post("/api/v1/system/ratelimit", json={"enabled": False, "capacity": 100, "refill_rate": 50.0})
        assert conf.status_code == 200
        assert conf.json()["capacity"] == 100


def test_canary_deployment_api():
    with TestClient(app) as client:
        status = client.get("/api/v1/system/canary")
        assert status.status_code == 200
        assert "canary_percentage" in status.json()

        conf = client.post(
            "/api/v1/system/canary",
            json={"enabled": True, "baseline_policy": "least_connections", "canary_policy": "ai_latency", "canary_percentage": 25.0}
        )
        assert conf.status_code == 200
        assert conf.json()["enabled"] is True
        assert conf.json()["canary_percentage"] == 25.0

        # Disable canary
        client.post(
            "/api/v1/system/canary",
            json={"enabled": False, "baseline_policy": "least_connections", "canary_policy": "ai_latency", "canary_percentage": 0.0}
        )


def test_waterfall_trace_in_routing():
    with TestClient(app) as client:
        resp = client.get("/api/v1/route")
        if resp.status_code == 200:
            data = resp.json()
            assert "waterfall" in data
            wf = data["waterfall"]
            assert "trace_id" in wf
            assert "proxy_ingress_ms" in wf
            assert "selection_ms" in wf
            assert "upstream_http_ms" in wf
            assert "db_persistence_ms" in wf
            assert "total_roundtrip_ms" in wf

