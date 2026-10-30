# API and Backend Audit

## Implemented route inventory

### Health and system

`GET /health/live`, `GET /health/ready`, `GET /api/v1/system/status`

### Backends

`GET /api/v1/backends`, `POST /api/v1/backends`, `PATCH /api/v1/backends/{backend_id}`, `POST /api/v1/backends/{backend_id}/health-check`, `POST /api/v1/backends/health-check-all`

### Routing and models

`GET /api/v1/route`, `POST /api/v1/policies`, `GET /api/v1/decisions`, `GET /api/v1/models/status`, `POST /api/v1/models/train`

### Experiments

`POST /api/v1/experiments`, `GET /api/v1/experiments`, `GET /api/v1/experiments/{id}`, `GET /api/v1/experiments/{id}/results`, `GET /api/v1/experiments/{id}/status`, `POST /api/v1/experiments/{id}/start`, `POST /api/v1/experiments/{id}/stop`, `GET /api/v1/experiments/{id}/export?format=json|csv`

## Contract gaps

The documented contract also names backend detail, routing-mode GET/PUT, metrics summary/time-series, backend telemetry, model-version listing, and model activation routes. These are absent. The implementation uses `POST /api/v1/policies` instead of the documented routing-mode contract.

Error responses currently use an envelope such as `{"error":{"code":"503","message":"NO_HEALTHY_BACKENDS"}}`; the contract expects semantic codes and a request ID consistently. Proxy correlation IDs are stronger than general API coverage but are not attached uniformly to all errors.

## Backend risks

- `POST /api/v1/experiments` mutates persistent state without admin protection.
- `active_policy` is process-global and not safe for overlapping experiments or multiple API workers.
- Decisions have a bounded `limit`, but no cursor pagination.
- No rate limiting, circuit breaker, request-size limit, or admin audit log exists.
- `load_active_predictor` catches a narrow set of load errors; incompatible joblib/scikit-learn exceptions may escape instead of falling back.
