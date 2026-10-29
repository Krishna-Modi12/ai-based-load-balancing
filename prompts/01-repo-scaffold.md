# Antigravity Prompt 01 — Repository and developer tooling

Read `docs/02-srs.md`, `docs/03-architecture.md`, and `docs/10-github-workflow.md`. Scaffold the codebase without implementing the full product yet.

Create a coherent repository with `backend/`, `frontend/`, `workers/`, `ml/`, `load_testing/`, `db/`, `tests/`, `deployment/`, `docs/`, `prompts/`, `.github/`. Add `.gitignore`, `.env.example`, `CONTRIBUTING.md`, a suitable license placeholder or MIT only if team ownership permits it, editor/formatting configs, pinned compatible dependencies, and initial CI. Keep generated dependencies, environment secrets, DB volumes and trained binary models out of Git by default.

Create a Docker Compose file for `frontend`, `api`, `db`, `worker-a`, `worker-b`, and `worker-c`. Configure service-to-service DNS names and environment variables explicitly. The DB must use a named volume and health check. Do not pretend this is production-hardened. Provide a README quick start with exact commands and expected health checks.

For now implement only a minimal API app and three workers that expose `/health`, `/metrics`, and a safe `/demo` endpoint. Give each worker a distinct ID/capacity/base delay through environment variables. Add a Round Robin selection strategy and a single safe proxy endpoint. Use strict timeouts and only the configured worker registry; do not accept arbitrary upstream URLs from HTTP callers. Add pytest tests for health and selection logic.

Before finalizing, validate compose config if Docker is available, run tests, inspect files for accidental secrets, and report exact verification outcomes. Do not build the frontend beyond a minimal connection/status shell in this phase.
