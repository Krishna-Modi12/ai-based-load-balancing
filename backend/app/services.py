from __future__ import annotations

import asyncio
import time
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from .config import Settings
from .ml import FEATURE_NAMES
from .models import BackendNode, TelemetrySample

CLASS_VALUE = {"light": 0.0, "normal": 1.0, "heavy": 2.0}


async def collect_health(db: Session, backend: BackendNode, settings: Settings) -> bool:
    start = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=settings.proxy_timeout_seconds, follow_redirects=False) as client:
            health, metrics = await asyncio.gather(
                client.get(f"{backend.base_url}/health"), client.get(f"{backend.base_url}/metrics"),
            )
        if health.status_code != 200 or metrics.status_code != 200:
            raise RuntimeError("worker health check failed")
        data = metrics.json()
        backend.health_status = "healthy"
        backend.last_health_at = datetime.now(timezone.utc)
        db.add(TelemetrySample(
            backend_id=backend.id, cpu_percent=data.get("cpu_percent"), memory_percent=data.get("memory_percent"),
            active_requests=max(0, int(data.get("active_requests", 0))),
            latency_ewma_ms=data.get("latency_ewma_ms"), network_rtt_ms=(time.perf_counter() - start) * 1000,
            error_rate=min(1, max(0, float(data.get("error_rate", 0)))), success_rate=min(1, max(0, float(data.get("success_rate", 1)))),
            telemetry_source="simulated" if data.get("simulated", False) else "worker_metrics",
        ))
        db.commit()
        return True
    except (httpx.HTTPError, ValueError, RuntimeError):
        backend.health_status = "unhealthy"
        backend.last_health_at = datetime.now(timezone.utc)
        db.commit()
        return False


def eligible_backends(db: Session, settings: Settings) -> list[BackendNode]:
    """Only use a node with a recent health/telemetry observation.

    A node with stale metrics is deliberately excluded rather than treated as idle.
    """
    nodes = list(db.scalars(select(BackendNode).where(
        BackendNode.enabled.is_(True), BackendNode.health_status == "healthy"
    ).order_by(BackendNode.name)))
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=settings.telemetry_stale_seconds)
    return [node for node in nodes if db.scalar(select(TelemetrySample.id).where(
        TelemetrySample.backend_id == node.id, TelemetrySample.sampled_at >= cutoff
    ).limit(1))]


def latest_features(db: Session, backend: BackendNode, request_class: str) -> dict[str, float]:
    sample = db.scalar(select(TelemetrySample).where(TelemetrySample.backend_id == backend.id).order_by(desc(TelemetrySample.sampled_at)))
    values = {
        "cpu_percent": 0.0 if not sample or sample.cpu_percent is None else sample.cpu_percent,
        "memory_percent": 0.0 if not sample or sample.memory_percent is None else sample.memory_percent,
        "active_requests": 0.0 if not sample else sample.active_requests,
        "latency_ewma_ms": 0.0 if not sample or sample.latency_ewma_ms is None else sample.latency_ewma_ms,
        "network_rtt_ms": 0.0 if not sample or sample.network_rtt_ms is None else sample.network_rtt_ms,
        "error_rate": 0.0 if not sample else sample.error_rate,
        "capacity_weight": backend.capacity_weight,
        "request_class": CLASS_VALUE.get(request_class, 1.0),
    }
    return values


def feature_vector(features: dict[str, float]) -> list[float]:
    return [features[name] for name in FEATURE_NAMES]
