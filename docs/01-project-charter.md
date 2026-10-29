# 1. Project Charter

## Title
**AI-Based Load Balancing in Computer Networks**

## Problem statement
When requests are distributed using a fixed rule, the load balancer may not react optimally to heterogeneous backend capacities, temporary congestion, changing response times, or backend failures. Static policies such as Round Robin are simple and useful baselines, but their decisions do not directly incorporate a forecast of the response time a backend is likely to deliver under current conditions. This project will implement and evaluate an ML-assisted routing policy against conventional policies in a controlled HTTP-service testbed.

## Aim
Design, implement, and evaluate a full-stack HTTP load-balancing demonstrator that uses observed service/network telemetry and machine learning to choose among healthy backend services.

## Objectives
1. Implement a working reverse-proxy gateway and at least three separately configurable backend workers.
2. Implement Round Robin and Least Connections as reproducible baseline policies.
3. collect response latency, status code, request counts, active requests, health, and backend telemetry.
4. Train an ML regressor to estimate latency from pre-routing features and use it to rank healthy candidate backends.
5. Include safe fallback behaviour when the model is unavailable or telemetry is stale.
6. Build a web dashboard for topology/status, metrics, decision history, experiments, and model state.
7. Persist telemetry and experiment metadata in PostgreSQL.
8. Run controlled tests and compare p50/p95/p99 latency, throughput, error rate, resource utilisation, and load balance.
9. Publish reproducible source code, setup instructions, diagrams, tests, and a final report.

## Scope
**In scope:** HTTP/Layer-7 proxy routing; local Docker-based services; server health checks; simulated heterogeneous service capacities and delays; metrics storage; ML-assisted decision logic; dashboard; load generation; baseline comparison; controlled node failure tests; data export; project documentation.

**Out of scope for the initial MVP:** production Internet-facing deployment, guaranteed global optimization, a trained production model, encrypted inspection of traffic, real ISP routing, autonomous changes to router configuration, and claims of Layer-3/Layer-4 or OpenFlow control.

**Optional extension:** Mininet + OpenFlow/SDN controller experiments on Linux, if the core full-stack application is stable and time permits.

## Users and stakeholders
- Student/development team: implement, test, and document.
- Faculty/evaluator: inspect CN concepts, methodology, code, reproducibility, and results.
- Dashboard operator: start/stop experiments, inspect health, and compare policies.

## Success criteria (targets to validate, not guaranteed outcomes)
- Requests are routed only to healthy/eligible registered workers.
- Round Robin and Least Connections behave according to their documented rules.
- AI mode uses a versioned model when available and explicitly reports fallback when it is not.
- Backend failure is detected and traffic avoids the failed worker within a measured health-check interval.
- Each experiment records its algorithm, configuration, run times, workload parameters, and aggregate metrics.
- Benchmarks can be repeated with saved settings and exported raw data.
- All required automated tests pass in CI.
- Final performance statements are backed by repeated measurements and uncertainty/variation is reported.

## Key assumptions
- Workload is generated in a local test environment; measured results are environment-specific.
- Worker telemetry and latency are imperfect/noisy signals.
- The first ML model is a supervised latency regressor, not reinforcement learning.
- The AI policy should optimise a stated objective rather than imply that “AI” automatically improves performance.

## Main risks
Training data bias, overfitting to synthetic delays, unstable routing, health-check races, misleading comparisons, resource limitations, and differences between local containers and real networks. Mitigations are specified in [Security, risks, and reliability](08-security-and-risk.md) and [ML methodology](06-ml-methodology.md).
