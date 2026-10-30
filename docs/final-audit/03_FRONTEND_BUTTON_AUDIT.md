# Frontend Button and Interaction Audit

## Verified interactions

`frontend/src/main.tsx` contains:

- Automatic refresh every three seconds.
- **Refresh live data** button calling `refresh()`.
- **API results** link to `/api/v1/experiments`.
- CSV export links for completed experiments.
- Health cards, KPI display, recent decisions, experiment comparison, empty states, and API error text.

## Not present

There is no UI control for:

- Switching Round Robin, Least Connections, or AI policy.
- Sending a demo request.
- Triggering health checks.
- Registering, disabling, or editing a backend.
- Creating, starting, or stopping an experiment.
- Selecting workload, duration, concurrency, repetitions, or failure scenario.
- Training or activating a model.
- Viewing model history or telemetry time series.
- Injecting or recovering failures.
- JSON export, filters, modals, settings, or multi-page navigation.

## Correctness and usability findings

- The displayed total decision count is the latest API page, capped at 50, not a database total.
- Local P95 calculation uses the decision array length rather than only latency-bearing records.
- There is no explicit initial loading state or freshness timestamp.
- Backend cards omit several telemetry fields available from the API.
- No automated frontend tests or browser acceptance evidence exists.

**Assessment:** useful read-only observer dashboard; documentation must not describe it as a full administration console.
