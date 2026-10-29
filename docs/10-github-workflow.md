# 10. GitHub Repository and Team Workflow

## Naming
Suggested repository: `ai-based-load-balancing`. Suggested description: `Full-stack, ML-assisted HTTP load-balancing testbed with conventional baselines, telemetry dashboard, and reproducible benchmarks.`

## Branches and commits
- `main`: always runnable/reviewed.
- `feat/<short-name>`: one feature at a time.
- `fix/<short-name>`: bug fix.
- Commit after each stable milestone; avoid one giant initial commit.
- Use messages such as `feat(router): add least-connections policy` and `test(ml): cover invalid prediction fallback`.

## Required pull request checklist
- [ ] Requirements/docs updated if behaviour changed.
- [ ] Tests added/updated and passing locally.
- [ ] No credentials, model data, or large generated artifacts committed accidentally.
- [ ] Database migration included for schema changes.
- [ ] API contract and UI updated consistently.
- [ ] Benchmark claims cite an experiment artifact.
- [ ] Screenshots updated when UI changes materially.

## Recommended repository hygiene
- `.gitignore`: `.env`, virtual environments, node modules, caches, coverage, logs, local DB volumes, raw test artifacts that contain secrets, large model binaries unless intentionally versioned.
- `.env.example`: documented placeholder settings only.
- `CONTRIBUTING.md`: formatting, test, branch, and commit rules.
- `LICENSE`: select according to team/institution ownership policy; this starter proposes MIT only if your team is permitted to license the project that way.
- CI: install backend dependencies, lint/typecheck/test backend, install frontend dependencies, run frontend build/tests, and run migration smoke test where feasible.
- Releases: tag known-good demos; attach report, experiment summaries, and source revision.

## GitHub project board
Suggested columns: Backlog → Ready → In progress → In review → Test/evidence → Done. Create labels `backend`, `frontend`, `ml`, `networking`, `database`, `testing`, `docs`, `good-first-issue`, and `risk`.

## Suggested initial issues
1. Scaffold Compose services and environment configuration.
2. Implement worker health/metrics endpoints.
3. Implement registry and periodic health checking.
4. Implement Round Robin proxy route.
5. Implement Least Connections policy and concurrent request accounting.
6. Persist decisions and telemetry.
7. Add experiment model and result export.
8. Build overview dashboard.
9. Add controlled workload runner and calibration dataset capture.
10. Add model training/versioning/inference fallback.
11. Add experiment comparison and plots.
12. Add failure tests, CI, deployment guide, final report evidence.
