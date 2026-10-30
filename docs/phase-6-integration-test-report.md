# Phase 6 — Full-stack integration and reliability validation

## Completed Compose/PostgreSQL runtime validation

Executed 29 October 2026 with Docker Desktop 29.2.1, using the repository Compose stack and a preserved `deployment_postgres_data` volume.

| Check | Result |
|---|---|
| API image build | **PASS** — `deployment-api:latest` built successfully after a Docker host-network retry |
| Compose startup | **PASS** — PostgreSQL, API, frontend, and all three workers started |
| API and frontend health | **PASS** — `/health/live`, `/health/ready`, frontend `/health/live`, and nginx `/api/v1/system/status` |
| PostgreSQL migration | **PASS** — API container reported `20261029_initial (head)`; seven expected tables exist |
| Worker health and registration | **PASS** — three registered workers, three healthy after health-check-all |
| Round Robin routing | **PASS** — live requests forwarded to worker-a, worker-b, and worker-c in sequence with request IDs |
| Least Connections routing | **PASS** — live policy change and proxy requests succeeded |
| Calibration and AI routing | **PASS** — 34 persisted samples; RandomForest model trained and reloaded; valid AI predictions routed successfully |
| Disabled worker | **PASS** — disabled worker-b was excluded from live routing and restored |
| Slow-worker timeout | **PASS** — worker-b configured to 5000 ms; API returned 502 `UPSTREAM_REQUEST_FAILED` with the 3-second proxy timeout |
| Worker 503 | **PASS** — Compose `WORKER_B_FAIL_MODE` override enabled a real worker 503; API returned 502 `UPSTREAM_REQUEST_FAILED` |
| PostgreSQL restart persistence | **PASS** — 44 routing decisions, 14 telemetry samples, and one model remained after API restart; readiness and frontend proxy remained healthy |

The Compose worker definitions now pass per-worker `FAIL_MODE` overrides (`WORKER_A_FAIL_MODE`, `WORKER_B_FAIL_MODE`, and `WORKER_C_FAIL_MODE`) so failure injection is reproducible without changing worker code.

**Status: ESCALATED — Docker Engine is unavailable, so the Compose/PostgreSQL/browser runtime portion cannot be truthfully completed in this session.** This report distinguishes executed local evidence from blocked container checks. No benchmark result or AI-performance claim is made.

## Environment

| Item | Observed value |
|---|---|
| Date | 29 October 2026 |
| Host OS | Windows (PowerShell workspace) |
| Python | 3.11.9 |
| Node.js | v26.7.0 |
| Docker CLI / Compose plugin | 29.2.1 / v5.1.0 |
| Docker Engine | **Unavailable**: `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified` |
| PostgreSQL | Declared as `postgres:16-alpine` in Compose; not started |

## Audited service contract

| Component | Actual implementation |
|---|---|
| Frontend | `frontend`, port `5173`; nginx forwards `/api/` and `/health/` to `api:8000` |
| API | `api`, port `8000`; live `/health/live`, ready `/health/ready`, proxy `GET /api/v1/route?request_class=light|normal|heavy` |
| Workers | `worker-a`, `worker-b`, `worker-c`, internal port `8080`; `/health`, `/metrics`, `/demo` |
| Database | `db` PostgreSQL service; API URL uses `postgresql+psycopg://…@db:5432/loadbalancer` |
| Admin operations | `X-Admin-Token`: health checks, backend changes, policy changes, model training |
| Model | `RandomForestRegressor`; schema v1; eight ordered pre-routing features in `backend/app/ml.py` |

The implemented API does **not yet** provide the SRS-proposed experiment lifecycle/export, metrics-summary/time-series, model-version listing/activation, or a periodic health checker. Those items are recorded as not tested/not implemented rather than implied to work.

## Executed checks

| Check | Command | Result | Classification |
|---|---|---|---|
| Docker availability | `docker info` | Docker client responded; server named pipe was missing | **BLOCKED** |
| Compose syntax/configuration | `$env:ADMIN_TOKEN='phase6-verification-only'; docker compose -f deployment/docker-compose.yml config --quiet` | Exit code 0 | **PASS** |
| Local backend suite | `cd backend; $env:PYTHONPATH=(Get-Location).Path; python -m pytest -q` | `13 passed in 2.64s` | **PASS** |
| Frontend production build | `npm --prefix frontend run build` | Vite completed, 15 modules transformed | **PASS** |
| Alembic revision (SQLite isolation only) | `$env:DATABASE_URL='sqlite:///./phase6-alembic.sqlite3'; $env:PYTHONPATH=(Join-Path (Get-Location) 'backend'); alembic upgrade head; alembic current` | `20261029_initial (head)` | **PASS — SQLite only** |
| PostgreSQL migration | Requires running `db` container | No Docker Engine | **BLOCKED** |
| Complete stack start/log/status | `docker compose … up --build -d`, `ps`, `logs` | Not attempted after Docker availability failure | **BLOCKED** |
| Browser-to-API runtime request | Requires running frontend/API | Not available | **BLOCKED** |

