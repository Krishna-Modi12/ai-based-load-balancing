# Antigravity Prompt 02 — Production-quality backend foundations

Read the SRS, architecture, database design, API contract, and security notes. Implement the backend foundations as clean modules, not one giant file.

Requirements:
- FastAPI app factory/startup/lifespan; configuration from validated environment settings.
- SQLAlchemy 2.x models and session management; Alembic initial migration.
- PostgreSQL tables defined in `docs/04-database-design.md`: backend nodes, telemetry samples, routing decisions, experiment runs/metrics, model versions; add audit events only if needed.
- Async HTTPX client lifecycle, request correlation IDs, bounded proxy timeouts, clean error handling and no body logging.
- Periodic health checker with cancellation-safe lifespan management; stale telemetry is distinguishable from healthy status.
- API routes and schemas following `docs/05-api-contract.md`. Mutating endpoints must be protected (do not leave unauthenticated public controls). Keep upstream URLs restricted to the operator-maintained registry.
- Add migrations, seed/dev command, indexes, pagination limits, UTC timestamps, and DB integration tests.
- Separate repository, service, API/schema, routing, telemetry and config layers only where it improves clarity; avoid needless abstraction.

Test success paths and failure paths: no healthy workers, timeout, invalid worker URL/config, DB unavailable, duplicate IDs, stale telemetry, disabled backend, and proxy error. Run migrations on an empty test DB and verify no secret is committed. Update API docs and README. Report exact test counts/commands without inventing results.
