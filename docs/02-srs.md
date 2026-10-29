# 2. Software Requirements Specification (SRS)

## 2.1 Purpose
This SRS defines the functional, non-functional, and verification requirements for the AI-Based Load Balancing system. It is a project baseline; update it through reviewed Git changes if implementation decisions change.

## 2.2 Product perspective
The product consists of a web dashboard, a FastAPI control plane and HTTP proxy, a PostgreSQL database, multiple backend workers, an ML training/inference module, and a load-testing harness. The control plane is the routing authority for this prototype.

## 2.3 Functional requirements

| ID | Requirement | Acceptance evidence |
|---|---|---|
| FR-01 | Register and list backend workers with name, URL, configured capacity, enabled state, health, and last health-check time. | API tests and dashboard view |
| FR-02 | Perform periodic health checks with timeouts and configurable thresholds. | Simulated worker-down test |
| FR-03 | Proxy demo requests to a selected registered worker and return the worker response. | Integration test verifies selected worker ID |
| FR-04 | Support Round Robin routing. | Distribution/order test with healthy equal-weight workers |
| FR-05 | Support Least Connections routing. | Controlled concurrent-request test |
| FR-06 | Support AI-assisted routing using predicted latency for each eligible worker. | Unit test using known fake model predictions |
| FR-07 | Reject unhealthy workers and provide a fallback if ML inference fails or the model is not ready. | Failure-path tests |
| FR-08 | Store routing decision, selected worker, mode, prediction (if any), actual latency, status, timestamp, and fallback reason. | Database integration test |
| FR-09 | Store time-series backend telemetry and model versions. | DB query test |
| FR-10 | Present overview KPIs, worker health, request distribution, latency charts, and recent decisions. | Browser acceptance test |
| FR-11 | Start and monitor benchmark runs with a named policy and workload profile. | Experiment integration test |
| FR-12 | Compare baseline and AI experiment metrics and export results as CSV/JSON. | Export validation |
| FR-13 | Train and evaluate a model from explicitly recorded training samples; retain model version and metrics. | Model pipeline test |
| FR-14 | Expose liveness/readiness and API documentation. | `/health/live`, `/health/ready`, OpenAPI docs |
| FR-15 | Allow operators to change routing mode and backend configuration only through protected endpoints. | Auth/permission tests |

## 2.4 Non-functional requirements

| ID | Requirement | Verification |
|---|---|---|
| NFR-01 | Maintain modular separation between API, routing strategies, telemetry, model, persistence, and UI. | Code review / architecture map |
| NFR-02 | Use explicit timeouts for health checks and proxied requests. | Unit/integration tests |
| NFR-03 | A failed or stale model must not stop ordinary routing. | Model-unavailable test |
| NFR-04 | Do not store request bodies, passwords, API tokens, or unnecessary personal data. | Code/config review |
| NFR-05 | Make local setup reproducible with Docker Compose and `.env.example`. | Clean-machine smoke test |
| NFR-06 | Provide unit, integration, and browser tests; enforce backend tests in CI. | CI run |
| NFR-07 | Keep latency samples and decision records timestamped; use timezone-aware UTC timestamps. | DB/API tests |
| NFR-08 | Avoid unbounded in-memory metrics and unbounded label values. | Review and stress test |
| NFR-09 | Show loading, empty, error, and stale-data states in the frontend. | Browser review |
| NFR-10 | Label any synthetic simulation data explicitly. | UI and report review |

## 2.5 User stories
- As an operator, I can see which backend workers are healthy and how many requests each has received.
- As an operator, I can select Round Robin, Least Connections, or AI mode and see the active mode.
- As an evaluator, I can run the same workload under different policies and compare results.
- As an evaluator, I can export data and reproduce the performance plots.
- As a developer, I can run automated tests and start the stack using documented commands.

## 2.6 Constraints
- The first version is an educational prototype, not a production-certified load balancer.
- Actual performance depends on CPU, memory, Docker/OS scheduling, worker configuration, and request workload.
- The AI policy is allowed to select only among registered and healthy workers.
- If using Mininet, it is an optional Linux-based extension; it is not a required dependency for the core dashboard.

## 2.7 Acceptance checklist
A release candidate is accepted only when FR-01 through FR-14 have test evidence, NFR-02 through NFR-06 are verified, the three policies can be compared using saved experiment configuration, and the report contains real benchmark output rather than invented values.
