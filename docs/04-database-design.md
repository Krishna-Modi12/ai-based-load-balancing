# 4. Database Design

Use PostgreSQL, SQLAlchemy 2.x, and Alembic migrations. All primary keys should be UUIDs or another consistent key scheme. Store timestamps as timezone-aware UTC values. Use indexes aligned with experiment and timeline queries.

## 4.1 Core entities

### `backend_nodes`
- `id` (PK)
- `name` (unique)
- `base_url` (unique; only operators can change it)
- `capacity_weight` (positive numeric)
- `enabled` (boolean)
- `health_status` (`unknown | healthy | unhealthy | disabled`)
- `last_health_at` (nullable timestamp)
- `created_at`, `updated_at`

### `telemetry_samples`
- `id` (PK)
- `backend_id` (FK → backend_nodes.id)
- `sampled_at`
- `cpu_percent`, `memory_percent` (nullable numeric)
- `active_requests` (non-negative integer)
- `latency_ewma_ms` (nullable numeric)
- `network_rtt_ms` (nullable numeric)
- `error_rate` (0–1 numeric)
- `success_rate` (0–1 numeric)
- `telemetry_source` (`worker_metrics | probe | simulated`)

Indexes: `(backend_id, sampled_at DESC)`, `(sampled_at DESC)`. Keep simulated data explicitly labelled.

### `routing_decisions`
- `id` (PK)
- `request_id` (unique correlation ID)
- `decided_at`
- `policy` (`round_robin | least_connections | ai_latency`)
- `selected_backend_id` (nullable FK → backend_nodes.id, to preserve failed/no-route events)
- `model_version_id` (nullable FK → model_versions.id)
- `predicted_latency_ms` (nullable numeric)
- `actual_latency_ms` (nullable numeric)
- `status_code` (nullable integer)
- `success` (boolean)
- `request_class` (short controlled category, not raw URL or body)
- `fallback_reason` (nullable short enum/text)
- `failure_type` (nullable short enum)

Indexes: `(decided_at DESC)`, `(policy, decided_at DESC)`, `(selected_backend_id, decided_at DESC)`.

### `experiment_runs`
- `id` (PK)
- `name`
- `policy`
- `workload_profile`
- `configuration_json` (JSONB; include concurrency, request rate, duration, worker profile and seed)
- `status` (`queued | running | completed | failed | cancelled`)
- `started_at`, `ended_at`
- `notes` (nullable)

### `experiment_metrics`
- `id` (PK)
- `experiment_id` (FK → experiment_runs.id)
- `backend_id` (nullable FK)
- `metric_scope` (`overall | backend`)
- `request_count`, `success_count`, `error_count`
- `throughput_rps`
- `latency_p50_ms`, `latency_p95_ms`, `latency_p99_ms`
- `mean_cpu_percent`, `mean_memory_percent`
- `load_balance_cv` (nullable numeric)
- `fairness_jain` (nullable numeric)
- `created_at`

### `model_versions`
- `id` (PK)
- `version` (unique)
- `algorithm_name`
- `artifact_uri` (path or object key, not an arbitrary public URL)
- `trained_at`
- `training_sample_count`
- `feature_schema_version`
- `train_start_at`, `train_end_at`
- `validation_mae_ms`, `validation_rmse_ms`
- `evaluation_json` (JSONB)
- `is_active` (boolean; ensure only one active version through application logic or a partial unique index)

### Optional `audit_events`
Record who changed a routing mode, worker configuration, model activation, or experiment control setting. Do not store secrets in audit payloads.

## 4.2 Relationship summary
- One backend has many telemetry samples and routing decisions.
- One experiment has many aggregate metric rows (overall plus optional per-backend rows).
- One model version can be referenced by many routing decisions.

## 4.3 Data lifecycle
Use a configurable retention policy for high-frequency telemetry. Keep experiment summaries longer than raw samples. Include a command to export and purge old telemetry. Any purge must preserve aggregate experiment results needed for the report.

## 4.4 Data quality rules
- Clamp percentages to `[0, 100]`; rates to `[0, 1]`; latency must be non-negative.
- Reject negative active-request counts and invalid capacity weights.
- Treat unavailable metrics as `NULL`, not zero.
- Do not compare experiments if workload definitions differ without declaring the difference.
