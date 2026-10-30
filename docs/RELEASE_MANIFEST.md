# Release Manifest

## Version mapping

- `v1.0.0` is the code-release tag.
- `AI_Based_Load_Balancing_v1.0.0.zip` is the archive produced from that code-release state.
- `v1.0.1` is the later submission-package tag that includes the archive and academic materials.
- `AI_Based_Load_Balancing_v1.0.2.zip` and `AI_Based_Load_Balancing_v1.0.3.zip` are preserved historical submission candidates.
- `AI_Based_Load_Balancing_v1.0.4.zip` contains the frontend hardening commit `3f49f6f`.
- `AI_Based_Load_Balancing_v1.0.5.zip` is a preserved release candidate containing the in-memory-only admin-token correction from `2dc6361`.
- `AI_Based_Load_Balancing_v1.0.6.zip` is the current final release candidate with the latest release-manifest and audit consistency updates.

The archive name is intentionally unchanged so historical references remain
stable. Use the tag, not the filename alone, when identifying the complete
submission package.

## Reproducibility

1. Copy `.env.example` to `.env` and set unique local values.
2. Start PostgreSQL and the Compose services.
3. Run Alembic through the API image.
4. Generate at least 20 successful calibration decisions.
5. Train a model through `POST /api/v1/models/train`.

Model artifacts and local database volumes are environment-specific and are
not included in the archive. This is a reproducibility prerequisite, not a
claim that a clean archive contains an active model.

## Current release verification

- Current archive: `AI_Based_Load_Balancing_v1.0.6.zip`
- Archive contents: 113 files
- Excludes `.env`, local databases, `node_modules`, build caches, logs, and nested archives.
- Backend tests: 25 passed.
- Frontend production build: passed.
- Latest live Playwright smoke: dashboard load, health check, demo request, zero failed requests, zero browser errors.
