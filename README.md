# AI-Based Load Balancing in Computer Networks

> **Project starter kit (documentation-first).** The implementation, benchmark results, and screenshots are intentionally not fabricated. Use the prompts in `/prompts` in order to build, test, and document the working system.

## Project concept

Build a demonstrable **Layer-7 HTTP load balancer** that routes requests across three or more backend services. It compares conventional baselines (Round Robin and Least Connections) with an ML-assisted policy that predicts each healthy backend's likely response latency using recent telemetry, then chooses the best eligible backend. A React dashboard shows server health, routing decisions, latency, throughput, failures, and reproducible experiment results.

This is application-layer load balancing with simulated/observed network and service conditions. It is **not** a claim that the MVP is a Layer-3/Layer-4 router or an SDN controller. A Mininet/OpenFlow extension is documented as an optional second phase.

## Proposed stack

- **Frontend:** React + TypeScript + Vite; Tailwind CSS; Recharts; responsive dashboard.
- **Backend/control plane:** Python + FastAPI + Pydantic; HTTPX reverse proxy; SQLAlchemy 2.x + Alembic.
- **Database:** PostgreSQL.
- **ML:** scikit-learn `RandomForestRegressor` to predict observed request latency; a safe non-ML fallback is mandatory.
- **Workers:** three identical HTTP worker services with separately configured capacity, baseline delay, and optional load simulation.
- **Testing and operations:** pytest, frontend tests, Locust, Docker Compose, GitHub Actions; optionally Prometheus/Grafana later.

## Required project principles

1. Compare AI against baselines under the **same workload, backend capacities, and test duration**.
2. Never route to an unhealthy node solely because its predicted score looks good.
3. Keep a fallback policy if the model is missing, stale, errors, or produces invalid predictions.
4. Separate measured results from simulated results. Never claim an improvement before the benchmark runs.
5. Fix random seeds where applicable, save each run's configuration, and export raw run metrics to CSV/JSON.
6. Do not collect request bodies, credentials, or personal data for this academic project.

## Repository map

