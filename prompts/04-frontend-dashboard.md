# Antigravity Prompt 04 — Dashboard UI

Read the SRS/API contract and build a clean, premium, responsive dashboard using React + TypeScript + Vite, Tailwind CSS and Recharts (or one equivalent charting library). Keep the UI accessible and data-driven; don't hard-code fake live metrics. Use an API client module with typed response contracts and environment-based API base URL.

Required pages/views:
1. Overview: total requests, throughput, p95 latency, success/error rate, active policy, model readiness, healthy/total backends.
2. Backends: name, health, capacity, active requests, CPU/memory, latency EWMA, last health check; clear stale/unknown/degraded states.
3. Routing decisions: recent worker choices, policy, predicted vs actual latency, model version, failure/fallback reason; pagination/filtering.
4. Experiments: create/select an experiment profile, view status, compare RR/LC/AI results on matched profiles, chart p50/p95/p99, throughput, error rate and distribution, export CSV/JSON.
5. Model & settings: training state, sample count, validation MAE/RMSE, active version, feature schema, explicit fallback warning. Protect mutating controls.

Design direction: technical observability console, not a generic marketing page. Clear visual hierarchy, good spacing, legible charts, responsive sidebar/header, restrained colors, status badges and concise labels. Include loading, empty, error, and stale-data states. Do not invent data; provide a separate clearly marked “demo seed/simulation” state if the API indicates data is simulated. Never put database credentials or admin secrets in the browser bundle/localStorage.

Add component/API tests where feasible and run frontend lint/typecheck/build/tests. Verify a real API integration if the stack is available; if not, state what was mocked. Update screenshots only from an actual run. Summarize files and verification outcomes.
