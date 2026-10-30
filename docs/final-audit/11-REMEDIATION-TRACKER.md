# Phase 11 Remediation Tracker

Status values are **PASS**, **PARTIAL**, **BLOCKED**, **NOT TESTED**, or **OPEN**. This tracker is the source of truth for remediation closure.

| ID | Priority | Audit reference | Root cause / affected files | Remediation and acceptance criteria | Verification | Status |
|---|---|---|---|---|---|---|
| R-01 | Critical | 00, 06 | Existing PostgreSQL volume retains an older password; `deployment/docker-compose.yml` | Document non-destructive credential diagnosis and clean disposable-volume path; prove migrations, API connectivity, CRUD and restart persistence on PostgreSQL | Existing-volume Compose, Alembic, routing, record creation and restart retrieval passed; clean-volume reset not run to preserve records | PARTIAL |
| R-02 | Critical | 00, 03 | No browser runner or frontend test suite | Add browser-testable operational controls and run available browser tests; do not claim unavailable checks passed | Browser runner unavailable; frontend build passed | BLOCKED |
| R-03 | High | 03 | Read-only `frontend/src/main.tsx` | Add policy selection, demo request, health check, backend enable/disable, model status/train and experiment creation controls; each action must show success/error state | Controls and in-memory token entry added; TypeScript/Vite build and Compose frontend smoke passed; browser execution unavailable | PARTIAL |
| R-04 | High | 04 | Missing contract routes and inconsistent errors in `backend/app/main.py` | Add backend detail, routing mode GET/PUT, metrics summary/timeseries, backend telemetry, model versions; use semantic error code and request ID | Routes, demo alias, CORS PUT support, and correlation middleware added; 18-test suite and live route smoke passed | PASS |
| R-05 | High | 04, 06 | Unauthenticated experiment creation; default token `change-me` | Protect experiment creation; reject insecure token in non-test deployment while preserving explicit test configuration | Experiment creation now requires admin token and tests pass; default-token policy remains open | PARTIAL |
| R-06 | High | 04 | Module-global `active_policy` | Persist policy in application-controlled state or database so status and requests agree across sessions | Policy endpoint tests and restart check | OPEN |
| R-07 | High | 07 | Runner accepts but does not inject several scenarios | Implement or explicitly label `missing_model`, `timeout`, and `stale_telemetry` as operator-injected | Runner tests and documentation | OPEN |
| R-08 | Medium | 05 | Narrow model-load exception handling | Handle deserialization/runtime load failures as safe fallback without swallowing diagnostics | Broader safe-fallback exception set added; corrupt-artifact regression test remains | PARTIAL |
| R-09 | Medium | 06 | No request/rate/resource limits or periodic health scheduler | Add bounded API inputs and document remaining scheduler/circuit-breaker scope | Validation tests and docs | OPEN |
| R-10 | Medium | 08 | Stale Phase 6/API/architecture documentation | Mark historical reports and align API contract/readme with current routes | Phase 6 historical notice and API/readme links updated; architecture reconciliation remains | PARTIAL |
| R-11 | Medium | 08 | Archive name `v1.0.0` versus submission tag `v1.0.1`; model excluded | Add release manifest/readme explanation and clean model provisioning instructions without changing historical data | `docs/RELEASE_MANIFEST.md` added and linked | PASS |
| R-12 | Environmental | 00, 08 | Office renderer unavailable; academic placeholders remain | Manual Word/PowerPoint inspection and fill institution details | Human inspection | BLOCKED |

## Closure rules

An item is not PASS merely because code was edited. PASS requires the acceptance criteria and verification evidence. Environmental and manual items remain BLOCKED until the required environment or human action exists.
