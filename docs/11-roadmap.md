# 11. Implementation Roadmap

Work in this order: finish the core system before optional network emulation. Each phase should end with a working commit, tests, screenshots/logs where appropriate, and updated docs.

## Phase 0 — Architecture and repo setup
- Review the charter, SRS, architecture, database schema and API contract.
- Decide exact package versions compatible with the active Python/Node versions.
- Create repository folders, environment example, linting/test setup, Compose skeleton and initial CI.
- **Exit gate:** clean plan; no implementation contradictions; repo can be cloned and configured.

## Phase 1 — Worker and proxy vertical slice
- Build one worker app and run three configured workers.
- Add `/health`, `/metrics`, and `/demo` endpoints.
- Build FastAPI proxy with registered targets and strict timeouts.
- Implement Round Robin.
- **Exit gate:** a browser/CLI request goes through API and reaches a worker; backend identity is visible; unhealthy workers are excluded.

## Phase 2 — Database and observability
- Add PostgreSQL, SQLAlchemy models, Alembic migrations.
- Store worker registry, health/telemetry, decisions and actual latency.
- Add summary/timeseries APIs and request correlation IDs.
- **Exit gate:** decision records survive API restart; API can report metrics from DB.

## Phase 3 — Baseline algorithms and backend tests
- Implement Least Connections, tie-breaking, active request lifecycle, timeout/error handling, and fallback policy.
- Add unit/integration tests and failure injection.
- **Exit gate:** policy tests pass and node-failure demo works.

## Phase 4 — ML dataset, training and inference
- Add calibration mode that distributes requests across all healthy workers.
- Save pre-routing features and actual measured latency.
- Implement training script, validation metrics, version metadata and artifact loading.
- Integrate AI ranking with safe baseline fallback and tests for stale/invalid/missing model.
- **Exit gate:** model can be trained reproducibly and AI decisions are auditable. No performance claim yet.

## Phase 5 — Frontend dashboard
- Build overview, backend list/detail, live decision table, experiment screens, model status, settings.
- Add loading/error/empty/stale states and responsive layout.
- Add browser/API contract tests.
- **Exit gate:** full demo can be operated from the dashboard without manual DB editing.

## Phase 6 — Experiments and evaluation
- Integrate Locust workload scenarios.
- Execute baseline/AI comparisons under controlled scenarios and repetitions.
- Export raw results; generate plots through scripts.
- **Exit gate:** data-backed result tables and limitations are reviewable.

## Phase 7 — Hardening and release
- Run clean-install test, migrations, full suite, code quality/security review, UI pass, documentation audit.
- Publish repo, release tag, report, slides, demo script and screenshots.
- **Exit gate:** another person can run the project from the README and reproduce one experiment.

## Optional Phase 8 — Mininet/SDN extension
Only after the core project is stable: build a small topology in Mininet and explore an OpenFlow controller/traffic policy. Keep its dependencies and results separate; it may require Linux/VM setup. Do not let this extension block the core deliverable.
