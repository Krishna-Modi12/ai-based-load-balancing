# Phase 8 — Research Analysis

## Research questions

1. How do Round Robin, Least Connections, and AI latency routing compare under
   four controlled workload profiles?
2. Does the current AI policy reduce client-observed latency or increase
   throughput?
3. What implementation costs and routing behaviour help explain the result?
4. Does the system fail safely and recover when workers, telemetry, or the
   model become unavailable?

The hypotheses were intentionally non-directional. AI routing could improve
tail latency when telemetry predicts a useful distinction between workers,
but inference and state-management overhead could outweigh that benefit.

## Evidence audit

The valid normal-performance batch contains 36 completed PostgreSQL
`experiment_runs`: three policies, four profiles, and three repetitions.
Each run stores its configuration, seed, timestamps, status, raw samples, and
aggregate metrics. The selected batch used a 30-second measurement window,
5-second warm-up, concurrency four, and a 3600-second telemetry freshness
window. All 36 runs had zero request errors.

Two earlier 36-run attempts remain in PostgreSQL and were not deleted. They
were excluded because the 30-second measurement window outlasted the original
telemetry freshness setting and generated `503 NO_HEALTHY_BACKENDS`. Their
status is operationally useful, but pooling them with normal-performance
results would confound a stale-telemetry failure with policy performance.

The valid batch is reported in
`docs/phase-7-benchmark-results.md`; the P95 chart is
`docs/charts/phase7-results.svg`. JSON and CSV exports were verified through
the experiment API. No raw database records were rewritten.

## Quantitative results

The values below are means of the three repetitions. Error rate is
`error_count / request_count`; throughput is successful requests divided by
the 30-second measurement duration. The percentiles are calculated from
client-observed latency samples.

| Profile | Policy | P50 ms | P95 ms | P99 ms | Throughput/s | Error rate |
|---|---|---:|---:|---:|---:|---:|
| uniform | Round Robin | 66.349 | 101.793 | 121.655 | 57.778 | 0 |
| uniform | Least Connections | 58.216 | 113.226 | 127.259 | 61.156 | 0 |
| uniform | AI latency | 292.014 | 628.114 | 864.003 | 11.322 | 0 |
| heterogeneous | Round Robin | 66.059 | 208.071 | 230.158 | 49.589 | 0 |
| heterogeneous | Least Connections | 60.490 | 145.489 | 230.958 | 56.356 | 0 |
| heterogeneous | AI latency | 316.042 | 661.133 | 813.602 | 11.333 | 0 |
| bursty | Round Robin | 68.280 | 112.783 | 137.384 | 39.911 | 0 |
| bursty | Least Connections | 60.040 | 115.255 | 134.403 | 42.311 | 0 |
| bursty | AI latency | 328.262 | 583.311 | 712.816 | 9.611 | 0 |
| mixed | Round Robin | 66.756 | 207.806 | 231.465 | 50.000 | 0 |
| mixed | Least Connections | 61.022 | 135.841 | 229.689 | 56.844 | 0 |
| mixed | AI latency | 317.892 | 616.824 | 739.085 | 11.222 | 0 |

Relative to Round Robin, AI P95 was approximately 517%, 218%, 417%, and 197%
higher for uniform, heterogeneous, bursty, and mixed workloads respectively.
Relative to Least Connections, AI P95 was approximately 455%, 354%, 406%, and
354% higher. AI throughput was lower than Round Robin and Least Connections in
all four profiles. These are descriptive differences across three repetitions,
not claims of statistical significance.

Round Robin was approximately balanced across the three workers. Least
Connections favoured the capacity-two worker-a. In the valid AI batch, the
model selected worker-a for successful requests in each profile, so the
intended adaptive distribution was not observed.

## AI overhead and supported explanations

The implementation provides direct evidence for an additional AI-path cost:

* `proxy_demo` constructs feature rows from SQLAlchemy telemetry queries for
  every eligible backend.
* The active model is loaded and schema-checked through
  `load_active_predictor` on each AI route request.
* `Router.select_ai` performs a Random Forest prediction for every candidate.
* The route records an `ai_inference_latency_ms` measurement.

In the valid matrix, the aggregate AI inference p50 was approximately
52.041 ms across AI runs. The mean recorded client latency was approximately
359.527 ms for AI, compared with 75.498 ms for Round Robin and 68.545 ms for
Least Connections in the same 36-run result window. These measurements
support inference and AI-path request processing as contributors to the
observed slowdown.

The AI prediction MAE/RMSE means were:

| Profile | MAE ms | RMSE ms |
|---|---:|---:|
| uniform | 165.279 | 198.315 |
| heterogeneous | 174.701 | 206.411 |
| bursty | 124.507 | 161.801 |
| mixed | 176.897 | 206.991 |

These errors and the concentration on worker-a are consistent with
prediction/state mismatch as additional plausible explanations. The current
evidence does not isolate how much of the slowdown is caused by SQL query
cost, model loading, prediction cost, or an unsuitable model policy. No
additional instrumentation was inserted into the reported matrix, and no
optimization or retraining was performed after seeing its results.

## Reliability interpretation

Dedicated failure evidence is recorded in
`docs/phase-8-failure-mode-results.md`. The system excluded disabled or stale
backends, mapped direct worker failures and timeouts to API errors, used
Least Connections when the model was missing, and recovered workers after
failure injection. These tests are separate from the performance comparison.

## Limitations and future work

The evidence is local Docker data with simulated worker delays, one trained
Random Forest artifact, one concurrency level, three repetitions, and no
statistical significance analysis. The model was trained from persisted
calibration decisions and was not tuned on evaluation outcomes. The
implementation currently reloads the model and queries telemetry on the
request path; a versioned optimization could cache validated predictors and
use bounded in-memory telemetry snapshots, followed by a new benchmark rather
than a reinterpretation of this baseline.

The defensible conclusion is that this tested AI implementation did not
outperform either conventional baseline under the four evaluated workloads.
That is an empirical finding about this implementation and environment, not a
universal statement about machine learning or load balancing.
