"""Measured experiment orchestration and aggregation.

The runner only records observations returned by the configured API. It never
fills missing measurements with estimates or synthetic benchmark results.
"""
from __future__ import annotations

import asyncio
import math
import random
import threading
import time
from collections import Counter
from datetime import datetime, timezone
from statistics import mean
from typing import Any

import httpx
from sqlalchemy import select

from .config import Settings
from .database import SessionLocal
from .models import BackendNode, ExperimentMetric, ExperimentRun
from .schemas import ExperimentConfig

PROFILE_WEIGHTS: dict[str, dict[str, float]] = {
    "uniform": {"normal": 1.0},
    "heterogeneous": {"light": 0.25, "normal": 0.5, "heavy": 0.25},
    "bursty": {"normal": 1.0},
    "mixed": {"light": 0.2, "normal": 0.6, "heavy": 0.2},
}
CANCEL_EVENTS: dict[str, threading.Event] = {}


def percentile(values: list[float], quantile: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, math.ceil(quantile * len(ordered)) - 1))
    return round(ordered[index], 4)


def _mean(values: list[float]) -> float | None:
    return round(mean(values), 4) if values else None


def _balance_metrics(distribution: Counter[str]) -> tuple[float | None, float | None]:
    counts = [count for count in distribution.values() if count >= 0]
    if not counts or sum(counts) == 0:
        return None, None
    average = sum(counts) / len(counts)
    cv = (math.sqrt(sum((value - average) ** 2 for value in counts) / len(counts)) / average) if average else None
    denominator = len(counts) * sum(value * value for value in counts)
    jain = (sum(counts) ** 2 / denominator) if denominator else None
    return (round(cv, 4) if cv is not None else None, round(jain, 4) if jain is not None else None)


def aggregate_samples(samples: list[dict[str, Any]], duration_seconds: float, scope_backend: str | None = None) -> dict[str, Any]:
    selected = [sample for sample in samples if scope_backend is None or sample.get("backend") == scope_backend]
    latencies = [float(sample["client_latency_ms"]) for sample in selected if sample.get("client_latency_ms") is not None]
    successful = [sample for sample in selected if sample.get("success")]
    predictions = [float(sample["predicted_latency_ms"]) for sample in selected if sample.get("predicted_latency_ms") is not None]
    prediction_errors = [
        float(sample["predicted_latency_ms"]) - float(sample["upstream_latency_ms"])
        for sample in selected
        if sample.get("predicted_latency_ms") is not None and sample.get("upstream_latency_ms") is not None
    ]
    inference = [float(sample["ai_inference_latency_ms"]) for sample in selected if sample.get("ai_inference_latency_ms") is not None]
    distribution = Counter(sample["backend"] for sample in selected if sample.get("backend"))
    errors = Counter(sample["error_type"] for sample in selected if not sample.get("success") and sample.get("error_type"))
    cv, jain = _balance_metrics(distribution)
    request_count = len(selected)
    mae = mean(abs(value) for value in prediction_errors) if prediction_errors else None
    rmse = math.sqrt(mean(value * value for value in prediction_errors)) if prediction_errors else None
    return {
        "request_count": request_count,
        "success_count": len(successful),
        "error_count": request_count - len(successful),
        "timeout_count": sum(1 for sample in selected if sample.get("timeout")),
        "throughput_rps": round(len(successful) / duration_seconds, 4) if duration_seconds > 0 else 0,
        "error_rate": round((request_count - len(successful)) / request_count, 4) if request_count else 0,
        "mean_latency_ms": _mean(latencies),
        "latency_p50_ms": percentile(latencies, 0.50),
        "latency_p95_ms": percentile(latencies, 0.95),
        "latency_p99_ms": percentile(latencies, 0.99),
        "distribution_json": dict(distribution),
        "error_breakdown_json": dict(errors),
        "ai_prediction_count": len(predictions),
        "ai_prediction_p50_ms": percentile(predictions, 0.50),
        "ai_prediction_p95_ms": percentile(predictions, 0.95),
        "ai_prediction_mae_ms": round(mae, 4) if mae is not None else None,
        "ai_prediction_rmse_ms": round(rmse, 4) if rmse is not None else None,
        "ai_inference_p50_ms": percentile(inference, 0.50),
        "mean_cpu_percent": _mean([float(sample["cpu_percent"]) for sample in selected if sample.get("cpu_percent") is not None]),
        "mean_memory_percent": _mean([float(sample["memory_percent"]) for sample in selected if sample.get("memory_percent") is not None]),
        "load_balance_cv": cv,
        "fairness_jain": jain,
    }


