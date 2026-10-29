# 5. API Contract (Proposed v1)

Prefix: `/api/v1`. The exact shapes may be refined during implementation, but the frontend, backend, tests, and report must share one consistent contract. Use Pydantic request/response schemas and return a consistent error envelope.

## Health
- `GET /health/live` — process is alive.
- `GET /health/ready` — API can serve requests; report database/model readiness separately.
- `GET /api/v1/system/status` — active policy, model status, database status, timestamps.

## Backends
- `GET /api/v1/backends` — registered workers and latest health/telemetry.
- `POST /api/v1/backends` — register a worker (admin only).
- `GET /api/v1/backends/{backend_id}` — detail/history summary.
- `PATCH /api/v1/backends/{backend_id}` — update enable state/capacity/config (admin only).
- `POST /api/v1/backends/{backend_id}/health-check` — trigger a bounded manual health check (admin only).

Example response:
```json
{
  "id": "backend-a",
  "name": "Worker A",
  "health_status": "healthy",
  "enabled": true,
  "capacity_weight": 1.0,
  "active_requests": 2,
  "latency_ewma_ms": 41.7,
  "network_rtt_ms": 3.1,
  "cpu_percent": 22.0,
  "last_health_at": "2026-10-29T07:00:00Z"
}
```

## Proxy and routing
- `GET /api/v1/demo/request?workload=light|normal|heavy` — send a safe demo request through the active policy. Return worker ID, status and elapsed time in response headers or a metadata envelope.
- `GET /api/v1/routing/mode` — get policy configuration.
- `PUT /api/v1/routing/mode` — set `round_robin`, `least_connections`, or `ai_latency` (admin only).
- `GET /api/v1/routing/decisions?limit=50&cursor=...` — paginated recent decisions.

Never let a browser request choose an arbitrary upstream URL. Accept only controlled workload categories for the demo endpoint.

## Metrics
- `GET /api/v1/metrics/summary?window=5m|15m|1h` — request count, success rate, throughput, p50/p95/p99, backend distribution.
- `GET /api/v1/metrics/timeseries?metric=p95_latency&window=15m&step=10s` — time-series points.
- `GET /api/v1/metrics/backends/{backend_id}?window=15m` — backend telemetry timeline.

## Experiments
- `POST /api/v1/experiments` — create experiment metadata with policy and workload settings.
- `POST /api/v1/experiments/{experiment_id}/start` — start approved experiment.
- `POST /api/v1/experiments/{experiment_id}/stop` — request stop.
- `GET /api/v1/experiments` — list runs.
- `GET /api/v1/experiments/{experiment_id}` — run config and aggregate metrics.
- `GET /api/v1/experiments/{experiment_id}/export?format=csv|json` — export available results.

## Model
- `GET /api/v1/models/status` — active version, trained sample count, fallback state, last training time.
- `POST /api/v1/models/train` — trigger a bounded training job (admin only); validate sample thresholds and prevent overlapping jobs.
- `GET /api/v1/models/versions` — model history and evaluation metrics.
- `POST /api/v1/models/{version}/activate` — activate an existing validated model (admin only).

## Error format
```json
{
  "error": {
    "code": "NO_HEALTHY_BACKENDS",
    "message": "No eligible backend is currently healthy.",
    "request_id": "correlation-id"
  }
}
```

Use appropriate HTTP status codes, a request/correlation ID, input validation, bounded result limits, and API tests. Document each endpoint in the FastAPI-generated OpenAPI schema. Protect all state-changing endpoints and rate-limit expensive training/load-test actions.
