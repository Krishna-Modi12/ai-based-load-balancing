# Final Release Notes

## Current candidate

- Release candidate: `v1.0.2`
- Latest commit before subsequent closure edits: `9aeac39`
- Current archive: `AI_Based_Load_Balancing_v1.0.2.zip`
- Historical benchmark matrix: 36 valid runs, preserved unchanged

## Closure edits after v1.0.2

The following code hardening was applied after the v1.0.2 archive state:

- Policy update responses now return the value committed to the database rather than a process-local value.
- Metrics summary now applies the requested time window.
- Metrics timeseries now aggregates decisions into the requested step buckets.
- Model activation validates the selected artifact itself before activation.

These edits require a new release candidate archive if they are intended for submission.

## Known limitations

- Academic identity and signature fields require student/institution input.
- Word and PowerPoint visual validation requires Microsoft Office or another compatible renderer.
- Multi-process policy concurrency remains untested.
- Missing-model and stale-telemetry experiment scenarios remain operator-injected.
- Clean archive installation was verified, but clean model provisioning was not.
- The project is an academic prototype, not a production security certification.
