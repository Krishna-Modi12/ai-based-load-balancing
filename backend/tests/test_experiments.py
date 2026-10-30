from app.experiments import aggregate_samples, percentile
from app.main import app
from fastapi.testclient import TestClient


def test_percentiles_and_aggregate_keep_ai_metrics_separate():
    assert percentile([1, 2, 3, 4], 0.95) == 4
    samples = [
        {
            "success": True, "timeout": False, "backend": "worker-a",
            "client_latency_ms": 20, "upstream_latency_ms": 15,
            "predicted_latency_ms": 18, "ai_inference_latency_ms": 0.4,
        },
        {
            "success": False, "timeout": True, "error_type": "ReadTimeout",
            "backend": "worker-b", "client_latency_ms": 100,
            "upstream_latency_ms": None, "predicted_latency_ms": None,
            "ai_inference_latency_ms": 0.5,
        },
    ]
    result = aggregate_samples(samples, 10)
    assert result["request_count"] == 2
    assert result["success_count"] == 1
    assert result["timeout_count"] == 1
    assert result["throughput_rps"] == 0.1
    assert result["latency_p95_ms"] == 100
    assert result["ai_prediction_mae_ms"] == 3
    assert result["ai_inference_p50_ms"] == 0.4


def test_experiment_create_list_and_raw_exports():
    payload = {
        "name": "validation-run",
        "policy": "round_robin",
        "workload_profile": "uniform",
        "repetition": 1,
        "duration_seconds": 1,
        "warmup_seconds": 0,
        "concurrency": 1,
        "seed": 7,
    }
    with TestClient(app) as client:
        created = client.post("/api/v1/experiments", json=payload, headers={"X-Admin-Token": "change-me"})
        assert created.status_code == 201
        experiment_id = created.json()["id"]
        listed = client.get("/api/v1/experiments")
        assert listed.status_code == 200
        assert listed.json()[0]["id"] == experiment_id
        detail = client.get(f"/api/v1/experiments/{experiment_id}/results")
        assert detail.status_code == 200
        exported_json = client.get(f"/api/v1/experiments/{experiment_id}/export?format=json")
        exported_csv = client.get(f"/api/v1/experiments/{experiment_id}/export?format=csv")
    assert exported_json.status_code == 200
    assert exported_json.json()["raw_samples"] == []
    assert exported_csv.status_code == 200
    assert "Content-Disposition" in exported_csv.headers


def test_experiment_validation_rejects_unbounded_configuration():
    with TestClient(app) as client:
        response = client.post("/api/v1/experiments", json={
            "name": "invalid",
            "policy": "round_robin",
            "workload_profile": "uniform",
            "duration_seconds": 100000,
        }, headers={"X-Admin-Token": "change-me"})
    assert response.status_code == 422
