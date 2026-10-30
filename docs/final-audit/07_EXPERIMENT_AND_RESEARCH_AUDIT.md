# Experiment and Research Audit

## Framework verification

The runner supports bounded duration, warm-up, concurrency, request rate, deterministic seeds, four workload profiles, raw samples, p50/p95/p99, throughput, error/timeout counts, distribution/CV/Jain metrics, prediction MAE/RMSE, and JSON/CSV export.

## Important scenario gap

The schema accepts `none`, `node_failure`, `stale_telemetry`, `missing_model`, and `timeout`. The runner explicitly handles node failure and partially skips refresh for stale telemetry, but it does not itself remove a model artifact, change worker delay, or guarantee stale telemetry for the other scenarios. Those conditions were manually injected in the historical Phase 8 evaluation. Reports must distinguish operator-injected tests from runner-automated scenarios.

Concurrent experiment workers can change the process-global policy and interfere with each other.

## Historical benchmark conclusion

The recorded valid batch was 36/36 runs with zero errors. Mean client latency was approximately 75.498 ms for Round Robin, 68.545 ms for Least Connections, and 359.527 ms for AI. AI inference p50 was approximately 52.041 ms. AI was slower and lower-throughput in all tested profiles.

These are historical local Docker measurements, not independently reproduced during this audit. The conclusion is appropriately limited by simulated delays, one artifact, one tested concurrency level, three repetitions, and no statistical-significance claim.
