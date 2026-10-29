# Phase 7 — Benchmark Results

## Status: pending complete controlled matrix

The Phase 7 experiment framework is implemented and validated, but the
complete 36-run matrix has not been executed. This document contains no
fabricated benchmark values and makes no claim that AI routing outperforms
either baseline.

Measured implementation smoke runs:

| Policy | Profile/scenario | Requests | Status |
|---|---|---:|---|
| Round Robin | uniform | 55 | completed |
| Least Connections | node failure | 10 | completed |
| AI latency | mixed | 5 | completed |

These smoke runs are implementation checks, not statistically sufficient
comparisons. Execute the full matrix before reporting performance differences.

```powershell
$env:ADMIN_TOKEN="replace-with-local-token"
$env:PYTHONPATH=(Join-Path (Get-Location) "backend")
python -m app.experiment_cli --matrix --duration 30 --warmup 5 --concurrency 4
```

Completed runs persist in PostgreSQL and can be exported from:

```powershell
Invoke-WebRequest "http://localhost:8000/api/v1/experiments/<RUN_ID>/export?format=json"
Invoke-WebRequest "http://localhost:8000/api/v1/experiments/<RUN_ID>/export?format=csv"
```

Until the complete repeated matrix is executed and raw exports are retained,
throughput, P50/P95/P99 latency, error rate, request distribution, and AI
MAE/RMSE remain unreported.
