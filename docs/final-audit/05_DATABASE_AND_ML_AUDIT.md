# Database and ML Audit

## Database

SQLAlchemy models and Alembic migrations cover backends, telemetry, routing decisions, model versions, experiments, raw samples, and aggregate metrics. The API image runs `alembic upgrade head` before Uvicorn. SQLite-backed tests passed; PostgreSQL runtime evidence is historical and was not reproduced because the existing volume rejected the supplied password.

The initial migration relies on `Base.metadata.create_all()`, which is acceptable for a starter project but weaker than explicit controlled schema evolution. Operational indexes and an explicit volume credential-rotation procedure should be added.

## ML

- Model: `RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=1)`.
- Features: CPU, memory, active requests, latency EWMA, network RTT, error rate, capacity weight, request class.
- Minimum training set: 20 successful calibration decisions.
- Chronological 80/20 split.
- MAE/RMSE and feature schema are persisted.
- Missing, invalid, negative, non-finite, or unsafe predictions fall back to Least Connections.

## ML limitations

- The active artifact is loaded on the request path for each route.
- Latest telemetry is queried for candidates on the request path.
- Model age/staleness is not enforced.
- Model history and activation APIs are absent.
- Training coverage depends on prior routing policy.
- Training has no overlap lock or rate limit.
- The release archive excludes model artifacts, so clean-checkout AI reproducibility is partial.
