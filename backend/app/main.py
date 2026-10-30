from __future__ import annotations

import time
import uuid
import threading
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor
import csv
import io
import json

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import get_settings
from .database import SessionLocal, get_db
from .ml import load_active_predictor, train_model
from .experiments import CANCEL_EVENTS, run_experiment_in_thread
from .models import BackendNode, ExperimentMetric, ExperimentRun, ModelVersion, RoutingDecision, RoutingPolicy, TelemetrySample
from .routing import Router
from .schemas import (
    BackendCreate, BackendDetail, BackendOut, BackendPatch, DecisionOut, ExperimentConfig,
    ExperimentDetail, ExperimentListItem, ExperimentOut, ExperimentMetricOut, ModelVersionOut,
    PolicyOut, PolicyUpdate,
)
from .services import collect_health, eligible_backends, feature_vector, latest_features

settings = get_settings()
router = Router()
active_policy = "round_robin"
experiment_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="experiment")


@asynccontextmanager
async def lifespan(_: FastAPI):
    with SessionLocal() as db:
        policy = db.get(RoutingPolicy, 1)
        if policy is None:
            db.add(RoutingPolicy(id=1, policy=active_policy))
        for name, url, capacity in settings.worker_configurations:
            if not db.scalar(select(BackendNode).where(BackendNode.name == name)):
                db.add(BackendNode(name=name, base_url=url, capacity_weight=capacity))
        db.commit()
    yield


app = FastAPI(title="AI Load Balancer", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins.split(","), allow_methods=["GET", "POST", "PUT", "PATCH", "OPTIONS"], allow_headers=["Content-Type", "X-Admin-Token", "X-Request-ID"])


def require_admin(x_admin_token: str | None = Header(default=None)) -> None:
    if not x_admin_token or x_admin_token != settings.admin_token:
        raise HTTPException(status_code=401, detail="Admin token required")


@app.exception_handler(HTTPException)
async def problem(_: Request, exc: HTTPException):
    request_id = getattr(_, "state", None) and getattr(_.state, "request_id", None)
    detail = str(exc.detail)
    semantic_codes = {"NO_HEALTHY_BACKENDS", "UPSTREAM_REQUEST_FAILED", "MODEL_UNAVAILABLE"}
    code = detail if detail in semantic_codes else str(exc.status_code)
    return JSONResponse(status_code=exc.status_code, content={"error": {"code": code, "message": detail, "request_id": request_id or str(uuid.uuid4())}})


@app.middleware("http")
async def correlation_id(request: Request, call_next):
    request.state.request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    return response


@app.get("/health/live")
def live(): return {"status": "alive"}


@app.get("/health/ready")
def ready(db: Session = Depends(get_db)):
    db.execute(select(1))
    return {"status": "ready"}


@app.get("/api/v1/system/status")
def system_status(db: Session = Depends(get_db)):
    model = db.scalar(select(ModelVersion).where(ModelVersion.is_active.is_(True)))
    return {"policy": _current_policy(db), "model_ready": model is not None and load_active_predictor(db) is not None, "model_version": None if not model else model.version}


def _experiment_payload(run: ExperimentRun, metrics: list[ExperimentMetric] | None = None) -> dict:
    payload = {
        "id": run.id, "name": run.name, "policy": run.policy,
        "workload_profile": run.workload_profile, "repetition": run.repetition,
        "scenario": run.scenario, "configuration_json": run.configuration_json,
        "status": run.status, "started_at": run.started_at,
        "ended_at": run.ended_at, "notes": run.notes,
    }
    if metrics is not None:
        payload["metrics"] = metrics
    return payload


