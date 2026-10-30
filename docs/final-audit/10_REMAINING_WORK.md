# Remaining Work

Phase 11 closure status is recorded below. PASS means independently verified;
PARTIAL and BLOCKED remain open.

## Before academic submission

1. **BLOCKED:** Open the DOCX and PPTX in Microsoft Word and PowerPoint and inspect page breaks, fonts, charts, diagrams, tables, captions, and slide alignment; no office renderer was available.
2. **BLOCKED:** Replace all academic placeholders and add institution-approved certificate/declaration/signature content.
3. **PASS:** Archive/tag mapping is documented in `docs/RELEASE_MANIFEST.md`.
4. **PARTIAL:** Phase 6 is marked historical; broader architecture/API reconciliation remains.

## Before claiming reproducible deployment

1. **PASS:** Isolated clean Compose volume with separate ports initialized, migrated, started all services, passed readiness, frontend connectivity, worker health, and a real routing request; it was removed afterward.
2. **PASS:** Safe credential-mismatch diagnosis and disposable reset procedure are documented in `docs/DEMO_RUNBOOK.md`.
3. **PASS:** PostgreSQL, API, workers, frontend, migrations, routing, and persistence-after-restart smoke checks passed.
4. **PARTIAL:** Provision/train the model in a clean checkout and record the artifact/version.

## Production-quality backlog

- **PARTIAL:** Timeout injection is runner-owned; missing-model and stale-telemetry scenarios are explicitly operator-injected and recorded.
- **PARTIAL:** Active policy is persisted in PostgreSQL/SQLite through `routing_policy`; multi-process concurrency testing remains.
- **PARTIAL:** Most API contract routes and consistent error/request-ID envelopes are now implemented; timeseries aggregation and model activation require further hardening.
- **PASS:** Experiment creation is protected.
- Add rate limits, circuit breaker, scheduled health checks, request limits, graceful shutdown, and model freshness rules.
- Expand the frontend with operational controls and loading/freshness states.
- **PASS:** Playwright exercised the live dashboard controls; keep browser regression coverage in future changes.
