# Phase 7 — Benchmark Results

## Scope and validity

The complete normal-performance matrix was executed against the local
Docker Compose stack after PostgreSQL persistence and API readiness were
verified:

* 3 policies: `round_robin`, `least_connections`, `ai_latency`
* 4 profiles: `uniform`, `heterogeneous`, `bursty`, `mixed`
* 3 repetitions per policy/profile pair
* 30-second measurement, 5-second warm-up, concurrency 4
* 36 planned, 36 completed, 0 failed, 0 interrupted
* 100% request success in the valid batch

The first two 36-run attempts are retained in PostgreSQL but excluded from
these comparisons because they produced `503 NO_HEALTHY_BACKENDS` responses
while telemetry freshness was being diagnosed. They are not silently treated
as normal-performance results.

The valid run used a 3600-second telemetry freshness window for the bounded
matrix. This prevents the 30-second measurement window from expiring health
observations while preserving the explicit stale-telemetry failure scenario.
Worker delays are simulated service delays, not Internet or physical-network
measurements.

## Reproduction

From the repository root, with the Compose stack and persisted database
running:

```powershell
$env:ADMIN_TOKEN="replace-with-local-admin-token"
$env:POSTGRES_PASSWORD="replace-with-local-db-password"
$env:TELEMETRY_STALE_SECONDS="3600"
$env:PYTHONPATH=(Resolve-Path .\backend).Path
python -m app.experiment_cli --matrix --duration 30 --warmup 5 --concurrency 4 --repetitions 3 --wait 2
```

The authoritative raw observations remain in the PostgreSQL
`experiment_runs.raw_results_json` records. Each run also has an API export:

```powershell
Invoke-WebRequest "http://localhost:8000/api/v1/experiments/<RUN_ID>/export?format=json"
Invoke-WebRequest "http://localhost:8000/api/v1/experiments/<RUN_ID>/export?format=csv"
```

The persisted records include the run configuration, policy, profile,
repetition, seed, timestamps, status, raw samples, aggregate metrics, and
per-backend distributions. `docs/charts/phase7-results.svg` is a compact visual summary of the measured
P95 values.

## Aggregate results

Values below are means across the three repetitions. Latencies are
milliseconds; throughput is successful requests per second; error rate is
errors divided by all measured requests.

| Profile | Policy | Requests | P50 | P95 | P99 | Throughput | Error rate |
|---|---|---:|---:|---:|---:|---:|---:|
| uniform | round_robin | 5,200 | 66.349 | 101.793 | 121.655 | 57.778 | 0.000 |
| uniform | least_connections | 5,504 | 58.216 | 113.226 | 127.259 | 61.156 | 0.000 |
| uniform | ai_latency | 1,019 | 292.014 | 628.114 | 864.003 | 11.322 | 0.000 |
| heterogeneous | round_robin | 4,463 | 66.059 | 208.071 | 230.158 | 49.589 | 0.000 |
| heterogeneous | least_connections | 5,072 | 60.490 | 145.489 | 230.958 | 56.356 | 0.000 |
| heterogeneous | ai_latency | 1,020 | 316.042 | 661.133 | 813.602 | 11.333 | 0.000 |
| bursty | round_robin | 3,592 | 68.280 | 112.783 | 137.384 | 39.911 | 0.000 |
| bursty | least_connections | 3,808 | 60.040 | 115.255 | 134.403 | 42.311 | 0.000 |
| bursty | ai_latency | 865 | 328.262 | 583.311 | 712.816 | 9.611 | 0.000 |
| mixed | round_robin | 4,500 | 66.756 | 207.806 | 231.465 | 50.000 | 0.000 |
| mixed | least_connections | 5,116 | 61.022 | 135.841 | 229.689 | 56.844 | 0.000 |
| mixed | ai_latency | 1,010 | 317.892 | 616.824 | 739.085 | 11.222 | 0.000 |

Round Robin distributed requests approximately evenly across worker-a,
worker-b, and worker-c. Least Connections favored the higher-capacity
worker-a, with the remaining traffic split between the other workers. In
this run the AI policy selected worker-a for all successful requests, which
limited throughput and produced higher latency than both baselines.

## AI observations

Across the valid AI runs, mean prediction MAE/RMSE were:

| Profile | MAE (ms) | RMSE (ms) |
|---|---:|---:|
| uniform | 165.279 | 198.315 |
| heterogeneous | 174.701 | 206.411 |
| bursty | 124.507 | 161.801 |
| mixed | 176.897 | 206.991 |

The baseline policies do not emit model predictions, so their MAE/RMSE are
not applicable. No model-tuning or retraining used outcomes from these
evaluation runs. No fallback count was observed in the valid batch; the
separate missing-model and stale-telemetry scenarios remain failure-mode
tests, not normal-performance comparisons.

## Conclusion and limitations

Under this exact local workload and model artifact, the evidence does **not**
support a measurable advantage for AI routing. AI latency had zero measured
errors, but its P50/P95/P99 latency and throughput were substantially worse
than both baselines in all four profiles. This is an observed result for the
current model, worker-delay configuration, concurrency, and Docker host; it
is not a universal claim about AI routing.

The comparison is limited by the local Docker environment, simulated
backend delays, one trained Random Forest artifact, one concurrency level,
three repetitions, and the AI policy's observed concentration on worker-a.
The invalid earlier batches remain useful operational evidence of stale
telemetry handling but must not be pooled with this matrix.
