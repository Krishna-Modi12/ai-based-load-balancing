# Deployment and Security Audit

## Deployment evidence

Compose syntax passed and Docker Engine was available. Workers, database, and frontend images were buildable. The API smoke start was blocked by an initialized PostgreSQL volume retaining a different `loadbalancer` password. Changing `POSTGRES_PASSWORD` does not change an existing cluster password.

The documented setup needs an explicit disposable clean-volume path and a warning that volume deletion destroys local database data. A clean-volume CI smoke test would make this reproducible.

## Positive controls

- Registered backend URLs prevent arbitrary client-supplied upstream targets.
- Redirects are disabled.
- Proxy timeouts are configured.
- Admin token protects most state-changing operations.
- Worker failures/timeouts and disabled/stale nodes are handled.
- Request bodies are not persisted.
- Secrets are environment-supplied and `.env` is ignored.
- Database is internal to Compose; API/frontend are localhost-exposed.

## Findings

| Priority | Finding | Remediation |
|---|---|---|
| High | Default direct-run token is `change-me` | Refuse insecure defaults outside explicit development mode |
| High | Experiment creation is unauthenticated | Apply admin dependency |
| Medium | No rate limiting or resource limits | Bound training, experiments, request size, and concurrency |
| Medium | No circuit breaker or periodic health scheduler | Add quarantine and scheduled checks |
| Medium | Global policy state is not multi-process safe | Persist or centralize policy |
| Medium | Narrow model-load exception handling | Catch documented deserialization/runtime failures and preserve diagnostics |
| Low | No admin audit log | Record state-changing actor, action, and timestamp |

This is an engineering audit, not a security certification or penetration test.
