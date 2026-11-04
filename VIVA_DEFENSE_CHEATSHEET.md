# AI-Based Load Balancing System — Viva Defense & Examiner FAQ Cheatsheet

**Academic Affiliation:** Unitedworld Institute of Technology (UIT), Karnavati University  
**Degree:** Bachelor of Technology in Computer Science Engineering (B.Tech CSE)  
**Course:** Computer Networks | **Faculty Mentor:** Ms. Pragya Vats  
**Candidate:** Krishna Modi (Enrollment: 202307010006)

---

## 1. Quick Technical Snapshot (Elevator Pitch)

> *"Our project is an intelligent Layer-7 HTTP Reverse Proxy built with FastAPI, Scikit-Learn, React 19, and Docker Compose. Unlike classical static heuristics (Round Robin, Least Connections) that blindly route to straggler nodes in heterogeneous server clusters, our load balancer evaluates an 8-dimensional telemetry vector in real time using a trained Random Forest ensemble. It predicts upstream latency and routes requests to the optimal worker. In our 6-container empirical benchmark, it delivers a **63% reduction in P95 tail latency** (27.5ms vs 74.4ms for Round Robin) and achieves **100% straggler avoidance**, backed by Envoy-style Circuit Breakers and Consistent Hashing."*

---

## 2. Top 10 High-Probability Examiner Questions & Model Answers

### Q1: Why do you need AI for Load Balancing? Isn't Round Robin or Least Connections sufficient?
**Answer:**  
Traditional heuristics operate on static or delayed assumptions:
- **Round Robin** assumes all servers are identical and tasks take equal time. When a heterogeneous straggler exists (e.g., Worker B with 60ms delay vs Worker A with 15ms), Round Robin sends $1/3$ of all traffic to the slow node, causing queue build-up and massive tail latency spikes.
- **Least Connections** counts active TCP sockets, but in short HTTP/1.1 transactions or asynchronous I/O, a straggler node may have zero active connections at the moment of dispatch despite being thermally throttled or high in EWMA latency.
- **AI Latency Regression** models non-linear interactions between CPU utilization, memory pressure, smoothed EWMA latency, network RTT, and request payload size, proactively steering requests away before queues form.

---

### Q2: Why choose Random Forest Regressor over Deep Learning or Linear Regression?
**Answer:**
1. **Microsecond Inference Overhead:** Random Forest evaluation takes $\approx 1.2\text{ ms}$, whereas Deep Learning models (PyTorch/TensorFlow) incur $15\text{--}30\text{ ms}$ CPU inference latency unless high-end GPUs are attached. Adding 20ms of model overhead to save 30ms of network delay defeats the purpose.
2. **Tabular Robustness:** In our automated Multi-Model Tournament across identical calibration samples:
   - **Random Forest (Champion):** $\text{MAE} = 0.60\text{ ms}$, $R^2 = 0.965$, P95 inference $= 1.48\text{ ms}$.
   - **HistGradientBoosting:** $\text{MAE} = 0.85\text{ ms}$, $R^2 = 0.942$, P95 inference $= 0.95\text{ ms}$.
   - **Ridge Regression:** $\text{MAE} = 2.10\text{ ms}$, $R^2 = 0.820$ (fails to capture non-linear CPU/latency cliffs).
3. **Scale Invariance:** Decision tree bagging does not require real-time feature normalization or z-score scaling in the critical request path.
4. **Feature Attribution:** Random Forest provides Mean Decrease in Impurity (MDI) feature importances: `latency_ewma_ms` (61.7%), `request_class` (27.6%), `capacity_weight` (7.9%), `network_rtt_ms` (2.8%).

---

### Q3: What is EWMA and what formula does the system use?
**Answer:**  
**Exponentially Weighted Moving Average (EWMA)** smooths high-frequency network jitter while quickly responding to persistent trends.  
$$\text{EWMA}_t = \alpha \cdot Y_t + (1 - \alpha) \cdot \text{EWMA}_{t-1}$$
- $Y_t$: Current measured latency observation from the background prober.
- $\alpha = 0.3$: Smoothing factor giving a $\approx 3$-period effective memory window ($1/\alpha \approx 3.33$).
- Why not simple arithmetic mean? The arithmetic mean suffers from catastrophic memory lag; a slow server that recovered 5 minutes ago would still be penalized by older historical data.

---

