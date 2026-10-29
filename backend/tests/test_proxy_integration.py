from datetime import datetime, timedelta, timezone

import httpx
from fastapi.testclient import TestClient
from sqlalchemy import select

from app import main
from app.config import Settings
from app.database import SessionLocal
from app.ml import FEATURE_NAMES, load_active_predictor, train_model
from app.models import BackendNode, RoutingDecision, TelemetrySample
from app.routing import Router
from app.services import eligible_backends


class WorkerTransport:
    """In-process worker protocol double; no external network is claimed here."""
    last_headers: list[dict[str, str]] = []
    demo_status = 200
    demo_exception: Exception | None = None

    async def __aenter__(self): return self
    async def __aexit__(self, *_): return False

    async def get(self, url, **kwargs):
        headers = kwargs.get("headers", {})
        self.last_headers.append(headers)
        request = httpx.Request("GET", url)
        if url.endswith("/health"):
            return httpx.Response(200, request=request, json={"status": "healthy"})
        if url.endswith("/metrics"):
            return httpx.Response(200, request=request, json={"cpu_percent": 10, "memory_percent": 20, "active_requests": 0, "latency_ewma_ms": 12, "error_rate": 0, "success_rate": 1, "simulated": True})
        if self.demo_exception:
            raise self.demo_exception
        return httpx.Response(self.demo_status, request=request, json={"worker": url.split("//", 1)[1].split("/", 1)[0]})


def add_nodes():
    with SessionLocal() as db:
        db.add_all([BackendNode(name="alpha", base_url="http://alpha"), BackendNode(name="bravo", base_url="http://bravo")])
        db.commit()


def healthy_client(monkeypatch):
    monkeypatch.setattr(main.httpx, "AsyncClient", lambda **_: WorkerTransport())
    main.router = Router()
    main.active_policy = "round_robin"
    WorkerTransport.demo_status = 200
    WorkerTransport.demo_exception = None
    WorkerTransport.last_headers = []
    add_nodes()
    client = TestClient(main.app)
    headers = {"X-Admin-Token": "change-me"}
    assert client.post("/api/v1/backends/health-check-all", headers=headers).json() == {"checked": 2, "healthy": 2}
    return client, headers


def test_proxy_round_robin_forwards_and_persists_decisions(monkeypatch):
    client, _ = healthy_client(monkeypatch)
    with client:
        first, second = client.get("/api/v1/route"), client.get("/api/v1/route")
    assert [first.json()["backend"], second.json()["backend"]] == ["alpha", "bravo"]
    assert first.json()["request_id"]
    forwarded = [headers for headers in WorkerTransport.last_headers if "X-Request-ID" in headers]
    assert forwarded[0]["X-Request-ID"] == first.json()["request_id"]
    with SessionLocal() as db:
        saved = list(db.scalars(select(RoutingDecision).order_by(RoutingDecision.decided_at)))
    assert len(saved) == 2
    assert all(row.success and row.actual_latency_ms is not None for row in saved)


def test_least_connections_and_unavailable_ai_model_are_safe(monkeypatch):
    client, headers = healthy_client(monkeypatch)
    with client:
        assert client.post("/api/v1/policies", headers=headers, json={"policy": "least_connections"}).status_code == 200
        assert client.get("/api/v1/route").json()["policy"] == "least_connections"
        client.post("/api/v1/policies", headers=headers, json={"policy": "ai_latency"})
        response = client.get("/api/v1/route").json()
    assert response["policy"] == "ai_latency"
    assert response["fallback_reason"] == "MODEL_UNAVAILABLE"


def test_disabled_backend_is_not_a_proxy_candidate(monkeypatch):
    client, headers = healthy_client(monkeypatch)
    with SessionLocal() as db:
        bravo = db.scalar(select(BackendNode).where(BackendNode.name == "bravo"))
        bravo_id = bravo.id
    with client:
        assert client.patch(f"/api/v1/backends/{bravo_id}", headers=headers, json={"enabled": False}).status_code == 200
        result = client.get("/api/v1/route").json()
    assert result["backend"] == "alpha"


def test_upstream_http_error_is_recorded_and_mapped(monkeypatch):
    client, _ = healthy_client(monkeypatch)
    WorkerTransport.demo_status = 503
    with client:
        response = client.get("/api/v1/route")
    assert response.status_code == 502
    with SessionLocal() as db:
        decision = db.scalar(select(RoutingDecision))
    assert decision.success is False
    assert decision.failure_type == "HTTPStatusError"


def test_upstream_timeout_is_recorded_and_mapped(monkeypatch):
    client, _ = healthy_client(monkeypatch)
    WorkerTransport.demo_exception = httpx.ReadTimeout("simulated deadline exceeded")
    with client:
        response = client.get("/api/v1/route")
    assert response.status_code == 502
    with SessionLocal() as db:
        decision = db.scalar(select(RoutingDecision))
    assert decision.success is False
    assert decision.failure_type == "ReadTimeout"


def test_stale_telemetry_excludes_backend():
    with SessionLocal() as db:
        node = BackendNode(name="stale", base_url="http://stale", health_status="healthy")
        db.add(node); db.commit()
        db.add(TelemetrySample(backend_id=node.id, sampled_at=datetime.now(timezone.utc) - timedelta(minutes=2)))
        db.commit()
        assert eligible_backends(db, Settings(telemetry_stale_seconds=30)) == []


def test_model_training_and_feature_schema_load(tmp_path):
    with SessionLocal() as db:
        node = BackendNode(name="training", base_url="http://training", health_status="healthy")
        db.add(node); db.commit()
        for index in range(25):
            db.add(RoutingDecision(request_id=f"00000000-0000-0000-0000-{index:012d}", policy="round_robin", selected_backend_id=node.id, success=True, actual_latency_ms=float(10 + index), features_json={name: float(index) for name in FEATURE_NAMES}))
        db.commit()
        model = train_model(db, Settings(model_dir=str(tmp_path)))
        predictor = load_active_predictor(db)
    assert model.training_sample_count == 25
    assert predictor is not None
    assert predictor.predict([1.0] * len(FEATURE_NAMES)) >= 0
