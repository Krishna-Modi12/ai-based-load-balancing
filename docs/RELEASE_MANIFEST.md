# Release Manifest

## Version mapping

- `v1.0.0` is the code-release tag.
- `AI_Based_Load_Balancing_v1.0.0.zip` is the archive produced from that code-release state.
- `v1.0.1` is the later submission-package tag that includes the archive and academic materials.

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
