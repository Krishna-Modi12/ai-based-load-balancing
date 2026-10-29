# Verified implementation plan

Status: **core vertical slice implemented on 29 October 2026; experiments remain pending.** This plan does not claim performance results.

## Research decisions

- NGINX documents Round Robin, Least Connections, and response-time-aware methods. We retain Round Robin as the conventional baseline and Least Connections as the load-aware baseline. [NGINX HTTP load balancing](https://nginx.org/en/docs/http/load_balancing.html)
- The predictor is a `RandomForestRegressor`, a tree ensemble suited to small tabular telemetry data. It is trained off the proxy path and the artifact stores its ordered feature schema. [scikit-learn ensemble guide](https://scikit-learn.org/stable/modules/ensemble.html)
- Locust user classes and weighted tasks allow repeatable mixtures of light, normal, and heavy locally generated requests. [Locust writing guide](https://docs.locust.io/en/stable/writing-a-locustfile.html)
- The MVP is explicitly Layer 7 HTTP proxying. Mininet/SDN is a separately scoped future extension.

## Architecture decisions

The router only selects enabled, registered nodes whose manual/periodic health observation is `healthy`. It never accepts a destination URL in a client request. A request is forwarded with HTTPX, a finite timeout, no redirects, a generated correlation ID, and a single demo route. Decisions record the policy, candidate-selected node, feature vector, actual duration, HTTP status, model ID, and any fallback reason.

AI routing scores a feature vector per healthy node: CPU, memory, active work, latency EWMA, probe RTT, error rate, capacity, and a controlled request class. No post-dispatch latency is included as a feature. If the model does not load, the schema differs, a score is non-finite/out of range, or inference raises, routing falls back to Least Connections and records why.

## Delivered phases and acceptance evidence

| Phase | Scope | Acceptance check |
|---|---|---|
| 0 | Documentation audit, research, config and Compose | `docs/` and `prompts/` retained; `.env.example` has no secret |
| 1 | Three configurable workers and registered-only HTTP proxy | `GET /api/v1/route` returns worker identity after health checks |
| 2 | SQLAlchemy persistence and Alembic initial revision | decisions, telemetry, models, experiments have tables |
| 3 | RR, Least Connections, safe AI fallback | `pytest` policy tests |
| 4 | Calibration-derived Random Forest training | collect at least 20 successful decisions, then call protected training endpoint |
| 5 | Live React dashboard | dashboard displays only API responses and identifies local worker metrics as simulated |
| 6 | Controlled evaluation | pending: run matching Locust profiles and export raw data; do not add results to report yet |

## Execution sequence

1. Copy `.env.example` to `.env` and replace `ADMIN_TOKEN`.
2. Run `docker compose -f deployment/docker-compose.yml up --build`.
3. Perform `POST /api/v1/backends/health-check-all` with `X-Admin-Token`; verify all three workers become healthy.
4. Set each policy through `POST /api/v1/policies`, send a matched Locust workload, and save its raw output per run.
5. Use Round Robin calibration traffic across heterogeneous workers until 20+ recorded successful decisions exist. Train with `POST /api/v1/models/train`; record returned MAE/RMSE without treating it as routing benefit.
6. Compare repeated, fixed-duration RR, LC, and AI runs in randomized order. Record machine/software versions, worker profiles, policy, seed, timing, and raw output before writing the final report.

## Risks remaining

Health checks are manual in this vertical slice; add a bounded scheduled collector before calling it a finished release. The dashboard is an operational overview; experiments/CSV export need completing in Phase 6. The local worker signals are synthetic and must not be presented as production CPU/network measurements. Docker Desktop was unavailable in this workstation session, so Compose was configuration-validated but not started here.
