# Phase 11 Remediation Tracker

Status values are **PASS**, **PARTIAL**, **BLOCKED**, **NOT TESTED**, or **OPEN**. This tracker is the source of truth for remediation closure.

| ID | Priority | Audit reference | Root cause / affected files | Remediation and acceptance criteria | Verification | Status |
|---|---|---|---|---|---|---|
| R-01 | Critical | 00, 06 | Existing PostgreSQL volume retains an older password; `deployment/docker-compose.yml` | Document non-destructive credential diagnosis and clean disposable-volume path; prove migrations, API connectivity, CRUD and restart persistence on PostgreSQL | Existing-volume and isolated clean-volume Compose, Alembic, routing, record creation, frontend connectivity, and restart retrieval passed | PASS |
| R-02 | Critical | 00, 03 | No browser runner or frontend test suite | Add browser-testable operational controls and run available browser tests; do not claim unavailable checks passed | Python Playwright exercised the live page and controls; no office renderer available | PASS |
| R-03 | High | 03 | Read-only `frontend/src/main.tsx` | Add policy selection, demo request, health check, backend enable/disable, model status/train and experiment creation controls; each action must show success/error state | Playwright verified policy, demo, health, experiment, error state, and disable/enable recovery; build passed | PASS |
| R-04 | High | 04 | Missing contract routes and inconsistent errors in `backend/app/main.py` | Add backend detail, routing mode GET/PUT, metrics summary/timeseries, backend telemetry, model versions; use semantic error code and request ID | Routes, demo alias, CORS PUT support, and correlation middleware added; 18-test suite and live route smoke passed | PASS |
| R-05 | High | 04, 06 | Unauthenticated experiment creation; default token `change-me` | Protect experiment creation; reject insecure token in non-test deployment while preserving explicit test configuration | Production rejects missing/weak tokens; experiment creation requires admin token; frontend holds token in memory | PASS |
| R-06 | High | 04 | Module-global `active_policy` | Persist policy in application-controlled state or database so status and requests agree across sessions | Policy updates now return committed database state; live policy persisted across API restart; multi-process concurrency remains untested | PARTIAL |
| R-07 | High | 07 | Runner accepts but does not inject several scenarios | Implement or explicitly label `missing_model`, `timeout`, and `stale_telemetry` as operator-injected | Timeout scenario now bounds request timeout; missing-model/stale scenarios record explicit operator-injection notes; cleanup remains in `finally` | PARTIAL |
| R-08 | Medium | 05 | Narrow model-load exception handling | Handle deserialization/runtime load failures as safe fallback without swallowing diagnostics | Missing, corrupt, incompatible artifact, valid model tests pass | PASS |
| R-09 | Medium | 06 | No request/rate/resource limits or periodic health scheduler | Add bounded API inputs and document remaining scheduler/circuit-breaker scope | Existing Pydantic bounds and proxy timeouts verified; rate limiting, scheduler and circuit breaker remain unimplemented | OPEN |
| R-10 | Medium | 08 | Stale Phase 6/API/architecture documentation | Mark historical reports and align API contract/readme with current routes | Phase 6 historical notice, release notes, checklists, and API/readme links updated; architecture reconciliation remains | PARTIAL |
| R-11 | Medium | 08 | Archive name `v1.0.0` versus submission tag `v1.0.1`; model excluded | Add release manifest/readme explanation and clean model provisioning instructions without changing historical data | `docs/RELEASE_MANIFEST.md` added and linked | PASS |
| R-12 | Environmental | 00, 08 | Office renderer unavailable; academic placeholders remain | Manual Word/PowerPoint inspection and fill institution details | Human inspection | BLOCKED |

## Closure rules

An item is not PASS merely because code was edited. PASS requires the acceptance criteria and verification evidence. Environmental and manual items remain BLOCKED until the required environment or human action exists.
