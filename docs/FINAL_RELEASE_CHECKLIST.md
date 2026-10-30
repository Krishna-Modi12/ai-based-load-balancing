# Final Release Checklist

## Verified technical release

- [x] Backend regression suite: 25 passed.
- [x] Frontend production build passed.
- [x] PostgreSQL migrations, persistence, and API restart persistence verified.
- [x] Isolated clean Compose installation verified.
- [x] Playwright dashboard smoke journeys verified.
- [x] Docker Compose and Nginx validation completed.
- [x] Historical 36-run benchmark matrix preserved.
- [x] Release archive excludes `.env`, databases, dependencies, logs, and machine-specific files.

## Remaining technical limitations

- [ ] Run multi-process policy concurrency tests.
- [ ] Make missing-model and stale-telemetry failure scenarios runner-owned, or retain them as explicitly operator-injected.
- [ ] Provision and verify a model artifact from a clean archive checkout.
- [ ] Add production-grade rate/resource limits, scheduled health checks, circuit breaking, graceful shutdown, and model freshness enforcement.
- [ ] Complete broader frontend accessibility, responsive-layout, export, and screenshot coverage.

## Release controls

- Do not modify or merge the original 36-run results with later experiments.
- Do not include real secrets or local database files.
- Do not create a release tag or push without authorization.
- Preserve unrelated user changes in `docs/PROJECT_DOCUMENTATION.md`.
