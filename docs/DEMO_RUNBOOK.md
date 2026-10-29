# Demonstration Runbook

## Prerequisites

* Docker Desktop is running.
* PowerShell is open in the repository root.
* `.env` exists and contains local values for `ADMIN_TOKEN` and
  `POSTGRES_PASSWORD`. Never share these values.

## 1. Start and check the stack

```powershell
docker compose -f deployment\docker-compose.yml up --build -d
docker compose -f deployment\docker-compose.yml ps
Invoke-RestMethod http://localhost:8000/health/live
Invoke-RestMethod http://localhost:8000/health/ready
$h=@{"X-Admin-Token"=$env:ADMIN_TOKEN}
Invoke-RestMethod http://localhost:8000/api/v1/backends
Invoke-RestMethod http://localhost:8000/api/v1/models/status
```

The expected services are `db`, `api`, `frontend`, `worker-a`, `worker-b`,
and `worker-c`. If health observations are missing, run:

```powershell
Invoke-RestMethod http://localhost:8000/api/v1/backends/health-check-all -Method Post -Headers $h
```

## 2. Open the dashboard

Open <http://localhost:5173>. Explain the backend health cards, recent routing
decisions, active policy, model status, and persisted experiment comparison.
The dashboard labels worker telemetry as simulated.

## 3. Demonstrate the three policies

Set a policy and send requests through the registered-backend-only route:

```powershell
Invoke-RestMethod http://localhost:8000/api/v1/policies -Method Post -Headers $h `
  -ContentType application/json -Body '{"policy":"round_robin"}'
1..6 | ForEach-Object { Invoke-RestMethod "http://localhost:8000/api/v1/route?request_class=normal" |
  Select-Object backend,policy,actual_latency_ms,fallback_reason }

Invoke-RestMethod http://localhost:8000/api/v1/policies -Method Post -Headers $h `
  -ContentType application/json -Body '{"policy":"least_connections"}'
1..6 | ForEach-Object { Invoke-RestMethod "http://localhost:8000/api/v1/route?request_class=heavy" |
  Select-Object backend,policy,actual_latency_ms }

Invoke-RestMethod http://localhost:8000/api/v1/policies -Method Post -Headers $h `
  -ContentType application/json -Body '{"policy":"ai_latency"}'
1..6 | ForEach-Object { Invoke-RestMethod "http://localhost:8000/api/v1/route?request_class=mixed" |
  Select-Object backend,policy,predicted_latency_ms,ai_inference_latency_ms,fallback_reason }
```

The AI policy can report a prediction and inference time. If its validated
artifact is unavailable, the response remains serviceable and reports
`MODEL_UNAVAILABLE` or `MODEL_INFERENCE_FAILED` fallback.

## 4. Demonstrate failure handling

Disable one registered backend, observe that it is excluded, then restore it:

```powershell
$nodes=Invoke-RestMethod http://localhost:8000/api/v1/backends
$b=$nodes | Where-Object name -eq "worker-b"
Invoke-RestMethod "http://localhost:8000/api/v1/backends/$($b.id)" -Method Patch -Headers $h `
  -ContentType application/json -Body '{"enabled":false}'
1..5 | ForEach-Object { Invoke-RestMethod http://localhost:8000/api/v1/route |
  Select-Object backend,policy }
Invoke-RestMethod "http://localhost:8000/api/v1/backends/$($b.id)" -Method Patch -Headers $h `
  -ContentType application/json -Body '{"enabled":true}'
Invoke-RestMethod http://localhost:8000/api/v1/backends/health-check-all -Method Post -Headers $h
```

Do not inject worker failure during a benchmark. The measured failure results
are already recorded in `docs/phase-8-failure-mode-results.md`.

## 5. Show measured evidence

Open:

* `docs/phase-7-benchmark-results.md`
* `docs/charts/phase7-results.svg`
* `docs/phase-8-analysis.md`
* `docs/phase-8-failure-mode-results.md`

Explain that AI routing was slower and lower-throughput in all four tested
profiles. This is the measured result, not a claim that AI routing is always
inferior.

## 6. Run validation

```powershell
$env:ADMIN_TOKEN="change-me"
$env:DATABASE_URL="sqlite:///./phase9-test.sqlite3"
$env:PYTHONPATH=(Resolve-Path .\backend).Path
python -m pytest -q .\backend\tests
npm --prefix .\frontend run build
```

## Troubleshooting and cleanup

* API unavailable: `docker compose -f deployment\docker-compose.yml logs api`.
* Database not ready: wait for `deployment-db-1` to become healthy; do not
  remove the named volume.
* Workers not eligible: run the health-check-all command above.
* Frontend cannot reach API: verify `deployment-frontend-1` and
  `http://localhost:5173`.
* Preserve benchmark records with `docker compose ... stop` or
  `docker compose ... down`; never use `down -v`.
