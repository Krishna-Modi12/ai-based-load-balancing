# 6. ML Methodology and Evaluation

## 6.1 Why use supervised latency prediction first?
The first version should prefer an explainable, testable regression model over a large neural model or reinforcement learning. The learning problem is specific: estimate the response latency a candidate backend is likely to produce from its pre-routing state. A smaller model makes data collection, validation, versioning, failure handling, and the viva explanation more manageable. Reinforcement learning is a possible future extension, not an MVP requirement.

## 6.2 Baselines
1. **Round Robin:** cycle through eligible workers. Include capacity weights only if implemented consistently and documented.
2. **Least Connections:** choose the eligible worker with the fewest in-flight requests; use a deterministic tie-breaker.
3. **AI Latency:** predict latency for every eligible worker using a trained model and choose the lowest adjusted cost.
4. **Fallback:** if the AI model is unavailable, stale, corrupt, times out, or outputs invalid values, use the configured baseline and record a fallback reason.

## 6.3 Features and label
Use pre-routing features available at decision time:
- CPU percentage and memory percentage, when available.
- Current active/in-flight requests.
- Recent measured latency EWMA.
- Probe RTT / measured network latency.
- Recent error rate and success rate.
- Configured worker capacity weight.
- Controlled request class (light, normal, heavy).

**Target label:** measured end-to-end latency for that request, in milliseconds. Only features known before dispatch may be used to predict that request; do not include its actual latency or status as a feature.

## 6.4 Training-data collection and selection bias
A router observes the real outcome only for the worker it selected. This creates selection bias if the system only trains on its own AI choices. Start with a controlled calibration experiment that distributes requests across all healthy workers using a documented randomized or Round Robin exploration policy. Save each pre-routing feature vector with the resulting latency, worker ID, workload profile, and timestamp. Use enough samples across different load conditions, and visibly label simulated-delay profiles.

Do not silently combine training data from incompatible feature schemas or different worker configurations. Keep the dataset-generation script, seed, experiment config, and training date/version in the repository. If the dataset is generated entirely from synthetic rules, explicitly state that the model has only been validated in simulation.

## 6.5 Training and validation
- Initial candidate: `RandomForestRegressor` from scikit-learn; compare with a simple baseline predictor such as recent latency EWMA.
- Split data by experiment/run or chronological block where possible, not random rows from the same burst alone; this reduces leakage caused by highly correlated measurements.
- Report MAE and RMSE for latency prediction, plus sample count and split definition.
- Save a feature schema version and model version metadata.
- Add deterministic seeds and validate feature names/order when loading a model.
- Use a bounded training job; do not train on every request in the proxy path.

## 6.6 Inference and safety
1. Filter disabled, unhealthy, and stale-metric nodes.
2. Construct the same feature schema used during training.
3. Score each remaining worker.
4. Reject `NaN`, infinity, negative, or implausibly extreme predictions.
5. Add a documented penalty for stale telemetry or near-capacity conditions if those are not already represented adequately in the trained model.
6. Choose the lowest-cost eligible worker.
7. On any inference failure, use a known baseline policy.
8. Log model version and fallback reason for auditability.

Avoid unconstrained online exploration in normal operation. If exploration is needed to gather data, confine it to a clearly marked calibration/benchmark mode.

## 6.7 Benchmark design
Use the same workers, hardware, duration, workload shape, request class mix, health-check settings, warm-up, and load-generator location for each compared policy. Randomise or alternate the order of policy runs to reduce time/order effects. Repeat each profile several times and report per-run values plus mean/median and variability.

Recommended workload profiles:
- **Uniform:** same capacities and similar work cost.
- **Heterogeneous capacity:** one slow/low-capacity worker and two faster workers.
- **Bursty:** ramp requests up and down.
- **Heavy-tailed requests:** mixed light/normal/heavy tasks.
- **Node failure:** disable or terminate a worker during traffic.
- **Metric/model failure:** stale telemetry, missing model artifact, or prediction exception.

## 6.8 Metrics to report
- Throughput (successful requests/second).
- Latency p50, p95, p99 in milliseconds.
- Error/timeout rate.
- Successful request count and failure count.
- Distribution of requests per backend.
- Backend CPU/memory if available.
- Load balance coefficient of variation: `CV = standard_deviation(load_i) / mean(load_i)`; lower can mean more even request distribution, but even distribution is not always optimal for heterogeneous capacity.
- Jain fairness index on a clearly specified quantity, if used: `J(x) = (sum x_i)^2 / (n * sum(x_i^2))` for non-negative `x_i`; state what `x_i` represents.
- Model latency prediction MAE/RMSE.
- Failover detection and recovery time.

## 6.9 Results policy
Never write “AI improved performance by X%” until the experiments have run. For each table/plot, record the environment, date, concurrency/request rate, duration, repetitions, and policy. A valid result may be that AI improves some metrics but loses on others. Discuss limitations and avoid generalizing from a local Docker setup to production networks.

## 6.10 Optional research extension
A future SDN experiment can use Mininet/OpenFlow to create hosts, switches, and links and then study routing at a lower network-control level. Do not present the Layer-7 MVP as a replacement for SDN or transport-layer load balancing.
