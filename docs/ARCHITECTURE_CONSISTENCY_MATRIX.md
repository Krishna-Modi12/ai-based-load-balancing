# Architecture and Documentation Consistency Matrix

| Surface | Implemented source of truth | Documentation/evidence | Status |
|---|---|---|---|
| Layer-7 proxy | `backend/app/main.py` `/api/v1/route` | README, report, demo runbook | PASS |
| Registered backends | `BackendNode`, `eligible_backends` | Architecture and security audit | PASS |
| Routing policies | `routing.py`, persisted `RoutingPolicy` | Report, release notes, API routes | PASS |
| Telemetry | `TelemetrySample`, health endpoints | Database design and dashboard | PASS |
| AI model | `ml.py`, `ModelVersion`, joblib artifacts | ML methodology and release manifest | PASS |
| Experiments | `experiments.py`, `ExperimentRun`, `ExperimentMetric` | Phase 7/8 methodology and exports | PASS |
| PostgreSQL deployment | Compose, Alembic migrations | Demo runbook and clean-install evidence | PASS |
| Frontend operations | `frontend/src/main.tsx` | Browser evidence and checklist | PASS/PARTIAL |
| API metrics | `metrics_summary`, `metrics_timeseries` | API documentation and audit | PASS |
| Failure scenarios | Experiment runner and operator procedures | Failure evaluation and remaining-work report | PARTIAL |
| Production controls | No rate limiter/scheduler/circuit breaker | Remaining-work report | OPEN |
| Academic documents | DOCX/PPTX package | Academic submission checklist | BLOCKED/manual |

Historical reports and the original 36-run matrix remain evidence records; they are
not regenerated or altered by current code changes.
