# Antigravity Prompt 00 — Plan before coding

Act as the technical lead for a Computer Networks project titled **AI-Based Load Balancing in Computer Networks**. First read the entire repository README and all files under `docs/` and `prompts/`. The scope is a full-stack, locally reproducible Layer-7 HTTP load-balancing research demonstrator, not a production product and not an SDN controller in the MVP.

## Objective
Create a concrete implementation plan first. Do not modify code during this planning pass; the implementation starts with Prompt 01 after the team reviews the plan. Use the proposed stack: React + TypeScript + Vite; FastAPI + Pydantic + SQLAlchemy + Alembic; PostgreSQL; three worker services; scikit-learn latency regressor; Docker Compose; pytest/Locust.

## Mandatory engineering rules
1. Inspect current files before editing; preserve valid existing work.
2. Follow the SRS, architecture, database design, API contract, and ML methodology. If they conflict, document the conflict and recommend one consistent change instead of silently improvising.
3. Implement in small phases and produce a task checklist, file-change summary, and verification evidence after each phase.
4. Do not fabricate test output, benchmark results, training metrics, screenshots, or references.
5. Write tests with implementation; run them and fix failures. Never say tests pass if they were not run.
6. Keep secrets out of source control. Create `.env.example`, not a real `.env` with secrets.
7. Registered worker URLs only; no user-supplied arbitrary upstream URLs. Add strict proxy timeouts and a bounded request interface.
8. AI mode must filter unhealthy nodes and fall back to a baseline for missing/stale/invalid model inference.
9. Keep model training out of the live request path. Version features and models. Record fallback reasons.
10. Do not begin the optional Mininet/SDN extension until the core project passes its acceptance checklist.

## First deliverable
Return: (a) repository audit, (b) architecture/technology decisions, (c) phased tasks, (d) high-risk assumptions, (e) commands to run locally, (f) acceptance tests. Do not create or edit source files in this prompt. Finish with a prioritized implementation sequence, task dependencies, acceptance tests, unresolved assumptions, and the exact next prompt to run. If a requirement cannot be implemented as drafted, flag it and propose the smallest defensible correction.
