# Phase 6 execution plan

Status: **executing**. This plan converts the existing isolated evidence into runtime evidence without claiming benchmark results.

## Audited runtime contract

| Service | Host port | Internal route / purpose |
| --- | --- | --- |
| `frontend` | 5173 | nginx proxies `/api/` and `/health/` to `api:8000` |
| `api` | 8000 | `/health/live`, `/health/ready`, `/api/v1/route`, backends, policies, decisions, models |
| `worker-a`, `worker-b`, `worker-c` | none | `:8080/health`, `/metrics`, `/demo` |
| `db` | none | PostgreSQL database `loadbalancer` |

`api` uses `postgresql+psycopg://…@db:5432/loadbalancer`; it must run Alembic before Uvicorn. State-changing endpoints require `X-Admin-Token`.

## Acceptance sequence

1. **Build gate:** `docker info`, then `docker compose -f deployment/docker-compose.yml config --quiet` and a single serial `docker compose … build`.
2. **Startup gate:** `docker compose … up -d`; inspect `ps` and service logs. Stop to repair only a concrete build/start error.
3. **Readiness gate:** call API live/ready endpoints, trigger `health-check-all`, and confirm all registered workers are healthy.
4. **PostgreSQL gate:** run `alembic current` in `api`; query migration revision and expected tables in `db`.
5. **Routing gate:** issue real proxy requests under Round Robin and Least Connections; check worker identity, `X-Request-ID`, and `/decisions` rows.
6. **AI gate:** collect calibration decisions, train only from persisted records, verify finite predictions and routing, then remove/unavailable-model fallback. Do not report comparative performance.
7. **Failure gate:** disable a node; stop or slow a worker if the existing controls permit it; test upstream 5xx and stale/missing telemetry. Verify decisions/errors and no arbitrary upstream URL path.
8. **Persistence/restart gate:** restart `api` (not data volume), confirm previously saved records remain. Verify frontend through `http://localhost:5173` and proxy `/api/v1/system/status`.
9. **Evidence gate:** run pytest and frontend build; append command summaries, PASS/FAIL/BLOCKED classifications, precise limitations, and reproduction commands to `docs/phase-6-integration-test-report.md`.

## Known constraints and decision gates

- Prior evidence is SQLite/in-process only; it does not prove Compose or PostgreSQL behavior.
- Previous Compose builds stalled around dependency downloads. Use one foreground serial build and capture its final error before any code change.
- Experiment lifecycle/export APIs and periodic health checks are absent; mark them `FAIL — not implemented`, not runtime failures.
- If Docker Engine is unavailable or an image registry/dependency download is blocked, record the exact output as `BLOCKED`; do not repeat indefinitely.
- Preserve `postgres_data`; no `down -v`, volume deletion, or destructive cleanup.

## Reproducible command outline

```powershell
Copy-Item .env.example .env -ErrorAction SilentlyContinue
# Set ADMIN_TOKEN and POSTGRES_PASSWORD in .env.
docker info
docker compose -f deployment/docker-compose.yml config --quiet
$env:COMPOSE_PARALLEL_LIMIT='1'
docker compose -f deployment/docker-compose.yml build
docker compose -f deployment/docker-compose.yml up -d
docker compose -f deployment/docker-compose.yml ps
docker compose -f deployment/docker-compose.yml logs --tail=100
```

Then use actual API requests with the `.env` admin token, query decisions, run `docker compose exec api alembic current`, restart only `api`, and rerun the relevant requests. Run Phase 7 only after all applicable Phase 6 gates are evidenced.
