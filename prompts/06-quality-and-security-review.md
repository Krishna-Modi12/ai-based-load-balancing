# Antigravity Prompt 06 — Hardening and release gate

Perform a senior-engineer review against all SRS, architecture, security and evaluation docs. Do not immediately rewrite everything; first produce a ranked defect list with severity and concrete evidence. Then fix the critical/high items in small patches.

Check:
- proxy SSRF protection and registered-upstream-only routing;
- request timeouts, allowed methods/paths/headers, request size limits, redirect handling and error semantics;
- health checker lifecycle, stale status, in-flight request accounting, task cleanup and shutdown;
- database migrations, transactions, indexes, connection lifecycle and error behaviour;
- auth/permission checks on all mutating endpoints, CORS, secret leaks and log contents;
- model artifact loading, dependency/version compatibility, feature schema, invalid predictions, stale data and fallback;
- race conditions in switching policies or marking a worker unhealthy;
- frontend type safety, API errors, empty/error/loading/stale states, keyboard accessibility and responsive layout;
- unit/integration/browser tests, Docker clean start, CI and README accuracy;
- benchmark reproducibility, raw data retention, and claims versus evidence.

Run all checks that the current environment supports, capture exact commands and outputs, fix failures, and distinguish tests not run from tests passed. Do not claim production security certification. Produce a release checklist, known issues, and a short evidence summary.
