# 12. Research Notes and Source List

This is a curated starting bibliography, checked on **29 October 2026**. Read the papers' methods and limitations, not just abstracts. Verify institutional access and cite any source actually used in the final report.

## Research framing
Load balancing is a trade-off among throughput, latency (especially tail latency), resource utilization, fairness/capacity fit, error rate, and availability. Traditional approaches are necessary baselines, not obsolete straw men. A model must be evaluated against these baselines under the same conditions. Reinforcement learning is an active research direction, but introduces additional concerns around state/action/reward design, safe exploration, reproducibility, and simulation-to-real transfer. For a mini-project, a supervised latency predictor gives a smaller and easier-to-audit research contribution.

## Core papers / surveys

1. Guisheng Liu, Yong Liu, Qian Meng, Ben Wang, Kefei Chen, Zhonghua Shen, **“Traffic load balancing in data center networks: A comprehensive survey,”** *Computer Science Review*, vol. 57, article 100749, August 2025. DOI: [10.1016/j.cosrev.2025.100749](https://doi.org/10.1016/j.cosrev.2025.100749). Useful for taxonomy, topology and load-balancing challenges.
2. DW Di Wu et al., **“Reinforcement learning for communication load balancing: approaches and challenges,”** *Frontiers in Computer Science*, 31 May 2023. DOI: [10.3389/fcomp.2023.1156064](https://doi.org/10.3389/fcomp.2023.1156064). Useful for state/action/reward design and RL limitations.
3. **“Machine Learning-Driven Load Balancing in Edge and 5G Networks: A Comprehensive Survey,”** *IEEE Open Journal of the Communications Society*, published 28 August 2026, DOI: [10.1109/OJCOMS.2026.3728736](https://doi.org/10.1109/OJCOMS.2026.3728736). Useful for modern ML/RL taxonomy and evaluation dimensions; access may depend on institutional subscription.

## Official implementation resources

4. NGINX, **Using nginx as HTTP load balancer**: https://nginx.org/en/docs/http/load_balancing.html — describes Round Robin, least-connected, hashing, weights, and least-time in available configurations. Use to understand conventional policy trade-offs.
5. Mininet, **Walkthrough**: https://mininet.org/walkthrough/ and project page https://mininet.org/ — authoritative starting point for an optional SDN/network-topology extension.
6. Ryu SDN Framework: https://ryu-sdn.org/ — controller framework with OpenFlow support; check maintained status/compatibility before relying on it.
7. scikit-learn documentation: https://scikit-learn.org/stable/documentation.html — model fitting, preprocessing, regression evaluation, model selection. Use a fixed training/evaluation split and report MAE/RMSE.
8. FastAPI user guide: https://fastapi.tiangolo.com/tutorial/ — API implementation and validation.
9. FastAPI SQL database guide: https://fastapi.tiangolo.com/tutorial/sql-databases/ — relational persistence patterns.
10. PostgreSQL documentation: https://www.postgresql.org/docs/current/ — SQL, transactions, indexes, and administration.
11. React docs: https://react.dev/learn — component-based frontend fundamentals.
12. Docker Compose docs: https://docs.docker.com/compose/ — reproducible multi-service local deployment.
13. Locust docs: https://docs.locust.io/en/latest/ — controlled HTTP load generation and repeatable tests.
14. Prometheus instrumentation practices: https://prometheus.io/docs/practices/instrumentation/ — metric selection and instrumentation; optional for the MVP.
15. Antigravity IDE overview: https://antigravity.google/docs/ide/overview/ — official overview of the agentic workspace; use plans, diffs and verification rather than accepting large unaudited changes.

## Literature review matrix to complete

| Source | Problem focus | Method(s) | Evaluation setup | Key finding | Limitations / relevance to our project |
|---|---|---|---|---|---|
| Liu et al. (2025) | [read and fill] | [fill] | [fill] | [fill] | [fill] |
| Wu et al. (2023) | [read and fill] | [fill] | [fill] | [fill] | [fill] |
| IEEE OJ-COMS (2026) | [read and fill] | [fill] | [fill] | [fill] | [fill] |
| NGINX docs | practical baselines | RR, least-connections, etc. | implementation docs | methods and trade-offs | baseline design reference |

## Suggested research gap statement (validate against the papers you read)
For this project, the defensible contribution is **not** “the first AI load balancer.” A more realistic contribution is a reproducible student-scale testbed that integrates an auditable latency-prediction policy, health-aware fallback, dashboard, persistent telemetry, and controlled policy comparisons across heterogeneous workers and failure scenarios. Demonstrate the contribution through measurement rather than novelty claims alone.

## Citation and integrity notes
- Cite algorithm and metric definitions in the final report.
- Record access dates for web sources if required by the department.
- Do not claim a paper used a particular algorithm or achieved a particular improvement without reading the relevant section/table.
- Do not use results from one environment as universal proof that a policy is better.
