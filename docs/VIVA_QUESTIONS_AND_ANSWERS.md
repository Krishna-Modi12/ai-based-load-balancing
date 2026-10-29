# Viva Questions and Answers

1. **What problem does the project solve?**  
   It routes HTTP requests across registered workers while comparing simple
   policies with a telemetry-driven latency predictor.

2. **Why is this Layer 7 load balancing?**  
   The proxy operates on HTTP requests, query parameters, status codes, and
   application latency rather than IP packets or transport connections.

3. **What is a reverse proxy?**  
   A server-facing proxy accepts client requests, selects an upstream, forwards
   the request, and returns the upstream response.

4. **Why restrict upstreams to registered backends?**  
   It prevents clients from supplying arbitrary URLs and makes routing auditable.

5. **How does Round Robin work here?**  
   It advances a cursor through eligible backends, producing approximately
   even distribution.

6. **How does Least Connections work?**  
   It selects the eligible backend with the smallest tracked in-flight count,
   using name order as a deterministic tie-breaker.

7. **What does the AI policy predict?**  
   A Random Forest regressor predicts likely backend response latency in
   milliseconds.

8. **Which features are used?**  
   CPU, memory, active requests, latency EWMA, network RTT, error rate,
   capacity weight, and request class.

9. **Why use Random Forest?**  
   It handles nonlinear feature interactions, is straightforward to validate,
   and is practical for a small supervised regression testbed.

10. **How is the model trained?**  
    Successful persisted routing decisions provide features and observed
    latency labels; training uses a chronological 80/20 split.

11. **Was the evaluation data used for tuning?**  
    No. The 36-run matrix was evaluated after the model artifact was trained.

12. **What happens when the model is missing?**  
    AI mode falls back to Least Connections and records `MODEL_UNAVAILABLE`.

13. **What happens when prediction is invalid?**  
    Non-finite, negative, or implausibly large predictions trigger a safe
    Least Connections fallback.

14. **How is health determined?**  
    The API checks each worker's health and metrics endpoints and stores a
    telemetry sample.

15. **What is stale telemetry?**  
    A telemetry observation older than the configured freshness window. Such a
    backend is excluded rather than treated as idle.

16. **How are upstream errors represented?**  
    Worker HTTP errors and timeouts are recorded in the routing decision and
    mapped to API `502 UPSTREAM_REQUEST_FAILED`.

17. **Why PostgreSQL?**  
    It provides durable relational persistence for workers, telemetry,
    decisions, model versions, experiments, and aggregate metrics.

18. **Why use Docker Compose?**  
    It gives the API, database, workers, and frontend a repeatable local
    multi-service environment.

19. **What is persisted for an experiment?**  
    Configuration, policy, profile, repetition, seed, status, timestamps, raw
    samples, aggregate metrics, and backend distributions.

20. **What are the four workload profiles?**  
    Uniform, heterogeneous, bursty, and mixed request-class workloads.

21. **What was the normal benchmark matrix?**  
    Three policies × four profiles × three repetitions = 36 completed runs.

22. **How is throughput calculated?**  
    Successful measured requests divided by the configured measurement duration.

23. **How is error rate calculated?**  
    Failed measured requests divided by all measured requests.

24. **What did the benchmark show?**  
    AI routing had higher P50/P95/P99 latency and lower throughput than both
    baselines in all four profiles, with zero errors in the valid batch.

25. **What were the overall mean client latencies?**  
    Approximately 75.498 ms Round Robin, 68.545 ms Least Connections, and
    359.527 ms AI latency.

26. **Why did AI underperform?**  
    The measured AI inference p50 was about 52.041 ms. The request path also
    performs telemetry queries and predictor loading/validation; prediction
    error and worker-a concentration are additional plausible factors.

27. **Can inference time alone explain the gap?**  
    No. It is measured evidence of overhead, but the experiment did not isolate
    SQL, model loading, prediction, and policy-quality contributions separately.

28. **Does this mean AI is useless?**  
    No. It means this implementation and model did not justify their cost under
    these workloads. Different state, caching, calibration, or workload
    conditions require separate evidence.

29. **How was a disabled backend tested?**  
    The API disabled worker-b, routed ten requests through remaining workers,
    then re-enabled and health-checked it; this was repeated three times.

30. **How was an HTTP 503 tested?**  
    Worker-b was recreated with `FAIL_MODE=true`; Round Robin selected it
    periodically and the API returned 502 for those upstream failures.

31. **How was a timeout tested?**  
    Worker-b delay was set to 5000 ms, above the API's 3-second timeout, and
    the resulting upstream timeout was mapped to API 502.

32. **How was model fallback tested?**  
    The mounted artifact was temporarily renamed; AI requests succeeded with
    recorded Least Connections fallback, then the artifact was restored.

33. **What happens when all telemetry is stale?**  
    No backend is eligible and the API returns 503 `NO_HEALTHY_BACKENDS`.

34. **What are the main threats to validity?**  
    Local Docker execution, simulated delays, one artifact, one concurrency
    level, three repetitions, and no statistical significance analysis.

35. **Why not claim statistical significance?**  
    Three repetitions are useful for controlled descriptive comparison but are
    insufficient for a strong general statistical claim here.

36. **What security choices were made?**  
    Admin operations require a configured token, clients cannot choose
    arbitrary upstream URLs, and request bodies/personal data are not stored.

37. **What would you optimize first?**  
    Cache the validated predictor and maintain bounded in-memory telemetry
    snapshots, then benchmark that separately with a new version identity.

38. **Why is the project still valuable despite losing?**  
    It provides a reproducible empirical testbed showing when added model
    complexity does not pay off, with transparent failure and fallback evidence.

39. **What would a stronger study add?**  
    More repetitions, concurrency levels, independent calibration data,
    confidence intervals, drift tests, and a larger or real network testbed.

40. **What should be demonstrated first?**  
    Start Compose, show health and dashboard data, exercise all three policies,
    show model fallback, perform one disable/recovery test, then explain the
    measured chart and limitations.
