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
