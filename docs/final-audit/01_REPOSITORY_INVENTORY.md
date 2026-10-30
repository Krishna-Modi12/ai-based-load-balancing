# Repository Inventory

## Application

| Area | Key files | Audit result |
|---|---|---|
| FastAPI API/proxy | `backend/app/main.py` | Implemented; routes, proxy, persistence, experiments |
| Routing | `backend/app/routing.py` | Round Robin, Least Connections, AI ranking and fallback |
| Health/telemetry | `backend/app/services.py` | Implemented; freshness filtering and feature construction |
| ML | `backend/app/ml.py` | Random Forest training, validation, artifact loading |
| Experiments | `backend/app/experiments.py`, `backend/app/experiment_cli.py` | Aggregation, persistence, export, bounded runner |
| Persistence | `backend/app/models.py`, `db/alembic` | SQLAlchemy models and migrations |
| Workers | `workers/app.py` | Health, metrics, demo endpoint, configurable failure behavior |
| Frontend | `frontend/src/main.tsx`, `frontend/src/style.css` | Buildable, read-only monitoring dashboard |
| Deployment | `deployment/docker-compose.yml`, Dockerfiles | Compose stack and startup migration |
| Load testing | `load_testing/locustfile.py` | Locust starter |

## Tests and documentation

Backend tests cover API behavior, routing, proxy integration, failure mappings, model validation, and experiment aggregation. Documentation includes requirements, architecture, API, ML methodology, Phase 6-8 evidence, final reports, runbook, viva material, and release assets.

## Release state

- Latest commit at audit start: `f32a33a`.
- Tags: `v1.0.0`, `v1.0.1`.
- Archive: `AI_Based_Load_Balancing_v1.0.0.zip`.
- Git working tree: clean during the audit.
- No Git remote is configured; nothing was pushed.

## Inventory caveats

The archive excludes local databases, secrets, `node_modules`, and model artifacts. A clean checkout therefore requires environment setup and model training/provisioning before AI routing is fully active.