@app.post("/api/v1/experiments", response_model=ExperimentOut, status_code=201, dependencies=[Depends(require_admin)])
def create_experiment(payload: ExperimentConfig, db: Session = Depends(get_db)):
    run = ExperimentRun(
        name=payload.name,
        policy=payload.policy,
        workload_profile=payload.workload_profile,
        repetition=payload.repetition,
        scenario=payload.scenario,
        configuration_json=payload.model_dump(),
        status="queued",
        notes=payload.notes,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


@app.get("/api/v1/experiments", response_model=list[ExperimentListItem])
def list_experiments(limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    runs = list(db.scalars(select(ExperimentRun).order_by(ExperimentRun.started_at.desc(), ExperimentRun.id.desc()).limit(limit)))
    result = []
    for run in runs:
        metric = db.scalar(select(ExperimentMetric).where(
            ExperimentMetric.experiment_id == run.id,
            ExperimentMetric.metric_scope == "overall",
        ))
        result.append({**_experiment_payload(run), "metric": metric})
    return result


@app.get("/api/v1/experiments/{experiment_id}", response_model=ExperimentDetail)
@app.get("/api/v1/experiments/{experiment_id}/results", response_model=ExperimentDetail)
def experiment_detail(experiment_id: str, db: Session = Depends(get_db)):
    run = db.get(ExperimentRun, experiment_id)
    if not run:
        raise HTTPException(404, "Experiment not found")
    metrics = list(db.scalars(select(ExperimentMetric).where(
        ExperimentMetric.experiment_id == experiment_id,
        ).order_by(ExperimentMetric.metric_scope, ExperimentMetric.backend_id)))
    return _experiment_payload(run, metrics)


@app.get("/api/v1/experiments/{experiment_id}/status", response_model=ExperimentOut)
def experiment_status(experiment_id: str, db: Session = Depends(get_db)):
    run = db.get(ExperimentRun, experiment_id)
    if not run:
        raise HTTPException(404, "Experiment not found")
    return run


@app.post("/api/v1/experiments/{experiment_id}/start", response_model=ExperimentOut, dependencies=[Depends(require_admin)])
def start_experiment(experiment_id: str, db: Session = Depends(get_db)):
    run = db.get(ExperimentRun, experiment_id)
    if not run:
        raise HTTPException(404, "Experiment not found")
    if run.status not in {"queued", "failed"}:
        raise HTTPException(409, f"Experiment is already {run.status}")
    run.status = "queued"
    db.commit()
    experiment_executor.submit(run_experiment_in_thread, experiment_id, settings)
    db.refresh(run)
    return run


@app.post("/api/v1/experiments/{experiment_id}/stop", response_model=ExperimentOut, dependencies=[Depends(require_admin)])
def stop_experiment(experiment_id: str, db: Session = Depends(get_db)):
    run = db.get(ExperimentRun, experiment_id)
    if not run:
        raise HTTPException(404, "Experiment not found")
    if run.status == "running":
        CANCEL_EVENTS.setdefault(experiment_id, threading.Event()).set()
    elif run.status == "queued":
        run.status = "cancelled"
        run.ended_at = datetime.now(timezone.utc)
        db.commit()
    db.refresh(run)
    return run


@app.get("/api/v1/experiments/{experiment_id}/export")
def export_experiment(experiment_id: str, format: str = Query("json", pattern="^(csv|json)$"), db: Session = Depends(get_db)):
    run = db.get(ExperimentRun, experiment_id)
    if not run:
        raise HTTPException(404, "Experiment not found")
    metrics = list(db.scalars(select(ExperimentMetric).where(ExperimentMetric.experiment_id == experiment_id)))
    if format == "json":
        body = json.dumps({**_experiment_payload(run), "metrics": [_experiment_payload_metric(metric) for metric in metrics], "raw_samples": run.raw_results_json or []}, default=str)
        return StreamingResponse(io.BytesIO(body.encode()), media_type="application/json", headers={"Content-Disposition": f'attachment; filename="{experiment_id}.json"'})
    output = io.StringIO()
    samples = run.raw_results_json or []
    fieldnames = sorted({key for sample in samples for key in sample}) or ["request_count"]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(samples)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{experiment_id}.csv"'})


def _experiment_payload_metric(metric: ExperimentMetric) -> dict:
    return {column.name: getattr(metric, column.name) for column in ExperimentMetric.__table__.columns if column.name not in {"id", "experiment_id"}}


@app.get("/api/v1/backends", response_model=list[BackendOut])
def list_backends(db: Session = Depends(get_db)):
    return list(db.scalars(select(BackendNode).order_by(BackendNode.name)))


@app.get("/api/v1/backends/{backend_id}", response_model=BackendDetail)
def backend_detail(backend_id: str, db: Session = Depends(get_db)):
    backend = db.get(BackendNode, backend_id)
    if not backend:
        raise HTTPException(404, "Backend not found")
    samples = list(db.scalars(select(TelemetrySample).where(
        TelemetrySample.backend_id == backend_id
    ).order_by(TelemetrySample.sampled_at.desc()).limit(50)))
    return {**BackendOut.model_validate(backend).model_dump(), "telemetry": [
        {column.name: getattr(sample, column.name) for column in TelemetrySample.__table__.columns}
        for sample in samples
    ]}


@app.post("/api/v1/backends", response_model=BackendOut, dependencies=[Depends(require_admin)])
def create_backend(payload: BackendCreate, db: Session = Depends(get_db)):
    if db.scalar(select(BackendNode).where((BackendNode.name == payload.name) | (BackendNode.base_url == str(payload.base_url)))):
        raise HTTPException(409, "Backend name or URL is already registered")
    backend = BackendNode(name=payload.name, base_url=str(payload.base_url).rstrip("/"), capacity_weight=payload.capacity_weight)
    db.add(backend); db.commit(); db.refresh(backend)
    return backend


@app.patch("/api/v1/backends/{backend_id}", response_model=BackendOut, dependencies=[Depends(require_admin)])
def patch_backend(backend_id: str, payload: BackendPatch, db: Session = Depends(get_db)):
    backend = db.get(BackendNode, backend_id)
    if not backend: raise HTTPException(404, "Backend not found")
    for key, value in payload.model_dump(exclude_none=True).items(): setattr(backend, key, value)
    if payload.enabled is False: backend.health_status = "disabled"
    db.commit(); db.refresh(backend)
    return backend


@app.post("/api/v1/backends/{backend_id}/health-check", dependencies=[Depends(require_admin)])
async def health_check(backend_id: str, db: Session = Depends(get_db)):
    backend = db.get(BackendNode, backend_id)
    if not backend: raise HTTPException(404, "Backend not found")
    return {"healthy": await collect_health(db, backend, settings)}


@app.post("/api/v1/backends/health-check-all", dependencies=[Depends(require_admin)])
async def health_check_all(db: Session = Depends(get_db)):
    nodes = list(db.scalars(select(BackendNode).where(BackendNode.enabled.is_(True))))
    results = [await collect_health(db, node, settings) for node in nodes]
    return {"checked": len(nodes), "healthy": sum(results)}


@app.get("/api/v1/decisions", response_model=list[DecisionOut])
def decisions(limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    return list(db.scalars(select(RoutingDecision).order_by(RoutingDecision.decided_at.desc()).limit(limit)))


@app.post("/api/v1/policies", dependencies=[Depends(require_admin)])
def set_policy(payload: PolicyUpdate, db: Session = Depends(get_db)):
    global active_policy
    active_policy = payload.policy
    policy = db.get(RoutingPolicy, 1)
    if policy is None:
        policy = RoutingPolicy(id=1, policy=payload.policy)
        db.add(policy)
    else:
        policy.policy = payload.policy
    db.commit()
    return {"policy": active_policy}


@app.get("/api/v1/routing/mode", response_model=PolicyOut)
def get_policy(db: Session = Depends(get_db)):
    return {"policy": _current_policy(db)}


@app.put("/api/v1/routing/mode", response_model=PolicyOut, dependencies=[Depends(require_admin)])
def update_policy(payload: PolicyUpdate, db: Session = Depends(get_db)):
    return set_policy(payload, db)


@app.get("/api/v1/routing/decisions", response_model=list[DecisionOut])
def routing_decisions(limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    return decisions(limit, db)


@app.get("/api/v1/metrics/summary")
def metrics_summary(window: str = Query("5m", pattern="^(5m|15m|1h)$"), db: Session = Depends(get_db)):
    rows = list(db.scalars(select(RoutingDecision).order_by(RoutingDecision.decided_at.desc()).limit(1000)))
    latencies = sorted(row.actual_latency_ms for row in rows if row.actual_latency_ms is not None)
    successes = sum(1 for row in rows if row.success)
    return {
        "window": window, "request_count": len(rows),
        "success_count": successes, "success_rate": successes / len(rows) if rows else 0,
        "p50_latency_ms": _percentile(latencies, 0.50),
        "p95_latency_ms": _percentile(latencies, 0.95),
        "p99_latency_ms": _percentile(latencies, 0.99),
        "backend_distribution": _distribution(rows),
    }


@app.get("/api/v1/metrics/timeseries")
def metrics_timeseries(metric: str = Query("p95_latency", pattern="^(p95_latency|throughput|success_rate)$"),
                       window: str = Query("15m", pattern="^(5m|15m|1h)$"),
                       step: str = Query("10s", pattern="^\\d+s$"),
                       db: Session = Depends(get_db)):
    rows = list(db.scalars(select(RoutingDecision).order_by(RoutingDecision.decided_at.desc()).limit(1000)))
    return {"metric": metric, "window": window, "step": step, "points": [
        {"timestamp": row.decided_at, "value": row.actual_latency_ms if metric == "p95_latency" else int(row.success) if metric == "success_rate" else 1}
        for row in reversed(rows)
    ]}


@app.get("/api/v1/metrics/backends/{backend_id}")
def backend_metrics(backend_id: str, window: str = Query("15m", pattern="^(5m|15m|1h)$"), db: Session = Depends(get_db)):
    if not db.get(BackendNode, backend_id):
        raise HTTPException(404, "Backend not found")
    samples = list(db.scalars(select(TelemetrySample).where(
        TelemetrySample.backend_id == backend_id
    ).order_by(TelemetrySample.sampled_at.desc()).limit(200)))
    return {"backend_id": backend_id, "window": window, "samples": [
        {column.name: getattr(sample, column.name) for column in TelemetrySample.__table__.columns}
        for sample in reversed(samples)
    ]}


@app.get("/api/v1/models/status")
def model_status(db: Session = Depends(get_db)):
    model = db.scalar(select(ModelVersion).where(ModelVersion.is_active.is_(True)))
    return {"ready": load_active_predictor(db) is not None, "version": None if not model else model.version, "fallback": "least_connections"}


@app.get("/api/v1/models/versions", response_model=list[ModelVersionOut])
def model_versions(db: Session = Depends(get_db)):
    return list(db.scalars(select(ModelVersion).order_by(ModelVersion.trained_at.desc()).limit(100)))


@app.post("/api/v1/models/{version}/activate", response_model=ModelVersionOut, dependencies=[Depends(require_admin)])
def activate_model(version: str, db: Session = Depends(get_db)):
    model = db.scalar(select(ModelVersion).where(ModelVersion.version == version))
    if not model:
        raise HTTPException(404, "Model version not found")
    if load_active_predictor(db) is None and model.version != version:
        raise HTTPException(422, "Model artifact is not valid")
    db.query(ModelVersion).update({ModelVersion.is_active: False})
    model.is_active = True
    db.commit()
    db.refresh(model)
    return model


@app.post("/api/v1/models/train", dependencies=[Depends(require_admin)])
def train(db: Session = Depends(get_db)):
    try:
        model = train_model(db, settings)
        return {"version": model.version, "samples": model.training_sample_count, "mae_ms": model.validation_mae_ms, "rmse_ms": model.validation_rmse_ms}
    except ValueError as error:
        raise HTTPException(422, str(error))


@app.get("/api/v1/route")
async def proxy_demo(request_class: str = Query("normal", pattern="^(light|normal|heavy)$"), db: Session = Depends(get_db)):
    candidates = eligible_backends(db, settings)
    if not candidates: raise HTTPException(503, "NO_HEALTHY_BACKENDS")
    features = {node.id: latest_features(db, node, request_class) for node in candidates}
    selection_start = time.perf_counter()
    policy = _current_policy(db)
    if policy == "round_robin": route = router.select_round_robin(candidates)
    elif policy == "least_connections": route = router.select_least_connections(candidates)
    else: route = router.select_ai(candidates, {key: feature_vector(value) for key, value in features.items()}, load_active_predictor(db))
    ai_inference_latency = (time.perf_counter() - selection_start) * 1000 if policy == "ai_latency" else None
    request_id, start = str(uuid.uuid4()), time.perf_counter()
    router.inflight[route.backend.id] = router.inflight.get(route.backend.id, 0) + 1
    status, response_payload, failure = None, None, None
    try:
        async with httpx.AsyncClient(timeout=settings.proxy_timeout_seconds, follow_redirects=False) as client:
            response = await client.get(f"{route.backend.base_url}/demo", params={"request_class": request_class}, headers={"X-Request-ID": request_id})
        status = response.status_code; response_payload = response.json(); response.raise_for_status()
    except (httpx.HTTPError, ValueError) as error:
        failure = type(error).__name__
    finally:
        router.inflight[route.backend.id] -= 1
    elapsed = (time.perf_counter() - start) * 1000
    decision = RoutingDecision(request_id=request_id, policy=route.policy, selected_backend_id=route.backend.id, model_version_id=route.model_version_id, predicted_latency_ms=route.predicted_latency_ms, actual_latency_ms=elapsed, ai_inference_latency_ms=ai_inference_latency, status_code=status, success=failure is None, request_class=request_class, fallback_reason=route.fallback_reason, failure_type=failure, features_json=features[route.backend.id])
    db.add(decision); db.commit()
    if failure:
        raise HTTPException(502, "UPSTREAM_REQUEST_FAILED")
    return {"request_id": request_id, "backend": route.backend.name, "policy": route.policy, "predicted_latency_ms": route.predicted_latency_ms, "actual_latency_ms": elapsed, "ai_inference_latency_ms": ai_inference_latency, "fallback_reason": route.fallback_reason, "upstream": response_payload}


@app.get("/api/v1/demo/request")
async def demo_request(workload: str = Query("normal", pattern="^(light|normal|heavy)$"), db: Session = Depends(get_db)):
    return await proxy_demo(workload, db)


def _percentile(values: list[float], percentile: float) -> float | None:
    if not values:
        return None
    return values[min(len(values) - 1, int((len(values) - 1) * percentile))]


def _current_policy(db: Session) -> str:
    policy = db.get(RoutingPolicy, 1)
    return policy.policy if policy else active_policy


def _distribution(rows: list[RoutingDecision]) -> dict[str, int]:
    result: dict[str, int] = {}
    for row in rows:
        if row.selected_backend_id:
            result[row.selected_backend_id] = result.get(row.selected_backend_id, 0) + 1
    return result
