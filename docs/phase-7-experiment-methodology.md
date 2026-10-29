# Phase 7 — Experiment methodology and results

## Status

The Phase 7 harness is implemented, but no benchmark result is reported by
this document until a controlled run is executed against the local Compose
stack. All result cells are therefore **pending**. This is intentional: the
project does not fabricate performance claims.

## Experimental unit

An experiment run stores one policy, workload profile, failure scenario, and
repetition. The default matrix is three policies (`round_robin`,
`least_connections`, `ai_latency`) × four profiles (`uniform`,
`heterogeneous`, `bursty`, `mixed`) × three repetitions. Every run stores its
configuration, warm-up, seed, raw request observations, aggregate metrics, and
timestamps in PostgreSQL.

Profiles select controlled request classes:

| Profile | Request mix |
|---|---|
| uniform | 100% normal |
| heterogeneous | 25% light / 50% normal / 25% heavy |
| bursty | normal requests with short burst pauses |
| mixed | 20% light / 60% normal / 20% heavy |

Synthetic worker delays remain explicitly simulated by the worker service.
They are not presented as network measurements.

## Measurements

The runner records actual client-observed latency, HTTP status, timeout/error
type, selected backend, and policy metadata. Overall aggregates include
request count, successful throughput, error and timeout counts, p50/p95/p99,
error rate, backend distribution, balance coefficient of variation, and Jain
fairness. AI fields are separate from client latency: prediction percentiles,
prediction MAE/RMSE against measured upstream latency, and model-selection
inference p50 are populated only when the API returns those observations.

Warm-up requests are discarded. No missing value is replaced with zero.
Comparisons must use the same target, duration, warm-up, concurrency, seed
policy, backend configuration, and failure scenario.

## Failure scenarios

`node_failure` temporarily disables one enabled backend and restores it after
the run. `stale_telemetry`, `missing_model`, and `timeout` are separate
scenarios whose observed failures/fallbacks are recorded; they are not claimed
as successful unless the configured environment produces the corresponding
measurement. Run notes should record any precondition that was unavailable.

## Reproduction

With Docker Desktop running and the stack healthy:

```powershell
cd "C:\Users\krish\OneDrive\Desktop\CN Project\ai_load_balancer_starter"
$env:ADMIN_TOKEN="replace-with-local-token"
python -m pip install -r backend\requirements.txt
$env:PYTHONPATH=(Join-Path (Get-Location) "backend")
python -m app.experiment_cli --matrix --duration 30 --warmup 5 --concurrency 4
```

The CLI creates and starts each run through the API, waits for completion, and
leaves raw data in PostgreSQL. Results are available through the dashboard or:

```powershell
Invoke-WebRequest http://localhost:8000/api/v1/experiments
Invoke-WebRequest "http://localhost:8000/api/v1/experiments/<RUN_ID>/export?format=json"
Invoke-WebRequest "http://localhost:8000/api/v1/experiments/<RUN_ID>/export?format=csv"
```

For a bounded Locust smoke check, use
`locust -f load_testing\locustfile.py --headless -u 4 -t 30s --host http://localhost:8000`.

## Results

| Profile | Policy | Repetition | Requests | Throughput | P50 | P95 | P99 | Error rate | Notes |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| all | all | 1–3 | **pending** | **pending** | **pending** | **pending** | **pending** | **pending** | Execute the matrix above |
