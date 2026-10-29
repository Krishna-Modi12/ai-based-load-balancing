# AI-Based Load Balancing in Computer Networks — Project Proposal

**Status:** Pre-implementation proposal. Replace placeholders and update this document after implementation. No measured performance claims are made here.

## Abstract
This project proposes a full-stack, AI-assisted Layer-7 HTTP load-balancing demonstrator. The system will compare Round Robin and Least Connections against a supervised model that predicts candidate-backend response latency from pre-routing telemetry. The system includes a FastAPI proxy/control plane, three configurable workers, PostgreSQL persistence, a React dashboard, health checking, controlled load generation, safe fallback routing, automated tests, and experiment exports. Conclusions will be based on repeatable measurements rather than assumed AI improvements.

## Problem and objectives
Fixed routing policies may not react to changes in backend capacity, response time, workload shape, or health. Objectives are to implement a working proxy; collect telemetry and decisions; build baseline and ML policies; provide a monitoring/experiment dashboard; persist data; run reproducible comparisons; and publish code, docs, tests and results.

## Proposed architecture
See [`03-architecture.md`](03-architecture.md). Core services: frontend, FastAPI API/proxy, policy engine, health/telemetry collector, three backend workers, PostgreSQL, ML training/inference module, and Locust load generator.

## Methodology
Use supervised regression to estimate response latency from features known before dispatch. Gather calibration samples across healthy workers to reduce selection bias. Version the model and feature schema. Use a baseline fallback for missing, stale, corrupt, incompatible or invalid model predictions. Compare policies under matched workloads, repeated runs, and recorded settings.

## Evaluation metrics
Throughput; p50/p95/p99 latency; errors/timeouts; request distribution; CPU/memory where available; balance CV; defined fairness metric if used; prediction MAE/RMSE; failover/recovery time.

## Planned deliverables
Source repository; system, API and database documentation; migrations; dashboard; worker services; baseline and AI policies; tests; Docker Compose; workload scripts; raw experiment exports; plots; final report; presentation and demo evidence.

## Results (fill only after experiments)
- Test environment: [hardware, OS, Docker, Python, Node versions]
- Profiles and repetitions: [fill]
- Baseline results: [fill with measured values]
- AI results: [fill with measured values]
- Limitations and threats to validity: [fill]

## References
See [`12-research-and-sources.md`](12-research-and-sources.md) for paper details and official implementation resources.
