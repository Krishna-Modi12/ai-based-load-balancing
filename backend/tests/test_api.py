from fastapi.testclient import TestClient

from app.main import app


def test_liveness_and_readiness():
    with TestClient(app) as client:
        assert client.get("/health/live").json() == {"status": "alive"}
        assert client.get("/health/ready").status_code == 200


def test_backend_mutation_requires_token():
    with TestClient(app) as client:
        response = client.post("/api/v1/backends", json={"name": "blocked", "base_url": "http://blocked.test", "capacity_weight": 1})
    assert response.status_code == 401


def test_policy_change_is_protected():
    with TestClient(app) as client:
        denied = client.post("/api/v1/policies", json={"policy": "least_connections"})
        allowed = client.post("/api/v1/policies", json={"policy": "least_connections"}, headers={"X-Admin-Token": "change-me"})
    assert denied.status_code == 401
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


def test_chaos_injection_api_protection_and_execution():
    with TestClient(app) as client:
        # 1. Unauthenticated request rejected
        denied = client.post("/api/v1/system/chaos/inject", json={"backend_id": "test", "action": "trip"})
        assert denied.status_code == 401

        # 2. Get real backend
        cbs = client.get("/api/v1/system/circuit-breakers").json()
        if cbs:
            bid = cbs[0]["backend_id"]
            tripped = client.post(
                "/api/v1/system/chaos/inject",
                json={"backend_id": bid, "action": "trip"},
                headers={"X-Admin-Token": "change-me"}
            )
            assert tripped.status_code == 200
            assert tripped.json()["circuit_breaker"]["state"] == "OPEN"

            # Reset back
            reset = client.post(
                "/api/v1/system/chaos/inject",
                json={"backend_id": bid, "action": "reset"},
                headers={"X-Admin-Token": "change-me"}
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

