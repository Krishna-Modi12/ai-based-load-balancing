# Final Release Notes

## Current Release: v1.1.0 (Master Innovations Release)

- **Release Version:** `v1.1.0`
- **Current Archive:** `AI_Based_Load_Balancing_v1.1.0.zip`
- **Backend Test Suite:** **47 passing Pytest test cases** (`python -m pytest tests/ -v`)
- **Frontend Architecture:** React 19 + TypeScript 5.7 built with Vite 6 (0 errors)
- **Academic Documents:** Standardized KU/UIT 18-Slide Presentation (`.pdf`, `.pptx`) and Project Report (`.pdf`, `.docx`, `.md`)

### Key Innovations Added in v1.1.0

1. **6th Routing Policy — Contextual Bandit (Online Reinforcement Learning - UCB1):**
   - Implements Upper Confidence Bound formula $\text{Score}_i = \hat{\mu}_i + c \sqrt{\ln(t) / N_i}$.
   - Provides online reward feedback ($100 / \text{latency\_ms}$) without requiring batch retraining, adapting dynamically to gradual server performance drift.

2. **OpenTelemetry-Style W3C Distributed Waterfall Tracing:**
   - Injects W3C `traceparent` headers into upstream proxied requests.
   - Measures sub-millisecond stage breakdowns: Ingress Parsing, Route Selection, Upstream Transmission, and PostgreSQL Audit write.
   - Interactive flame-graph visualization in Decision Inspector and 1-click HAR 1.2 trace exporter.

3. **Token Bucket Ingress Rate Limiting (RFC 6585):**
   - Implements token bucket algorithm with configurable burst capacity and refill rate.
   - Returns HTTP `429 Too Many Requests`, `Retry-After: 1`, and `X-RateLimit-*` headers when exhausted.

4. **Live Worker Hardware Delay Chaos Sliders:**
   - Interactive sliders for Worker A, B, and C in the cockpit HUD to inject live latency (0-200ms) without container restarts.

5. **Canary Deployments & Traffic Splitting:**
   - Probabilistic routing engine allowing live percentage-based traffic splits (5% to 95%) between baseline and canary policies.

6. **Native Prometheus Metrics Exporter:**
   - Standard OpenMetrics endpoint at `GET /metrics` for direct integration with Prometheus and Grafana.

7. **4-Phase Live Defense Runner (`run_demo.ps1`):**
   - Fully automated interactive demonstration covering Round Robin, AI Predictive Latency, Contextual Bandit Arm Convergence, and Circuit Breaker failover with comparison scorecard.

---

## Historical Release Candidates

### v1.0.9 (Academic Defense & Enterprise Innovation Release)

- **Release Version:** `v1.0.9`
- **Current Archive:** `AI_Based_Load_Balancing_v1.0.9.zip`
- **Backend Test Suite:** **37 passing Pytest test cases** (`python -m pytest tests/ -v`)
- **Frontend Architecture:** React 19 + TypeScript 5.7 built with Vite 6 (0 errors)
- **Academic Documents:** Standardized KU/UIT 18-Slide Presentation (`.pdf`, `.pptx`) and Project Report (`.pdf`, `.docx`, `.md`)

### Key Innovations Added in v1.0.9

1. **5th Routing Policy — Consistent Hashing (Ketama Algorithm):**
   - Implements a continuous 32-bit MD5 hash ring with virtual nodes (50 replicas per capacity weight).
   - Provides deterministic client session affinity, preserving cache locality and minimizing key remapping during cluster topology adjustments.

2. **Envoy-Style Circuit Breakers & Dynamic Outlier Ejection:**
   - Autonomous Finite State Machine (`CLOSED` -> `OPEN` -> `HALF_OPEN`).
   - Automatically detects and isolates stalling backends (EWMA latency > 85ms or 3 consecutive timeouts) for a 15-second cooldown period, followed by canary recovery probing.
   - Built-in zero-blackhole fallback ensures uniform degraded routing during complete cluster blackout.

3. **Multi-Model ML Tournament Arena:**
   - Benchmarks the Random Forest champion against Histogram Gradient Boosting and Ridge Regression across validation MAE, RMSE, $R^2$ score, training time, and microsecond inference latency.
   - Dynamic 1-click model hot-swapping via REST API and cockpit HUD.

4. **UI Unslopping & Graphite Dark Design System:**
   - Audited and refactored under strict `unslop` principles.
   - Elevation ramp built on `#141415` (canvas), `#19191b` (surface cards), `#232325` (raised controls), and `#ededed` (primary text) with quiet 1px hairline borders.
   - Removed arbitrary pixel typography, generic `transition-all`, neon glow shadows, and emojis.
   - Full tabular numeric stabilization (`font-variant-numeric: tabular-nums`) and WCAG 2.2 AA accessibility.

5. **Zero-Barrier Open Operational Model:**
   - Completely eliminated administrative token enforcement across all proxy mutations, chaos simulations, and frontend controls for zero-friction internal edge routing.

6. **Automated Live Defense Demo Runner (`run_demo.ps1`):**
   - Interactive PowerShell presentation runner executing a 3-phase demonstration (Round Robin baseline, AI predictive latency with 40%+ latency drop, and circuit breaker fault injection) with an ASCII comparison scorecard.

---

### v1.0.7
- Source hardening and full-system audit fixes.
- Removed unused build-time admin token path.
- Localhost port binding and reproducible `npm ci`.

### v1.0.6
- Pinned frontend dependencies, semantic HTML, and accessibility enhancements.

### v1.0.3
- Database-committed policy responses, time-window telemetry filtering, and model validation guards.
