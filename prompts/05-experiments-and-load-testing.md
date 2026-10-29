# Antigravity Prompt 05 — Reproducible experiments

Implement the experiment runner and load-testing setup using `docs/06-ml-methodology.md` and `docs/07-test-and-evaluation.md`.

Use Locust to create bounded scenarios for uniform traffic, heterogeneous worker capacity, bursty traffic, mixed light/normal/heavy workload, node failure, stale telemetry and missing-model fallback. All traffic must target only our local test app or an explicit configured test target. Provide duration, concurrency/rate, warm-up, seed, workload profile, and policy as saved run parameters.

For each run, persist raw counts and aggregate p50/p95/p99 latency, successful throughput, errors/timeouts, backend distribution, balance CV, and optional Jain fairness with the measured quantity defined. Save the exact environment and config. Provide CSV/JSON export and a Python script to render comparison charts from exports. Do not hard-code expected outcomes, and never silently compare different run configurations. Mark synthetic worker delays as simulated.

Run at least smoke tests, then a controlled short benchmark if resources permit. If no real run can be executed, deliver the harness and test it on a small local run, clearly stating the limitation. Never fill the final report with fabricated values.
