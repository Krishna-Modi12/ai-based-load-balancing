# Remaining Work

## Before academic submission

1. Open the DOCX and PPTX in Microsoft Word and PowerPoint and inspect page breaks, fonts, charts, diagrams, tables, captions, and slide alignment.
2. Replace all academic placeholders and add institution-approved certificate/declaration/signature content.
3. Clarify the `v1.0.0` archive filename versus `v1.0.1` submission tag.
4. Mark historical reports and reconcile stale API/architecture statements.

## Before claiming reproducible deployment

1. Test a clean Compose volume with documented credentials.
2. Add a safe credential-mismatch diagnosis and disposable reset procedure.
3. Re-run API, PostgreSQL, workers, frontend, migrations, routing, and persistence smoke tests.
4. Provision/train the model in a clean checkout and record the artifact/version.

## Production-quality backlog

- Implement runner-owned failure scenarios or rename them as operator-injected.
- Replace global policy state.
- Complete API contract routes and consistent error/request-ID envelopes.
- Protect experiment creation.
- Add rate limits, circuit breaker, scheduled health checks, request limits, graceful shutdown, and model freshness rules.
- Expand the frontend with operational controls and loading/freshness states.
- Add browser tests and Compose-backed live integration tests.
