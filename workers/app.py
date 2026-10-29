import asyncio
import os
import time
from collections import deque

from fastapi import FastAPI, HTTPException, Query

app = FastAPI(title="Configurable load-balancer worker")
WORKER_ID = os.getenv("WORKER_ID", "worker")
BASE_DELAY_MS = float(os.getenv("BASE_DELAY_MS", "20"))
FAIL_MODE = os.getenv("FAIL_MODE", "false").lower() == "true"
active_requests = 0
latencies: deque[float] = deque(maxlen=100)
errors = 0
completed = 0


@app.get("/health")
async def health():
    if FAIL_MODE:
        raise HTTPException(503, "intentional failure profile")
    return {"status": "healthy", "worker": WORKER_ID}


@app.get("/metrics")
async def metrics():
    mean_latency = sum(latencies) / len(latencies) if latencies else BASE_DELAY_MS
    return {
        "worker": WORKER_ID, "active_requests": active_requests,
        "latency_ewma_ms": mean_latency, "cpu_percent": min(100.0, 8 + active_requests * 12),
        "memory_percent": 10.0, "error_rate": errors / max(1, completed + errors),
        "success_rate": completed / max(1, completed + errors), "simulated": True,
    }


@app.get("/demo")
async def demo(request_class: str = Query("normal", pattern="^(light|normal|heavy)$")):
    global active_requests, completed, errors
    if FAIL_MODE:
        errors += 1
        raise HTTPException(503, "intentional failure profile")
    multiplier = {"light": 0.5, "normal": 1.0, "heavy": 3.0}[request_class]
    active_requests += 1
    start = time.perf_counter()
    try:
        await asyncio.sleep((BASE_DELAY_MS * multiplier) / 1000)
        elapsed = (time.perf_counter() - start) * 1000
        latencies.append(elapsed); completed += 1
        return {"worker": WORKER_ID, "request_class": request_class, "simulated": True, "service_time_ms": round(elapsed, 2)}
    finally:
        active_requests -= 1
