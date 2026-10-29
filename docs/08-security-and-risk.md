# 8. Security, Reliability, and Risk Register

## 8.1 Security controls
- Bind development services to localhost unless deliberately deploying to a trusted network.
- Keep passwords, database URLs, signing keys, and tokens in environment variables; commit only `.env.example` with placeholders.
- Protect configuration, training, model activation, and load-test endpoints with authentication. For a single-user demo, a simple admin token can be adequate if stored securely; never hard-code the token.
- Only proxy to backend URLs registered by an administrator. Do not accept arbitrary upstream URLs from clients; this avoids turning the proxy into an SSRF primitive.
- Restrict allowed paths/methods and request sizes; apply upstream timeouts and a maximum number of redirects (prefer no redirects).
- Forward a small allowlist of headers and strip hop-by-hop headers. Do not store request/response bodies.
- Use CORS allowlists, input validation, bounded pagination, rate limits on costly operations, and non-sensitive error messages.
- Pin compatible dependency versions and review automated vulnerability reports before release.
- Do not expose database/admin secrets to the frontend or browser storage.

## 8.2 Reliability controls
- Health check timeout and period are configurable; define when a worker becomes unhealthy and how it recovers.
- Do not route to unhealthy or disabled workers.
- Use request timeouts and bounded retries. Avoid automatic retries for non-idempotent requests unless explicitly designed; demo traffic should be idempotent GETs.
- Circuit-break repeated failures if implemented; document open/half-open/recovery transitions.
- Make model loading atomic: load and validate a new model before activating it.
- Keep baseline routing available at all times.
- The database and model artifact store need clear startup/readiness behaviour.
- Use graceful shutdown to stop accepting new requests and close HTTP/database clients.

## 8.3 Risk register

| Risk | Likelihood / impact | Mitigation | Evidence |
|---|---|---|---|
| ML learns artificial delay patterns but fails in realistic traffic | Medium / High | Label simulated conditions; evaluate multiple profiles; discuss external validity | Report limitations |
| Training data is biased toward prior router choices | High / High | Controlled calibration traffic; store worker-specific pre-routing samples; inspect coverage | Dataset audit |
| AI policy is slower than simple baselines | Medium / Medium | Measure; retain fallback; publish negative/mixed results honestly | Benchmark table |
| Unhealthy backend still receives traffic during status race | Medium / High | Candidate filtering, short health TTL, bounded timeouts and tests | Failure test |
| One worker gets too much traffic due to telemetry noise | Medium / Medium | EWMA smoothing, bounded scoring, deterministic tie-break, load test | Distribution plot |
| PostgreSQL unavailable | Low / High | Explicit readiness/degraded behaviour; don't silently drop decision logs | DB outage test |
| Unsafe proxy target allows SSRF | Medium / High | Registry-only upstreams; no arbitrary URLs from API callers | Security test/review |
| Test results cannot be reproduced | High / High | Record seeds/configuration, versions, raw exports, and repeat runs | Experiment artifacts |
| Project scope grows too large | High / Medium | Complete core vertical slice before optional Mininet/Prometheus | Milestone checklist |

## 8.4 Privacy and research integrity
Collect only operational metrics needed for the experiment. Do not capture real users' private network traffic. Clearly distinguish local synthetic workloads, simulation data, and measurements from live workers. Cite external algorithms and papers in the report. Do not copy an existing implementation without respecting its license.
