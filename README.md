<div align="center">

# AI-Based Load Balancing

### An observable Layer-7 HTTP reverse proxy with conventional and AI-assisted routing

[![Release](https://img.shields.io/badge/release-v1.0.7-0f766e?style=for-the-badge)](docs/FINAL_RELEASE_NOTES.md)
[![Backend tests](https://img.shields.io/badge/backend%20tests-25%20passed-16a34a?style=for-the-badge)](backend/tests/)
[![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.116-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=111827)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

**A full-stack Computer Networks project for comparing Round Robin, Least Connections, and supervised Random Forest latency prediction under real HTTP traffic.**

[Quick start](#quick-start) · [Architecture](#architecture) · [Live demo flow](#live-demo-flow) · [Research results](#research-results) · [Documentation](#documentation)

</div>

> **Project status:** Verified academic release candidate. This is a tested software prototype, not a production security certification or a claim that AI routing is always faster.

## What this project does

The system sits between clients and a registered cluster of HTTP workers. For every request, the FastAPI control plane:

1. Checks which workers are enabled, healthy, and have fresh telemetry.
2. Selects a worker using the active routing policy.
3. Forwards the request with bounded timeouts and a correlation ID.
4. Measures the result and stores the routing decision in PostgreSQL.
5. Exposes health, telemetry, metrics, model, and experiment data through an API and React dashboard.

The AI policy is a supervised `RandomForestRegressor`. It predicts expected backend latency from CPU, memory, active requests, EWMA latency, network RTT, error rate, capacity, and request class. If the model is missing, invalid, stale, or unsafe, routing falls back to Least Connections.

## Architecture

```text
 Browser / HTTP client
          |
          v
  React dashboard :5173
       Nginx proxy
          |
          v
  FastAPI reverse proxy :8000
          |
    Routing engine
   /       |        \
 RR       LC       AI latency
   \       |        /
    Registered worker cluster
   worker-a  worker-b  worker-c
          |
          v
      PostgreSQL
 decisions | telemetry | models | experiments
```

### Included services

| Service | Role | Default |
|---|---|---|
| `api` | FastAPI reverse proxy and control plane | `localhost:8000` |
| `frontend` | React dashboard served by Nginx | `localhost:5173` |
| `worker-a` | Fast simulated backend | 15 ms base delay |
| `worker-b` | Slow simulated backend | 60 ms base delay |
| `worker-c` | Medium simulated backend | 30 ms base delay |
| `db` | PostgreSQL persistence | Internal Compose network |

## Routing policies

### Round Robin

Cycles through eligible workers in order. It is deterministic, inexpensive, and useful as a conventional baseline, but does not account for worker speed or current load.

### Least Connections

Chooses the eligible worker with the fewest active requests. It is a strong load-aware baseline for heterogeneous workers without requiring model inference.

### AI latency prediction

Scores each eligible worker with a trained Random Forest model and chooses the lowest safe predicted latency. Every AI decision records the feature vector, model version, prediction, actual latency, and any fallback reason.

Safety behavior is explicit:

- Missing model -> `MODEL_UNAVAILABLE`
- Invalid inference -> `MODEL_INFERENCE_FAILED`
- Stale or unhealthy worker -> excluded
- Unsafe prediction -> safe fallback to Least Connections
- Upstream timeout or failure -> structured error with request ID

## Quick start

### Requirements

- Docker Desktop with Docker Compose v2
- PowerShell on Windows, or an equivalent shell
- At least 4 GB of available Docker memory

### Start the complete stack

```powershell
cd "C:\Users\krish\OneDrive\Desktop\CN Project\ai_load_balancer_starter"
Copy-Item .env.example .env -ErrorAction SilentlyContinue
# Edit .env and set ADMIN_TOKEN and POSTGRES_PASSWORD.
docker compose --env-file .env -f deployment\docker-compose.yml up --build -d
docker compose --env-file .env -f deployment\docker-compose.yml ps
```

Open:

- Dashboard: <http://localhost:5173>
- API: <http://localhost:8000>
- Swagger UI: <http://localhost:8000/docs>

Check the services:

```powershell
Invoke-RestMethod http://localhost:8000/health/live
Invoke-RestMethod http://localhost:8000/health/ready
```

Expected responses:

```json
{"status":"alive"}
{"status":"ready"}
```

The dashboard accepts the `ADMIN_TOKEN` value from `.env` for operator actions. The token is held in browser memory only.

### Stop without deleting database data

```powershell
docker compose --env-file .env -f deployment\docker-compose.yml stop
```

Do not use `docker compose down -v` unless you intentionally want to delete the local PostgreSQL volume and its records.

## Live demo flow

Set the operator token in PowerShell:

```powershell
$env:ADMIN_TOKEN="your-local-admin-token"
$h=@{"X-Admin-Token"=$env:ADMIN_TOKEN}
```

Run a health check:

```powershell
Invoke-RestMethod `
  http://localhost:8000/api/v1/backends/health-check-all `
  -Method Post -Headers $h
```

Select Round Robin and route requests:

```powershell
Invoke-RestMethod http://localhost:8000/api/v1/policies `
  -Method Post -Headers $h -ContentType application/json `
  -Body '{"policy":"round_robin"}'

1..6 | ForEach-Object {
  Invoke-RestMethod "http://localhost:8000/api/v1/route?request_class=normal" |
    Select-Object backend,policy,actual_latency_ms,fallback_reason
}
```

Try Least Connections or AI routing by changing the policy value:

```powershell
{"policy":"least_connections"}
{"policy":"ai_latency"}
```

For AI routing, inspect `predicted_latency_ms`, `ai_inference_latency_ms`, and `fallback_reason`. A missing model is expected to fall back safely until calibration data has been collected and a model artifact has been provisioned.

To demonstrate failover, disable a registered worker from the dashboard or API. The router excludes it, continues using eligible workers, and records the resulting decisions.

## API highlights

| Endpoint | Purpose | Auth |
|---|---|---|
| `GET /health/live` | Process liveness | No |
| `GET /health/ready` | Database readiness | No |
| `GET /api/v1/system/status` | Active policy and model status | No |
| `GET /api/v1/route` | Route one HTTP request | No |
| `GET /api/v1/backends` | List registered workers | No |
| `POST /api/v1/backends/health-check-all` | Probe workers | Admin |
| `POST /api/v1/policies` | Change active policy | Admin |
| `GET /api/v1/decisions` | Read routing history | No |
| `GET /api/v1/metrics/summary` | Aggregate metrics | No |
| `GET /api/v1/metrics/timeseries` | Bucketed metrics | No |
| `GET /api/v1/models/status` | Model readiness | No |
| `POST /api/v1/models/train` | Train a model | Admin |
| `POST /api/v1/experiments` | Create an experiment | Admin |

Mutating endpoints use:

```http
X-Admin-Token: your-local-admin-token
```

## Observability and persistence

PostgreSQL stores:

- Registered backend nodes and health state
- Telemetry samples
- Routing decisions and correlation IDs
- Predicted versus actual latency
- Model versions and validation metadata
- Experiment configurations and metrics

Useful requests:

```powershell
Invoke-RestMethod "http://localhost:8000/api/v1/metrics/summary?window=5m"
Invoke-RestMethod "http://localhost:8000/api/v1/metrics/timeseries?metric=p95_latency&window=15m&step=10s"
Invoke-RestMethod "http://localhost:8000/api/v1/decisions?limit=20"
```

## Research results

The project includes a preserved 36-run evaluation across uniform, heterogeneous, bursty, and mixed-cost workloads. The measured result is intentionally reported honestly:

- Round Robin is simple and predictable.
- Least Connections is a strong general-purpose baseline.
- AI routing can adapt to telemetry, but inference adds overhead.
- AI was not universally faster in the measured workload.

Read the evidence:

- [`docs/phase-7-benchmark-results.md`](docs/phase-7-benchmark-results.md)
- [`docs/phase-8-analysis.md`](docs/phase-8-analysis.md)
- [`docs/phase-8-failure-mode-results.md`](docs/phase-8-failure-mode-results.md)

## Validation

Backend tests:

```powershell
cd backend
python -m pytest -q
```

Frontend build:

```powershell
cd frontend
npm ci --ignore-scripts
npm run build
```

Compose validation:

```powershell
docker compose --env-file .env -f deployment\docker-compose.yml config --quiet
```

## Project layout

```text
backend/       FastAPI application, routing engine, ML and experiments
db/            SQLAlchemy models and Alembic migrations
deployment/    Docker Compose and service configuration
frontend/      React, TypeScript, Vite and Nginx dashboard
workers/       Simulated HTTP backend workers
load_testing/  Locust workload definitions and experiment helpers
ml/            Model artifacts and training-related files
docs/          Architecture, audit, benchmark and academic documentation
```

## Documentation

- [Complete project documentation](docs/PROJECT_DOCUMENTATION.md)
- [Demonstration runbook](docs/DEMO_RUNBOOK.md)
- [Final release notes](docs/FINAL_RELEASE_NOTES.md)
- [Final release checklist](docs/FINAL_RELEASE_CHECKLIST.md)
- [Full project audit](docs/final-audit/FINAL_PROJECT_AUDIT_REPORT.md)
- [Academic submission checklist](docs/ACADEMIC_SUBMISSION_CHECKLIST.md)
- [Release manifest](docs/RELEASE_MANIFEST.md)

## Known limitations

This release is intended for controlled local and academic use. Before an untrusted or public deployment, address:

- Authentication for experiment read/export endpoints
- Allowlisting experiment target URLs
- Rate limiting and resource quotas
- Scheduled health checks and circuit breaking
- Graceful shutdown of in-flight requests
- Model freshness and clean model provisioning
- Multi-process routing-policy coordination

## License

This project is released under the [MIT License](LICENSE).