def _pick_request_class(profile: str, rng: random.Random) -> str:
    weights = PROFILE_WEIGHTS[profile]
    point = rng.random() * sum(weights.values())
    for request_class, weight in weights.items():
        point -= weight
        if point <= 0:
            return request_class
    return next(iter(weights))


async def _request(
    client: httpx.AsyncClient,
    config: ExperimentConfig,
    rng: random.Random,
    headers: dict[str, str],
    sequence: int,
) -> dict[str, Any]:
    request_class = _pick_request_class(config.workload_profile, rng)
    started = time.perf_counter()
    sample: dict[str, Any] = {
        "sequence": sequence,
        "request_class": request_class,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "policy": config.policy,
        "success": False,
        "timeout": False,
        "error_type": None,
        "backend": None,
        "status_code": None,
        "client_latency_ms": None,
        "predicted_latency_ms": None,
        "upstream_latency_ms": None,
        "ai_inference_latency_ms": None,
    }
    try:
        response = await client.get(
            f"{config.target_base_url.rstrip('/')}/api/v1/route",
            params={"request_class": request_class},
            headers=headers,
        )
        sample["status_code"] = response.status_code
        payload = response.json()
        sample.update({
            "backend": payload.get("backend"),
            "predicted_latency_ms": payload.get("predicted_latency_ms"),
            "upstream_latency_ms": payload.get("actual_latency_ms"),
            "ai_inference_latency_ms": payload.get("ai_inference_latency_ms"),
        })
        sample["success"] = response.is_success
        if not response.is_success:
            sample["error_type"] = payload.get("error", {}).get("code", f"HTTP_{response.status_code}")
    except httpx.TimeoutException as error:
        sample["timeout"] = True
        sample["error_type"] = type(error).__name__
    except (httpx.HTTPError, ValueError) as error:
        sample["error_type"] = type(error).__name__
    finally:
        sample["client_latency_ms"] = round((time.perf_counter() - started) * 1000, 4)
    return sample


async def _measurement_loop(
    config: ExperimentConfig,
    headers: dict[str, str],
    cancel_event: threading.Event,
    start_sequence: int,
) -> list[dict[str, Any]]:
    deadline = time.perf_counter() + config.duration_seconds
    counter = start_sequence
    results: list[dict[str, Any]] = []
    interval = (config.concurrency / config.request_rate) if config.request_rate else 0

    async with httpx.AsyncClient(timeout=config.request_timeout_seconds, follow_redirects=False) as client:
        async def worker(worker_index: int):
            nonlocal counter
            rng = random.Random(config.seed + worker_index)
            while time.perf_counter() < deadline and not cancel_event.is_set():
                sequence = counter
                counter += 1
                results.append(await _request(client, config, rng, headers, sequence))
                if interval:
                    await asyncio.sleep(interval)
                elif config.workload_profile == "bursty" and int(time.perf_counter() * 10) % 10 > 6:
                    await asyncio.sleep(0.15)
                else:
                    await asyncio.sleep(0)
        await asyncio.gather(*(worker(index) for index in range(config.concurrency)))
    return results


async def _warmup(config: ExperimentConfig, headers: dict[str, str], cancel_event: threading.Event) -> None:
    if config.warmup_seconds <= 0:
        return
    warmup = config.model_copy(update={"duration_seconds": config.warmup_seconds, "workload_profile": "uniform"})
    await _measurement_loop(warmup, headers, cancel_event, -1)


