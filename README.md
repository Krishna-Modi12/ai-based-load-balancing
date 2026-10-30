# AI-Based Load Balancing in Computer Networks

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.11](https://img.shields.io/badge/Python-3.11%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.116-green.svg)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/React-19.x-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
[![Tests](https://img.shields.io/badge/Tests-18%20Passed-success.svg)](backend/tests/)
[![Docker Compose](https://img.shields.io/badge/Docker%20Compose-v2%2B-blue.svg)](deployment/docker-compose.yml)

A production-ready, full-stack **Layer-7 HTTP Intelligent Load Balancer and Telemetry Control Plane** designed for modern computer networks. This system combines conventional routing baselines (**Round Robin**, **Least Connections**) with a supervised **Random Forest Latency Predictor** to route traffic dynamically across heterogeneous application backends based on live real-time server telemetry.

---

## 📑 Table of Contents
- [Project Overview](#-project-overview)
- [System Architecture](#-system-architecture)
- [Key Features](#-key-features)
- [Routing Algorithms & AI Methodology](#-routing-algorithms--ai-methodology)
- [Benchmark & Empirical Evaluation](#-benchmark--empirical-evaluation)
- [Tech Stack](#-tech-stack)
- [Quick Start Guide](#-quick-start-guide)
  - [Docker Compose Deployment](#1-docker-compose-deployment-recommended)
  - [Local Development Setup](#2-local-development-setup)
- [API Endpoints Reference](#-api-endpoints-reference)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [Documentation Index](#-documentation-index)
- [Viva & Defense Cheat Sheet](#-viva--defense-cheat-sheet)
- [License](#-license)

---

## 🌟 Project Overview

Traditional load-balancing algorithms operate blindly with respect to application-level performance:
- **Round Robin (RR)** naively cycles through backends regardless of whether one server is choking on memory or compute.
- **Least Connections (LC)** monitors open connections but treats lightweight static requests and heavy compute-bound tasks identically.

**AI-Based Load Balancing** solves this by observing live system telemetry (CPU utilization, memory usage, in-flight requests, network RTT, EWMA latency, and error rate), applying a supervised Scikit-Learn `RandomForestRegressor` to estimate each candidate server's response time in milliseconds, and routing traffic to the fastest eligible backend.

### Core Objectives
1. **Real-world Layer-7 Reverse Proxy:** High-throughput HTTP forwarding with connection pooling, correlation IDs, and bounded timeouts.
2. **Deterministic Baseline vs. AI Comparison:** Side-by-side evaluation of Round Robin, Least Connections, and Machine Learning latency prediction under identical workloads.
3. **Resilient Failure Handling:** Automatic failover, stale telemetry exclusion, out-of-bounds prediction clamping, and safe degradation to Least Connections.
4. **Persistent Auditing:** Every single decision, feature vector, predicted vs. actual latency, and HTTP status code is saved to PostgreSQL for reproducible analysis.

---

## 🏗 System Architecture

```
                            +----------------------------------+
                            |     Client / Ingress Traffic     |
                            +----------------------------------+
                                             |
                                    HTTP Requests (L7)
                                             v
                      +-----------------------------------------------+
                      |     FastAPI Reverse Proxy & Load Balancer     |
                      |                 (Port 8000)                   |
                      +-----------------------------------------------+
                                      |               |
                      Health Probing & Telemetry      | Request Forwarding
                                      v               v
                +-----------------------------------------------------------+
                |                    Routing Decision Engine                |
                |  +--------------------+-------------------+------------+  |
                |  | Round Robin Policy | Least Connections | AI Latency |  |
                |  +--------------------+-------------------+------------+  |
                +-----------------------------------------------------------+
                                             |  (Scored via Scikit-Learn
                                             |   Random Forest Regressor)
                                             v
                     +---------------------------------------------+
                     |         Backend Worker Cluster (HTTP)       |
                     |  +-----------------+---------------------+  |
                     |  | Worker A (Fast) | 15ms Base / Cap=2.0 |  |
                     |  | Worker B (Slow) | 60ms Base / Cap=1.0 |  |
                     |  | Worker C (Med)  | 30ms Base / Cap=1.0 |  |
                     |  +-----------------+---------------------+  |
                     +---------------------------------------------+
                                      |               |
                           Response Latency    Health Metrics
                                      v               v
                +-----------------------------------------------------------+
                |             PostgreSQL Persistence Layer                  |
                |   - routing_decisions    - telemetry_samples              |
                |   - model_versions       - experiment_runs & metrics      |
                +-----------------------------------------------------------+
                                             ^
                                             | REST API / Metrics
                                             v
                +-----------------------------------------------------------+
                |         React 19 + TypeScript + Tailwind Dashboard        |
                |                 (Nginx Reverse Proxy: 5173)               |
                +-----------------------------------------------------------+
```

---

## ⚡ Key Features

- **Dynamic L7 Reverse Proxy:** Non-blocking async proxying built with `HTTPX` and `FastAPI`, featuring correlation tracking (`X-Request-ID`).
- **Tri-Policy Routing Engine:**
  - `round_robin`: Classical deterministic rotation.
  - `least_connections`: Load-aware selection with deterministic tie-breaking.
  - `ai_latency`: Random Forest regression model scoring candidate nodes.
- **Fail-Safe Circuit Breaker:**
  - `MODEL_UNAVAILABLE`: Graceful fallback if model artifact is missing.
  - `MODEL_INFERENCE_FAILED`: Catches invalid outputs (NaN, Inf, or negative times).
  - `STALE_TELEMETRY`: Excludes nodes with metrics older than 30 seconds.
- **Explainable Machine Learning:**
  - Model: Scikit-learn `RandomForestRegressor(n_estimators=100)`.
  - Feature Schema v1: `[cpu_percent, memory_percent, active_requests, latency_ewma_ms, network_rtt_ms, error_rate, capacity_weight, request_class]`.
  - Auditable model artifacts stored with explicit validation metrics (MAE & RMSE).
- **Comprehensive React 19 Operator Dashboard:**
  - Real-time system health, telemetry charts, policy switcher, and backend controls.
  - Live inspection of routing decisions showing predicted vs. actual latency.
  - Direct model training and experiment export controls.
- **Reproducible Performance Experiments:**
  - Integrated Locust load testing framework.
  - Automated CSV and JSON metric export per experiment run.

---

## 🔬 Routing Algorithms & AI Methodology

### Algorithmic Breakdown
1. **Round Robin (Baseline):**
   $$b^* = B_{\text{healthy}}[c \pmod n], \quad c \leftarrow c + 1$$
2. **Least Connections (Baseline):**
   $$b^* = \arg\min_{b \in B_{\text{healthy}}} \left(\text{inflight}(b), \text{name}(b)\right)$$
3. **AI Latency Prediction (Proposed):**
   Evaluates feature vector $\mathbf{x}_b$ against trained ensemble $f_\theta$:
   $$b^* = \arg\min_{b \in B_{\text{healthy}}} f_\theta(\mathbf{x}_b)$$

### Calibration & Training Discipline
- Requires **at least 20 real recorded decisions** under calibration traffic before model training can be triggered.
- Uses an 80/20 train/validation split.
- Rejects ungrounded or synthetic accuracy claims; reports actual MAE and RMSE in milliseconds.

---

## 📊 Benchmark & Empirical Evaluation

Rigorous benchmarking was executed across 36 controlled Locust experiment runs across 4 distinct operational profiles:

| Workload Scenario | Policy | Avg Throughput (req/s) | Median Latency (P50 ms) | Tail Latency (P95 ms) | Load Distribution CV |
|---|---|---|---|---|---|
| **Uniform Workload** | Round Robin | **98.4** | 22.1 | 35.8 | 0.04 |
| | Least Connections | 97.8 | **21.4** | **34.2** | **0.02** |
| | AI Latency | 84.2 | 26.8 | 48.6 | 0.12 |
| **Heterogeneous Workers** | Round Robin | 64.1 | 42.5 | 88.2 | 0.38 |
| | Least Connections | **79.6** | **28.3** | **52.1** | **0.18** |
| | AI Latency | 74.5 | 31.2 | 58.4 | 0.22 |
| **Bursty Traffic Spikes** | Round Robin | 71.2 | 39.8 | 94.6 | 0.41 |
| | Least Connections | **88.4** | **25.6** | **49.8** | **0.15** |
| | AI Latency | 81.3 | 29.4 | 56.1 | 0.19 |
| **Mixed Request Costs** | Round Robin | 58.6 | 54.2 | 112.4 | 0.45 |
| | Least Connections | 72.4 | 36.5 | 74.8 | 0.24 |
| | AI Latency | **76.1** | **33.8** | **68.2** | **0.20** |

> **Academic Conclusion:** While AI provides superior routing decisions in heterogeneous or mixed-cost environments, runtime model evaluation adds a ~2-5ms CPU inference tax. For uniform light workloads, Least Connections remains the optimal engineering choice.

---

## 💻 Tech Stack

- **Backend & Control Plane:** Python 3.11, FastAPI, Pydantic v2, HTTPX, Uvicorn
- **Database & Migrations:** PostgreSQL 16, SQLAlchemy 2.0 ORM, Alembic
- **Machine Learning:** Scikit-Learn 1.7+, Joblib, NumPy
- **Frontend Dashboard:** React 19, TypeScript, Vite, Tailwind CSS, Recharts
- **Web Server / Proxy:** Nginx 1.27 Alpine (SPA serving + API reverse proxy)
- **Deployment & Testing:** Docker Compose, Pytest, Locust, GitHub Actions

---

## 🚀 Quick Start Guide

### 1. Docker Compose Deployment (Recommended)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Krishna-Modi12/ai-based-load-balancing.git
   cd ai-based-load-balancing
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env and set your ADMIN_TOKEN and POSTGRES_PASSWORD
   ```

3. **Start all services with Docker Compose:**
   ```bash
   docker compose -f deployment/docker-compose.yml up --build -d
   ```

4. **Verify running services:**
   - **Operator Dashboard:** [http://localhost:5173](http://localhost:5173)
   - **FastAPI Control Plane:** [http://localhost:8000](http://localhost:8000)
   - **Swagger API Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs)
   - **PostgreSQL Database:** `localhost:5432`

---

### 2. Local Development Setup

#### Backend Setup
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
$env:PYTHONPATH = (Get-Location).Path
pytest -v
```

#### Frontend Setup
```powershell
cd frontend
npm install
npm run dev
```

---

## 📡 API Endpoints Reference

| Method | Endpoint | Description | Auth Required |
|---|---|---|:---:|
| `GET` | `/health/live` | Container liveness check | No |
| `GET` | `/health/ready` | Database readiness check | No |
| `GET` | `/api/v1/system/status` | Active policy & model readiness | No |
| `GET` | `/api/v1/route` | Main proxy route (`?request_class=light\|normal\|heavy`) | No |
| `GET` | `/api/v1/backends` | List all registered backend workers | No |
| `POST` | `/api/v1/backends` | Register a new backend node | **Yes** |
| `PATCH` | `/api/v1/backends/{id}` | Update worker weight or enable/disable | **Yes** |
| `POST` | `/api/v1/backends/health-check-all` | Trigger health & telemetry poll | **Yes** |
| `GET` | `/api/v1/decisions` | Query recent persisted routing decisions | No |
| `POST` | `/api/v1/policies` | Switch routing policy (`round_robin\|least_connections\|ai_latency`) | **Yes** |
| `GET` | `/api/v1/models/status` | Current active model version & schema | No |
| `POST` | `/api/v1/models/train` | Trigger model training on calibration samples | **Yes** |
| `GET` | `/api/v1/experiments` | List completed benchmark experiments | No |
| `POST` | `/api/v1/experiments` | Launch a controlled workload run | **Yes** |
| `GET` | `/api/v1/experiments/{id}/export` | Export raw metrics (`?format=csv\|json`) | No |

---

## 🧪 Testing & Quality Assurance

The project enforces rigorous automated testing covering unit, integration, persistence, and failure scenarios.

Run the test suite locally:
```powershell
cd backend
pytest -v
```

**All 18 automated tests passing:**
- Proxy routing determinism (Round Robin cyclic ordering)
- Least Connections tie-breaking
- Safe AI fallback when model is missing or corrupt
- Automatic node exclusion upon stale telemetry (>30s)
- Automatic exclusion of disabled nodes
- HTTP error (502) and timeout mappings
- Model artifact training & schema verification
- Admin token authentication checks
- Experiment matrix generation & CSV/JSON export

---

## 📚 Documentation Index

Comprehensive documentation is available in the [`docs/`](docs/) directory:

- 📖 [Master Technical Documentation](docs/PROJECT_DOCUMENTATION.md) — Complete end-to-end reference manual
- 📋 [Software Requirements Specification (SRS)](docs/02-srs.md)
- 🏛 [System Architecture & Data Flow](docs/03-architecture.md)
- 🗄 [Database Design & Schema](docs/04-database-design.md)
- 🔌 [API Contract & Specifications](docs/05-api-contract.md)
- 🤖 [ML Methodology & Training Guide](docs/06-ml-methodology.md)
- 🧪 [Testing & Evaluation Plan](docs/07-test-and-evaluation.md)
- 🔒 [Security & Risk Register](docs/08-security-and-risk.md)
- 📊 [Phase 7 Benchmark Results](docs/phase-7-benchmark-results.md)
- 📈 [Phase 8 Research Analysis](docs/phase-8-analysis.md)
- 🎓 [Viva Defense Questions & Answers](docs/VIVA_QUESTIONS_AND_ANSWERS.md)
- 🕹 [Demo Runbook](docs/DEMO_RUNBOOK.md)
- 📜 [Release Manifest](docs/RELEASE_MANIFEST.md)

---

## 🎓 Viva & Defense Cheat Sheet

| Question | Core Technical Answer |
|---|---|
| **Why Layer-7 instead of Layer-4?** | Layer-7 understands application-level HTTP request characteristics, status codes, and execution duration. Layer-4 (TCP/IP) only sees raw packet flows and port numbers. |
| **Why Random Forest over Reinforcement Learning?** | Tabular telemetry with small sample size suits tree ensembles. RL requires massive online exploration, risks destabilizing production traffic, and has unstable reward convergence. |
| **Why did AI not outperform on uniform load?** | Scikit-learn inference adds 2-5ms computation latency per request. On uniform fast workers (15-20ms), this inference overhead constitutes a 15-25% tax with no asymmetry to exploit. |
| **What happens if a backend crashes?** | Health probes mark the node `unhealthy`, and it is immediately excluded from the candidate pool before routing occurs. If an in-flight request fails, HTTP 502 is mapped and recorded with a correlation ID. |

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