## Routing, persistence, AI, and failure evidence

These are in-process protocol integration tests with an HTTP worker transport double; they are not a claim that containers or PostgreSQL were exercised.

| Scenario | Evidence | Classification |
|---|---|---|
| Round Robin proxy forwarding | Two healthy registered workers were selected in `alpha`, `bravo` order | **PASS** |
| Correlation forwarding | `X-Request-ID` passed to the worker request and returned response ID matched a saved decision | **PASS** |
| Decision persistence | Two proxied successes were queried from `routing_decisions`, including latency and success flag | **PASS — SQLite only** |
| Least Connections | Protected policy change and real proxy route returned `least_connections` | **PASS — in-process** |
| AI unavailable fallback | AI policy route returned `MODEL_UNAVAILABLE`; selected safe Least Connections fallback | **PASS — in-process** |
| Trained artifact/schema | 25 controlled records trained a Random Forest; saved artifact reloaded with the eight-feature schema and gave a finite prediction | **PASS — isolated test** |
| Disabled worker | Disabled `bravo` was omitted; route selected `alpha` | **PASS — in-process** |
| Stale telemetry | A two-minute-old sample was excluded with a 30-second freshness limit | **PASS — isolated test** |
| Upstream HTTP error | Simulated worker `503` became API `502`; failed decision stored `HTTPStatusError` | **PASS — in-process** |
| Backend timeout | No real slow worker/container was available | **NOT TESTED** |
| Worker becomes unhealthy | No real worker/container was available | **NOT TESTED** |
| AI valid inference through running proxy | Model loading was tested in isolation; no running Compose API | **NOT TESTED** |
| Arbitrary upstream selection | Proxy endpoint has no URL parameter and only forwards to registered database nodes; runtime penetration test pending | **PASS — source/API contract review** |
| Experiment records and exports | Required endpoints are absent | **FAIL — not implemented** |

## Fixes made during validation

1. **Alembic was not executed by Compose.** The API Docker image now copies the migration files and runs `alembic upgrade head` before Uvicorn. The Compose API build context was widened to the repository root so those files are available.
2. **Migration imports were repository-layout dependent.** Alembic now resolves the backend import path for both local and image layouts.
3. **API startup masked migration problems.** Removed `Base.metadata.create_all()` from the API lifecycle. Test-only SQLite schema setup now lives in `backend/tests/conftest.py`; production persistence must go through Alembic.
4. **Coverage gap.** Added integration-focused tests for proxy forwarding, recorded decision persistence, correlation IDs, safe fallback, disabled/stale nodes, upstream errors, and training/schema loading.
5. **Startup session lifecycle.** Replaced `next(get_db())` at startup with a scoped `SessionLocal()` context.

## What is verified now

- Source configuration is internally consistent: service names, worker ports, frontend proxy path, API database URL, model feature ordering, and protected state-changing APIs agree.
- The revised image is configured to migrate before serving.
- Local SQLite migration, 13 backend tests, and the frontend production build pass.
- The proxy’s safety and persistence behaviours listed above have isolated integration evidence.

## What remains blocked or broken

- Docker Desktop must be started; all Compose, PostgreSQL, real-worker, frontend-runtime, container restart, and log-based claims remain blocked.
- The project cannot yet satisfy experiment creation, metric aggregation, and CSV/JSON export requirements because the corresponding API implementation is absent.
- Health checking is manually triggered rather than periodic.
- There is no real runtime evidence yet for timeout failure, actual Postgres persistence across API restart, or valid AI inference through the Compose proxy.

## Reproduce after Docker Desktop is running

```powershell
cd "C:\Users\krish\OneDrive\Desktop\CN Project\ai_load_balancer_starter"
Copy-Item .env.example .env
# Replace ADMIN_TOKEN in .env with a non-placeholder local secret.
docker info
docker compose -f deployment/docker-compose.yml config --quiet
docker compose -f deployment/docker-compose.yml up --build -d
docker compose -f deployment/docker-compose.yml ps
docker compose -f deployment/docker-compose.yml logs --tail=100 api db worker-a worker-b worker-c frontend
```

Then call `POST /api/v1/backends/health-check-all` with the token, send controlled `GET /api/v1/route` requests under each policy, inspect `GET /api/v1/decisions`, restart `api`, and query again. Run `alembic current` **inside the API container** and inspect PostgreSQL directly before marking database persistence as passed.

## Exact next step

Start Docker Desktop until `docker info` shows a **Server** section, then rerun the Compose commands above. Only after the Phase 6 container checks pass should Phase 7 run matched, repeated Locust workloads for Round Robin, Least Connections, and valid AI inference; retain the raw outputs before calculating or reporting any performance metric.
# Historical report

This report records the Phase 6 state at the time of that validation. Later
Phase 7 implementation added experiment lifecycle and export endpoints; use
the current API contract and final audit for the current route inventory.
