# Final Release Notes

## Current candidate

- Release candidate: `v1.0.7`
- Source hardening includes the full-system audit fixes after `308a41e`.
- Current archive: `AI_Based_Load_Balancing_v1.0.7.zip`
- Historical benchmark matrix: 36 valid runs, preserved unchanged

## Closure edits after v1.0.2

The following code hardening was applied after the v1.0.2 archive state:

- Policy update responses now return the value committed to the database rather than a process-local value.
- Metrics summary now applies the requested time window.
- Metrics timeseries now aggregates decisions into the requested step buckets.
- Model activation validates the selected artifact itself before activation.

These edits are included in `AI_Based_Load_Balancing_v1.0.3.zip`.

## Frontend closure after v1.0.3

Commit `3f49f6f` adds pinned frontend dependency versions, semantic HTML,
accessible labels and status attributes, stable initial loading behavior,
non-flickering background refresh, safer error extraction, session-scoped
operator-token handling in memory only, and an HTML document shell. These changes are
included in `AI_Based_Load_Balancing_v1.0.6.zip`.

## Full-system audit fixes after v1.0.6

- Removed the unused build-time admin-token path from the frontend.
- Bound Compose API/frontend ports to localhost by default.
- Synchronized the frontend lockfile and changed the container build to reproducible `npm ci`.
- Fixed root-level Alembic migration imports.
- Applied backend telemetry time-window filtering and malformed-value handling.
- Expanded safe handling of common corrupt model artifacts.
- Prevented queued experiment cancellation from being overwritten by runner startup.

These changes are included in `AI_Based_Load_Balancing_v1.0.7.zip`.

## Known limitations

- Academic identity and signature fields require student/institution input.
- Word and PowerPoint visual validation requires Microsoft Office or another compatible renderer.
- Multi-process policy concurrency remains untested.
- Missing-model and stale-telemetry experiment scenarios remain operator-injected.
- Clean archive installation was verified, but clean model provisioning was not.
- The project is an academic prototype, not a production security certification.