```text
ai-based-load-balancing/
├── backend/                 # FastAPI control plane, proxy, routing, telemetry, ML
├── frontend/                # React dashboard
├── workers/                 # reusable worker app + demo profiles
├── load_testing/            # Locust scenarios and experiment profiles
├── ml/                      # dataset tooling, training, evaluation, model artifacts metadata
├── db/                      # migrations, seed data, schema notes
├── tests/                   # unit, integration, routing, failure, API tests
├── docs/                    # SRS, architecture, API, testing, report and research
├── prompts/                 # Antigravity agent prompts in implementation order
├── deployment/              # Docker Compose, env example, observability configs
├── .github/                 # issue/PR templates and CI
├── .env.example
├── .gitignore
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

## Start in Google Antigravity

1. Create an empty local folder and initialize it as a Git repository (or create an empty GitHub repository and clone it).
2. Open the folder in Antigravity IDE / app. The official overview describes agentic work across editor, terminal, and browser, plus plan/artifact review: <https://antigravity.google/docs/ide/overview/>.
3. Paste `prompts/00-project-planning.md`; review the generated plan and architecture before asking it to code.
4. Execute the remaining prompts **one phase at a time**. Run commands and tests locally; inspect the diff after each phase. Commit each stable milestone.
5. Start with the minimum vertical slice: PostgreSQL + API + 3 workers + Round Robin + proxy route. Add ML only after routing and telemetry are correct.

## Documentation index

- [Project charter](docs/01-project-charter.md)
- [Software requirements specification](docs/02-srs.md)
- [System architecture](docs/03-architecture.md)
- [Database design](docs/04-database-design.md)
- [API contract](docs/05-api-contract.md)
- [ML methodology](docs/06-ml-methodology.md)
- [Test and evaluation plan](docs/07-test-and-evaluation.md)
- [Security, risks, and reliability](docs/08-security-and-risk.md)
- [Final report structure](docs/09-final-report-structure.md)
- [GitHub workflow](docs/10-github-workflow.md)
- [Implementation roadmap](docs/11-roadmap.md)
- [Phase 7 experiment methodology and results](docs/phase-7-experiment-methodology.md)
- [Phase 7 benchmark results](docs/phase-7-benchmark-results.md)
- [Phase 8 research analysis](docs/phase-8-analysis.md)
- [Phase 8 failure-mode results](docs/phase-8-failure-mode-results.md)
- [Final project report](docs/FINAL_PROJECT_REPORT.md)
- [Formatted Word report](docs/FINAL_PROJECT_REPORT.docx)
- [Presentation](docs/AI_Based_Load_Balancing_Presentation.pptx)
- [Demonstration runbook](docs/DEMO_RUNBOOK.md)
- [Viva questions and answers](docs/VIVA_QUESTIONS_AND_ANSWERS.md)
- [Final comprehensive audit](docs/final-audit/FINAL_PROJECT_AUDIT_REPORT.md)
- [Audit summary](docs/final-audit/00_EXECUTIVE_AUDIT_SUMMARY.md)
- [Release manifest](docs/RELEASE_MANIFEST.md)
- [Research notes and sources](docs/12-research-and-sources.md)
- [Demo/viva script](docs/13-demo-script.md)
- [Project proposal report (DOCX)](AI_Based_Load_Balancing_Project_Proposal.docx)
- Antigravity prompts in `/prompts`

## Implemented local vertical slice

The repository now contains a working FastAPI proxy, three configurable worker services, SQLAlchemy schema/Alembic revision, Round Robin and Least Connections policies, a latency-model training path with safe fallback, a live API-driven React overview, Compose deployment, Locust scenario, and backend tests. It is not yet an experimental-results report: run the controlled workloads before making performance claims. See [the implementation plan](docs/14-implementation-plan.md).

### Run locally

```powershell
Copy-Item .env.example .env
# Edit .env and set ADMIN_TOKEN to a local secret
docker compose -f deployment/docker-compose.yml up --build
```

Open `http://localhost:5173`. Use the configured token in the `X-Admin-Token` header to trigger `POST /api/v1/backends/health-check-all` before sending `GET /api/v1/route?request_class=normal`.

For backend unit tests:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
$env:PYTHONPATH = (Get-Location).Path
pytest -q
```

### Phase 7 experiments

The experiment API and CLI run measured, bounded workloads only. Defaults are
safe (10-second measurement, 2-second warm-up, concurrency 4, three
repetitions); use a longer duration only against the local Compose stack.

```powershell
cd "C:\Users\krish\OneDrive\Desktop\CN Project\ai_load_balancer_starter"
$env:PYTHONPATH=(Join-Path (Get-Location) "backend")
python -m app.experiment_cli --matrix
# One run:
python -m app.experiment_cli --policy least_connections --profile mixed --duration 30 --warmup 5
```

Run status, comparison data, and raw exports are available at
`GET /api/v1/experiments`, `GET /api/v1/experiments/{id}/results`, and
`GET /api/v1/experiments/{id}/export?format=csv|json`. The dashboard displays
completed-run comparisons only. See
`docs/phase-7-experiment-methodology.md`; unexecuted results remain pending.

The verified 36-run result is documented in
`docs/phase-7-benchmark-results.md`. The measured AI policy was slower and
lower-throughput than both baselines in all four profiles; this is a bounded
local finding, not a universal claim. Phase 8 reliability evidence and the
academic report are in `docs/phase-8-failure-mode-results.md`,
`docs/phase-8-analysis.md`, and `docs/FINAL_PROJECT_REPORT.md`.

## Definition of done

The project is not complete just because the dashboard looks good. Completion requires routing correctness, recorded telemetry, persistent experiments, failure handling, API and frontend tests, benchmark comparisons, installation instructions, a reproducible demo, and a final report containing only results actually produced by the implementation.