### Q4: Explain the 5th routing policy — Consistent Hashing (Ketama Algorithm).
**Answer:**  
In distributed caching (Memcached, Redis, CDN edges), request stickiness is paramount to maintain hot in-memory caches.
- Standard modulo hashing ($h(k) \pmod N$) reshuffles nearly $100\%$ of keys whenever a backend node joins or leaves the pool ($N \to N \pm 1$).
- **Consistent Hashing** maps both backends and client request keys onto a continuous $2^{32} - 1$ MD5 ring. Each backend is assigned multiple virtual replica points (50 replicas per capacity weight unit) to ensure uniform distribution.
- When finding a target backend, the proxy hashes the client session key and performs a binary search ($O(\log M)$) for the next clockwise node on the ring.
- If a node fails, only $K/N$ keys map to a new neighbor, leaving $(N-1)/N$ keys unaffected.

---

### Q5: How does your Circuit Breaker & Outlier Ejection mechanism work?
**Answer:**  
Modeled after enterprise service meshes (Envoy / Istio), each backend maintains a Finite State Machine:
1. **`CLOSED` (Normal):** Backend handles traffic. The manager monitors consecutive timeout/error counts and latency EWMA.
2. **`OPEN` (Tripped / Ejected):** Triggered when a node logs 3 consecutive failures or its latency EWMA exceeds $85\text{ ms}$. The node is ejected from the candidate routing pool for a **15.0-second cooldown period**.
3. **`HALF_OPEN` (Canary Probe):** Once cooldown expires, the breaker admits a single canary request. If the canary succeeds, the state transitions back to `CLOSED` and counters reset; if it fails, it returns to `OPEN` for another cooldown.
4. **Zero-Blackhole Fallback:** If all backends trip simultaneously (cluster blackout), the proxy falls back to best-effort degraded routing rather than returning immediate 503 errors.

---

### Q6: What OSI layers does this system interact with?
**Answer:**
- **Layer 7 (Application):** HTTP/1.1 request inspection, path routing (`/api/v1/route`), reverse proxying, correlation headers (`X-Request-ID`), and error payload mapping.
- **Layer 4 (Transport):** TCP connection pool management, TCP active socket queue monitoring, timeout boundaries (HTTPX client timeouts).
- **Layer 3 (Network):** IP address resolution, subnet routing in Docker bridge network (`172.18.0.0/16`), and inter-container gateway routing.
- **Layer 2 (Data Link):** Packet transmission timing, synthetic propagation delays, and RTT emulation.

---

### Q7: What is Dean & Barroso's "Tail at Scale" principle, and how does your project address it?
**Answer:**  
In modern cloud architectures, a single user request often triggers tens or hundreds of sub-queries across microservice tiers. If each sub-query has a $99\text{th}$ percentile latency of $1\%$, a composite transaction involving 100 parallel calls will suffer tail latency delays in $1 - (0.99)^{100} = 63.4\%$ of requests!  
**Mean latency is a vanity metric; P95 and P99 latency dictate user perception.**  
Our project directly tackles tail latency:
- Round Robin P95: **74.37 ms**
- AI Latency P95: **27.50 ms** (**63.0% reduction**)
- The Cumulative Distribution Function (CDF) curve shows AI routing reaching $F(x) = 1.0$ at 30ms, completely lopping off the long tail caused by Worker B.

---

### Q8: What happens if the AI model artifact is corrupted, missing, or throws an exception?
**Answer:**  
The proxy implements a deterministic **Graceful Degradation Fallback**:
- If `RandomForestRegressor` prediction fails, takes too long, or the model file on disk is invalid, the proxy catches the exception immediately and falls back to **Least Connections** in $< 0.05\text{ ms}$.
- This behavior is certified in our automated Pytest test suite: `test_ai_invalid_prediction_uses_safe_fallback` and `test_missing_ai_model_uses_safe_fallback`.

---

### Q9: Why did you eliminate the administrative token requirement?
**Answer:**  
In production microservice topologies (e.g., Kubernetes service mesh or Envoy sidecar architectures), proxy telemetry probes, health telemetry queries, and internal policy adjustments execute inside a private VPC bridge network.  
Imposing token authentication on high-frequency internal sidecar routes introduces unnecessary CPU serialization overhead and operational friction. In our zero-friction model, administrative routes operate freely within the private management subnet, while external client ingress is guarded at the API gateway boundary.

---

### Q10: How did you test and verify system reliability?
**Answer:**
- **Pytest Suite:** 47 passing unit and integration tests covering:
  - Liveness/readiness probes (`/health/live`, `/health/ready`).
  - Strict contract enforcement and error correlation (`X-Request-ID`).
  - Consistent Hash ring uniformity and key determinism.
  - Circuit breaker trip, cooldown, and canary recovery flows.
  - Chaos injection API endpoints (`trip` / `reset`).
  - Multi-model tournament benchmarking and fallback mechanics.
  - Contextual Bandit UCB1 online arm convergence and reward calculations.
  - Token Bucket rate limiter capacity and RFC 6585 header generation.
  - Dynamic worker hardware delay injections and reset.
  - Canary deployment probabilistic traffic splitting.
  - W3C distributed waterfall latency trace generation.
