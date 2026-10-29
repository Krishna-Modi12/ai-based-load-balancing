# Phase 7 — Experimental Methodology

Phase 7 compares Round Robin, Least Connections, and AI latency routing using
matched, repeated measurements from the local Docker Compose stack. The
framework stores experiment configuration, raw request observations, aggregate
metrics, model metadata, and run status in PostgreSQL. Warm-up requests are
discarded; measurement requests are retained and exported.

The default matrix contains four profiles (`uniform`, `heterogeneous`,
`bursty`, and `mixed`) crossed with three policies and three repetitions.
Separate failure scenarios cover backend failure/recovery and unavailable-model
fallback. Worker delays are controlled simulation parameters and are not
presented as production network measurements.

Each run records total, successful, failed, and timed-out requests; throughput;
mean and p50/p95/p99 client-observed latency; error rate; and per-backend
request distribution. AI prediction MAE/RMSE, prediction failures, fallback
count, model version, and telemetry freshness are recorded separately from
client latency. Training data is collected before evaluation and evaluation
outcomes are not used to train the model.

Reproduce the matrix from the repository root with a healthy Compose stack:

```powershell
$env:ADMIN_TOKEN="replace-with-local-token"
$env:PYTHONPATH=(Join-Path (Get-Location) "backend")
python -m app.experiment_cli --matrix --duration 30 --warmup 5 --concurrency 4
```

The complete methodology, limitations, and export endpoints are also
described in `docs/phase-7-experiment-methodology.md`.