def _write_metrics(db, run: ExperimentRun, samples: list[dict[str, Any]]) -> None:
    duration = float(run.configuration_json["duration_seconds"])
    db.query(ExperimentMetric).filter(ExperimentMetric.experiment_id == run.id).delete()
    overall = aggregate_samples(samples, duration)
    db.add(ExperimentMetric(experiment_id=run.id, metric_scope="overall", **overall))
    for backend in sorted({sample["backend"] for sample in samples if sample.get("backend")}):
        node = db.scalar(select(BackendNode).where(BackendNode.name == backend))
        db.add(ExperimentMetric(
            experiment_id=run.id,
            backend_id=node.id if node else None,
            metric_scope="backend",
            **aggregate_samples(samples, duration, backend),
        ))


async def execute_run(run_id: str, settings: Settings) -> None:
    cancel_event = CANCEL_EVENTS.setdefault(run_id, threading.Event())
    with SessionLocal() as db:
        run = db.get(ExperimentRun, run_id)
        if not run:
            return
        if run.status == "cancelled":
            CANCEL_EVENTS.pop(run_id, None)
            return
        config = ExperimentConfig.model_validate(run.configuration_json)
        run.status = "running"
        run.started_at = datetime.now(timezone.utc)
        db.commit()
    headers = {"X-Admin-Token": settings.admin_token}
    samples: list[dict[str, Any]] = []
    disabled_backend_id: str | None = None
    try:
        async with httpx.AsyncClient(timeout=config.request_timeout_seconds, follow_redirects=False) as control:
            policy_response = await control.post(
                f"{config.target_base_url.rstrip('/')}/api/v1/policies",
                headers=headers,
                json={"policy": config.policy},
            )
            policy_response.raise_for_status()
            if config.scenario != "stale_telemetry":
                health_response = await control.post(
                    f"{config.target_base_url.rstrip('/')}/api/v1/backends/health-check-all",
                    headers=headers,
                )
                health_response.raise_for_status()
            if config.scenario == "node_failure":
                backends_response = await control.get(f"{config.target_base_url.rstrip('/')}/api/v1/backends")
                backends_response.raise_for_status()
                enabled = next((node for node in backends_response.json() if node["enabled"]), None)
                if enabled:
                    disabled_backend_id = enabled["id"]
                    await control.patch(
                        f"{config.target_base_url.rstrip('/')}/api/v1/backends/{enabled['id']}",
                        headers=headers,
                        json={"enabled": False},
                    )
        measurement_config = config
        if config.scenario == "timeout":
            measurement_config = config.model_copy(update={"request_timeout_seconds": min(config.request_timeout_seconds, 0.01)})
        if config.scenario in {"missing_model", "stale_telemetry"}:
            with SessionLocal() as notes_db:
                notes_run = notes_db.get(ExperimentRun, run_id)
                if notes_run:
                    notes_run.notes = f"{notes_run.notes or ''}\nScenario requires external operator injection: {config.scenario}".strip()
                    notes_db.commit()
        await _warmup(measurement_config, headers, cancel_event)
        samples = await _measurement_loop(measurement_config, headers, cancel_event, 0)
        with SessionLocal() as db:
            run = db.get(ExperimentRun, run_id)
            if not run:
                return
            run.raw_results_json = samples
            _write_metrics(db, run, samples)
            run.status = "cancelled" if cancel_event.is_set() else "completed"
            run.ended_at = datetime.now(timezone.utc)
            db.commit()
    except Exception as error:
        with SessionLocal() as db:
            run = db.get(ExperimentRun, run_id)
            if run:
                run.status = "failed"
                run.notes = f"{run.notes or ''}\nRunner error: {type(error).__name__}: {error}".strip()
                run.ended_at = datetime.now(timezone.utc)
                db.commit()
    finally:
        if disabled_backend_id:
            try:
                async with httpx.AsyncClient(timeout=config.request_timeout_seconds, follow_redirects=False) as control:
                    await control.patch(
                        f"{config.target_base_url.rstrip('/')}/api/v1/backends/{disabled_backend_id}",
                        headers=headers,
                        json={"enabled": True},
                    )
                    await control.post(
                        f"{config.target_base_url.rstrip('/')}/api/v1/backends/{disabled_backend_id}/health-check",
                        headers=headers,
                    )
            except httpx.HTTPError:
                pass
        CANCEL_EVENTS.pop(run_id, None)


def run_experiment_in_thread(run_id: str, settings: Settings) -> None:
    asyncio.run(execute_run(run_id, settings))