- **Docker Compose Fleet:** 6 isolated containers running PostgreSQL 16, FastAPI backend, Nginx frontend, and 3 heterogeneous workers (A, B, C).
- **TypeScript Static Verification:** Vite build and TypeScript compiler (`tsc -b`) passing with **0 errors**.

---

### Q11: Explain the 6th routing policy — Contextual Bandit (Upper Confidence Bound / UCB1).
**Answer:**
- **Why Online RL?** Supervised learning (Random Forest) requires offline training sets and periodic retraining. A Contextual Multi-Armed Bandit adapts **online in real time** without retraining cycles.
- **UCB1 Formulation:** For each eligible worker $i$:
  $$\text{Score}_i = \hat{\mu}_i + c \sqrt{\frac{\ln t}{N_i}}$$
  - $\hat{\mu}_i$: Empirical average reward observed for worker $i$.
  - $N_i$: Total times worker $i$ has been selected.
  - $t = \sum N_i$: Total routing decisions across all arms.
  - $c = 1.414$ ($\sqrt{2}$): Theoretical exploration parameter.
- **Reward Function:** $R = \frac{100}{\text{latency\_ms}}$. Fast responses (~22ms) deliver high rewards (~4.5), while straggler responses (~67ms) deliver low rewards (~1.5).
- **Behavior:** The $\sqrt{\ln t / N_i}$ uncertainty bonus forces periodic exploration of untested workers, while $\hat{\mu}_i$ ensures heavy exploitation of the fastest node.

---

### Q12: How does OpenTelemetry-style Distributed Waterfall Tracing work?
**Answer:**
- **W3C Standards:** The proxy injects a W3C-compliant `traceparent` header (`00-<32char-trace-id>-<16char-span-id>-01`) into every proxied HTTP request.
- **Sub-Millisecond Stage Breakdown:** The proxy timestamps every phase:
  1. `ingress_ms`: HTTP body parsing and validation (~0.2ms).
  2. `selection_ms`: Running the routing algorithm / ML inference (~1.2ms).
  3. `upstream_ms`: HTTP round-trip over Docker network to backend worker (~22ms).
  4. `db_audit_ms`: Asynchronous persistence of the decision record in PostgreSQL (~1.5ms).
- **Flame-Graph Visualization:** These stages are returned in the `X-Waterfall-Trace` header and rendered as an interactive flame-graph inside the HUD's Decision Inspector.

---

### Q13: What are the Token Bucket Rate Limiter and Canary Deployment mechanisms?
**Answer:**
- **Token Bucket Rate Limiter (RFC 6585):**
  - Maintains a continuous token bucket with burst capacity $C = 100$ and refill rate $r = 10\text{ tokens/sec}$.
  - When tokens are depleted, it rejects excess traffic with HTTP `429 Too Many Requests`, returning `Retry-After: 1` and `X-RateLimit-Remaining: 0`, protecting downstream workers from cascading collapse.
- **Canary Deployment Traffic Splitting:**
  - Enables progressive rollout of new policies (e.g., 20% traffic routed via AI Latency while 80% remains on Round Robin).
  - Configurable live via `POST /api/v1/system/canary` and the Cockpit HUD without proxy restarts.

---

## 3. Mathematical Formula Quick Reference

| Concept | Mathematical Equation | Significance in Project |
| :--- | :--- | :--- |
| **EWMA Latency** | $S_t = \alpha Y_t + (1-\alpha)S_{t-1}$ | Filters network spikes; $\alpha=0.3$ weights recent observations. |
| **Consistent Hash Ring** | $pos = \text{MD5}(key) \pmod{2^{32}}$ | Virtual node distribution across 32-bit ring; preserves cache affinity. |
| **Outlier Ejection** | $\text{Failures} \ge 3 \lor \text{EWMA} > 85\text{ms} \implies \text{OPEN}$ | Automatically isolates stalling nodes for 15s cooldown. |
| **Tail Latency Reduction** | $\Delta P95 = \frac{74.37 - 27.50}{74.37} \times 100\% = 63.0\%$ | Eliminates queue delay by steering away from Worker B. |
| **Random Forest Bagging** | $\hat{f}(x) = \frac{1}{B}\sum_{b=1}^{B} f_b(x)$ | Averages 100 decision trees to minimize prediction variance. |
| **Contextual Bandit UCB1** | $\text{Score}_i = \hat{\mu}_i + c\sqrt{\frac{\ln t}{N_i}}$ | Online RL exploration vs exploitation; reward $r = 100/\text{latency}$. |
| **Token Bucket Limiter** | $B_t = \min(C, B_{t-1} + r \Delta t)$ | RFC 6585 rate limiting preventing microservice overload. |
