# 7. Test and Evaluation Plan

## 7.1 Test layers

### Unit tests
- Round Robin order and behavior with disabled/unhealthy workers.
- Least Connections tie-breaking and in-flight counter correctness.
- Feature construction and feature schema/version validation.
- AI predicted-cost ranking, invalid predictions, model-not-loaded fallback.
- Health status staleness thresholds and telemetry validation.
- Percentile and aggregate metric calculation.
- Error mapping and request correlation IDs.

### API and database tests
- Backend registration, validation, update, list and pagination.
- Create/update experiment and export results.
- Routing decision persistence on success and proxy failure.
- Alembic migrations from an empty database.
- Access control for mutating endpoints.

### Integration tests
- Run API + three workers + test database.
- Each policy forwards to an eligible worker.
- Worker failure removes it from candidates.
- Proxy timeout is bounded and error event is recorded.
- PostgreSQL outage does not produce silent success; degraded/readiness behaviour is explicit.
- Model artifact unavailable/corrupt produces safe fallback.

### Frontend tests
- Dashboard displays loading, populated, stale, and error states.
- Policy switch control maps to the API contract.
- Experiment configuration is validated before submission.
- Charts and tables handle empty datasets and large numbers.
- Basic accessibility: keyboard navigation, label text, contrast, and chart summaries.

### Performance tests
Use Locust for controlled request rate/concurrency. Include a warm-up, a fixed test window, and a cool-down. Do not run unbounded load tests against anything except your own local test services. Store configuration and raw results per run.

## 7.2 Experiment matrix

| Scenario | Purpose | Policies |
|---|---|---|
| Uniform capacity / uniform work | Validate correctness and baseline behaviour | RR, LC, AI |
| Unequal capacity | Test whether policy considers measured worker differences | RR, LC, AI |
| Burst traffic | Evaluate adaptation and tail latency | RR, LC, AI |
| Mixed request cost | Evaluate latency prediction under different request classes | RR, LC, AI |
| Worker crash/timeout | Validate fault avoidance and failover | All |
| Missing/stale telemetry | Validate conservative routing behaviour | AI + fallback |
| Missing/bad model | Validate non-ML fallback | AI + fallback |
| Repeated runs | Evaluate run-to-run variation | All |

## 7.3 Result table template

| Profile | Policy | Repetition | Requests | Throughput (req/s) | p50 (ms) | p95 (ms) | p99 (ms) | Error rate (%) | Balance CV | Notes |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| [profile] | [policy] | [1] | [measured] | [measured] | [measured] | [measured] | [measured] | [measured] | [measured] | [conditions] |

## 7.4 Completion evidence
Include test command output, CI run link, API docs screenshot, dashboard screenshots, one node-failure observation, raw CSV/JSON exports, Python plotting script, and environment/version information in the final evidence folder. Never fabricate screenshots or test logs.

## 7.5 Definition of a successful demonstration
The operator can start the stack, view three healthy workers, generate requests, switch policies, observe routing/metrics, run an experiment, fail one worker, see traffic avoid it, inspect the AI model/fallback state, and export data. Performance superiority is a separate empirical question and must be concluded from measured results.
