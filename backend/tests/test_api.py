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
