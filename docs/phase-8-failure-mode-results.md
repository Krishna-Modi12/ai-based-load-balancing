# Phase 8 — Failure-Mode Results

These tests were executed after the normal-performance matrix and are not
included in its aggregates. Each test used the live Docker Compose stack,
the persisted PostgreSQL database, and the configured admin token. Worker
containers and the API were restored after each injection.

| Scenario | Repetitions | Requests each | Observed result |
|---|---:|---:|---|
| Backend disabled through API | 3 | 10 | 10/10 successful per repetition; disabled worker absent from routing; recovery health check passed |
| Worker returns HTTP 503 | 3 | 12 | 8 successful and 4 API 502 responses per repetition; worker recovery passed |
| Worker exceeds 3-second proxy timeout | 3 | 6 | 4 successful and 2 API 502 responses per repetition; each run took about 6.4 seconds; recovery passed |
| AI model unavailable | 3 | 5 | 5/5 successful per repetition; 5/5 used the recorded AI fallback |
| Telemetry stale | 3 | 1 | 503 `NO_HEALTHY_BACKENDS` on every attempt; health refresh and configuration recovery passed |

## Injection and recovery procedures

* **Disabled backend:** `PATCH /api/v1/backends/{id}` set `enabled=false`.
  The remaining healthy backends served requests. The backend was re-enabled
  and health-checked after every repetition.
* **Worker 503:** worker-b was recreated with `FAIL_MODE=true` after a
  successful health refresh. Round Robin continued to select it periodically,
  and the proxy mapped its HTTP 503 to `502 UPSTREAM_REQUEST_FAILED`. The
  worker was recreated with `FAIL_MODE=false` and rechecked.
* **Timeout:** worker-b was recreated with `BASE_DELAY_MS=5000`, above the
  API's three-second proxy timeout. The resulting upstream timeout was mapped
  to API 502. The delay was restored to 60 ms.
* **Missing model:** the mounted `.joblib` artifact was renamed temporarily,
  not deleted. AI requests succeeded through the documented Least Connections
  fallback with `MODEL_UNAVAILABLE`; the artifact was restored.
* **Stale telemetry:** the API was recreated with
  `TELEMETRY_STALE_SECONDS=1`. After a health refresh and a two-second wait,
  routing returned 503 because all observations were stale. The API was
  recreated with a long benchmark-safe freshness value and health was
  refreshed.

The failure tests demonstrate safe exclusion, explicit error mapping,
fallback, and recovery. They do not measure recovery time at production
scale, and they do not prove that every possible network or process failure
will be detected immediately.
