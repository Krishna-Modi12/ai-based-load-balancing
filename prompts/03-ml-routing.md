# Antigravity Prompt 03 — ML-assisted routing

Read `docs/06-ml-methodology.md`, `docs/03-architecture.md`, and `docs/07-test-and-evaluation.md` before coding. Implement ML routing only after the Round Robin and Least Connections paths are correct.

## Required design
- Implement a common policy interface and independent modules for Round Robin, Least Connections, and AI latency prediction.
- Use scikit-learn `RandomForestRegressor` as the first model. Target: observed request latency in milliseconds. Features: CPU%, memory%, active requests, latency EWMA, probe RTT, recent error rate, configured capacity, and a controlled workload class. Define feature names/order in one versioned schema.
- Capture the features from immediately before dispatch and the observed latency after response. Ensure the training dataset is gathered through a clearly marked calibration policy that samples all eligible workers; document the selection-bias risk.
- Add reproducible training/evaluation scripts, explicit split strategy (prefer held-out runs/time blocks), random seed, MAE/RMSE, dataset coverage checks, artifact metadata, and model version persistence.
- Train offline or as a bounded background/admin job, never within every proxy request.
- At inference, filter unhealthy/disabled/stale workers first; reject NaN/infinite/negative/extreme predictions; record model version and per-decision fallback reason.
- On model missing/corrupt/incompatible/stale, inference exception, insufficient training samples, or no valid prediction, route with configured baseline and surface this state to API/dashboard.
- Do not add reinforcement learning or online exploration to the normal request path.

## Tests
Use fake models and deterministic features. Test lowest-valid-prediction selection, candidate filtering, schema mismatch, missing model, invalid numbers, model exception, stale telemetry, zero eligible candidates, and fallback logging. Add a small clearly labelled synthetic dataset fixture only for unit testing; never report its scores as real project results. Update docs/model status API and expose active model version/evaluation metrics. Run all tests and include exact commands/results.
