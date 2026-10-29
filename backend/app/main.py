from __future__ import annotations

import time
import uuid
from contextlib import asynccontextmanager

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import get_settings
from .database import SessionLocal, get_db
from .ml import load_active_predictor, train_model
from .models import BackendNode, ModelVersion, RoutingDecision
from .routing import Router
from .schemas import BackendCreate, BackendOut, BackendPatch, DecisionOut, PolicyUpdate
from .services import collect_health, eligible_backends, feature_vector, latest_features

settings = get_settings()
router = Router()
active_policy = "round_robin"


@asynccontextmanager
async def lifespan(_: FastAPI):
    with SessionLocal() as db:
        for name, url, capacity in settings.worker_configurations:
            if not db.scalar(select(BackendNode).where(BackendNode.name == name)):
                db.add(BackendNode(name=name, base_url=url, capacity_weight=capacity))
        db.commit()
    yield


app = FastAPI(title="AI Load Balancer", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins.split(","), allow_methods=["GET", "POST", "PATCH"], allow_headers=["Content-Type", "X-Admin-Token"])


def require_admin(x_admin_token: str | None = Header(default=None)) -> None:
    if not x_admin_token or x_admin_token != settings.admin_token:
        raise HTTPException(status_code=401, detail="Admin token required")


@app.exception_handler(HTTPException)
async def problem(_: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"error": {"code": str(exc.status_code), "message": str(exc.detail)}})


@app.get("/health/live")
def live(): return {"status": "alive"}


@app.get("/health/ready")
def ready(db: Session = Depends(get_db)):
    db.execute(select(1))
    return {"status": "ready"}


@app.get("/api/v1/system/status")
def system_status(db: Session = Depends(get_db)):
    model = db.scalar(select(ModelVersion).where(ModelVersion.is_active.is_(True)))
    return {"policy": active_policy, "model_ready": model is not None and load_active_predictor(db) is not None, "model_version": None if not model else model.version}


@app.get("/api/v1/backends", response_model=list[BackendOut])
def list_backends(db: Session = Depends(get_db)):
    return list(db.scalars(select(BackendNode).order_by(BackendNode.name)))


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
def set_policy(payload: PolicyUpdate):
    global active_policy
    active_policy = payload.policy
    return {"policy": active_policy}


@app.get("/api/v1/models/status")
def model_status(db: Session = Depends(get_db)):
    model = db.scalar(select(ModelVersion).where(ModelVersion.is_active.is_(True)))
    return {"ready": load_active_predictor(db) is not None, "version": None if not model else model.version, "fallback": "least_connections"}


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
    if active_policy == "round_robin": route = router.select_round_robin(candidates)
    elif active_policy == "least_connections": route = router.select_least_connections(candidates)
    else: route = router.select_ai(candidates, {key: feature_vector(value) for key, value in features.items()}, load_active_predictor(db))
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
    decision = RoutingDecision(request_id=request_id, policy=route.policy, selected_backend_id=route.backend.id, model_version_id=route.model_version_id, predicted_latency_ms=route.predicted_latency_ms, actual_latency_ms=elapsed, status_code=status, success=failure is None, request_class=request_class, fallback_reason=route.fallback_reason, failure_type=failure, features_json=features[route.backend.id])
    db.add(decision); db.commit()
    if failure:
        raise HTTPException(502, "UPSTREAM_REQUEST_FAILED")
    return {"request_id": request_id, "backend": route.backend.name, "policy": route.policy, "predicted_latency_ms": route.predicted_latency_ms, "fallback_reason": route.fallback_reason, "upstream": response_payload}
