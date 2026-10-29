# 13. Demo / Viva Script

Target length: 5–7 minutes. Adapt to the actual implementation; skip any feature that is not ready.

1. **Problem and motivation (30 sec):** fixed routing rules do not necessarily adapt to changing backend load and response time. We compare conventional routing with a supervised latency prediction approach.
2. **Architecture (45 sec):** show dashboard, API/proxy, database, three workers, health checks and training pipeline. State that the MVP is Layer-7 HTTP routing.
3. **Baseline traffic (60 sec):** choose Round Robin, send a controlled number of requests, show decision distribution and latency metrics.
4. **Compare Least Connections (45 sec):** repeat the same workload profile and explain the in-flight request signal.
5. **AI model (60 sec):** show training sample count, feature schema, validation MAE/RMSE, active model version, predicted latency per candidate and selected worker. Explain the safe fallback.
6. **Failure handling (45 sec):** take one worker offline, show health status change and traffic avoiding it. Demonstrate fallback when the model is unavailable if implemented.
7. **Experiment results (60 sec):** open a saved run, show p50/p95/p99, throughput, error rate, load distribution and run config. State actual measured results only, and mention any trade-off.
8. **Engineering evidence (30 sec):** show test results, GitHub Actions, API docs, migrations, exported CSV and report.
9. **Limitations (20 sec):** local-container results are not a production-network guarantee; future extension could use Mininet/OpenFlow.

## Likely viva questions

**Q: Why not just use Round Robin?**
A: Round Robin is a strong, low-cost baseline and may perform well when workers and requests are similar. The project tests whether current telemetry and latency prediction help in heterogeneous or changing conditions; it does not assume AI always wins.

**Q: What makes this AI-based?**
A: A trained regression model estimates request latency for each eligible backend from recorded features. It is trained and evaluated from measured samples. A fixed heuristic alone would be adaptive, but would not by itself be a trained ML model.

**Q: Why a regressor instead of classifier?**
A: The target is continuous latency in milliseconds. Predicted latency can rank candidate workers. A classifier could predict a worker label but would need careful labels and could be less reusable when backend sets change.

**Q: How do you avoid training bias?**
A: Use a controlled calibration policy to gather data across all healthy backends; store pre-routing features and actual response time; evaluate by held-out runs or time blocks.

**Q: What happens if the model is down?**
A: Routing continues using a named fallback policy, and the decision log records the fallback reason.

**Q: Does lower load-balance CV always mean better performance?**
A: No. Equal request counts can be suboptimal when workers have different capacities or request costs. It is one diagnostic metric alongside latency, throughput, errors and resource use.

**Q: Is this a Layer-3/Layer-4 load balancer?**
A: No, the initial implementation is a Layer-7 HTTP reverse proxy. A separate Mininet/OpenFlow extension would explore network-level/SDN decisions.

**Q: What is the contribution?**
A: A reproducible end-to-end experiment platform with baseline routing, ML latency prediction, safety fallback, telemetry, persistence, and controlled comparison—supported by code, tests and measurements.
