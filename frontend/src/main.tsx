import { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

type Backend = {
  id: string;
  name: string;
  health_status: string;
  enabled: boolean;
  capacity_weight: number;
  last_health_at?: string;
};

type Decision = {
  request_id: string;
  policy: string;
  selected_backend_id?: string;
  predicted_latency_ms?: number;
  actual_latency_ms?: number;
  status_code?: number;
  success: boolean;
  fallback_reason?: string;
  decided_at: string;
};

type ExperimentMetric = {
  request_count: number;
  success_count: number;
  error_count: number;
  throughput_rps: number;
  error_rate: number;
  latency_p50_ms?: number;
  latency_p95_ms?: number;
  latency_p99_ms?: number;
  ai_prediction_mae_ms?: number;
  distribution_json?: Record<string, number>;
};

type Experiment = {
  id: string;
  name: string;
  policy: string;
  workload_profile: string;
  repetition: number;
  scenario: string;
  status: string;
  ended_at?: string;
  metric?: ExperimentMetric;
};

const api = import.meta.env.VITE_API_BASE_URL || "";
const configuredAdminToken = import.meta.env.VITE_ADMIN_TOKEN || "";
const TOKEN_STORAGE_KEY = "lb_admin_token";

function getInitialToken(): string {
  try {
    const saved = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (saved) return saved;
  } catch {
    // sessionStorage not accessible
  }
  return configuredAdminToken;
}

const getHeaders = (adminToken: string): Record<string, string> =>
  adminToken
    ? { "X-Admin-Token": adminToken, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };

function formatTime(isoString?: string): string {
  if (!isoString) return "—";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString();
}

function extractErrorMessage(body: any, label: string): string {
  if (!body) return `${label} failed`;
  if (body.error?.message) return body.error.message;
  if (typeof body.detail === "string") return body.detail;
  if (Array.isArray(body.detail) && body.detail[0]?.msg) {
    return body.detail.map((d: any) => d.msg).join("; ");
  }
  return `${label} failed`;
}

function App() {
  const [backends, setBackends] = useState<Backend[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [status, setStatus] = useState<{ policy: string; model_ready: boolean; model_version?: string }>({
    policy: "loading",
    model_ready: false,
  });
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [error, setError] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notice, setNotice] = useState("");
  const [adminToken, setAdminToken] = useState(getInitialToken);

  const isInitialMount = useRef(true);

  const handleTokenChange = (val: string) => {
    setAdminToken(val);
    try {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, val);
    } catch {
      // sessionStorage not accessible
    }
  };

  const refresh = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const [b, d, s, e] = await Promise.all([
        fetch(`${api}/api/v1/backends`),
        fetch(`${api}/api/v1/decisions`),
        fetch(`${api}/api/v1/system/status`),
        fetch(`${api}/api/v1/experiments`),
      ]);

      if (!b.ok || !d.ok || !s.ok || !e.ok) {
        throw new Error("One or more endpoints returned an error");
      }

      setBackends(await b.json());
      setDecisions(await d.json());
      setStatus(await s.json());
      setExperiments(await e.json());
      setError("");
    } catch (err: any) {
      if (isInitialMount.current || !silent) {
        setError("Cannot reach the API. Ensure Docker Compose is up and backends are healthy.");
      }
    } finally {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        setInitialLoading(false);
      }
      if (!silent) setIsRefreshing(false);
    }
  };

  const action = async (label: string, url: string, options: RequestInit = {}) => {
    setNotice("");
    setError("");
    try {
      const response = await fetch(`${api}${url}`, {
        ...options,
        headers: { ...getHeaders(adminToken), ...(options.headers || {}) },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(extractErrorMessage(body, label));
      }
      setNotice(`${label} completed successfully`);
      await refresh(false);
      return body;
    } catch (e: any) {
      setError(e instanceof Error ? e.message : `${label} failed`);
    }
  };

  const setPolicy = (policy: string) =>
    action("Policy update", "/api/v1/routing/mode", {
      method: "PUT",
      body: JSON.stringify({ policy }),
    });

  const demoRequest = () => action("Demo request", "/api/v1/route?request_class=normal");
  const healthCheck = () => action("Health check", "/api/v1/backends/health-check-all", { method: "POST" });
  const trainModel = () => action("Model training", "/api/v1/models/train", { method: "POST" });

  const createExperiment = () =>
    action("Experiment creation", "/api/v1/experiments", {
      method: "POST",
      body: JSON.stringify({
        name: `dashboard-${Date.now()}`,
        policy: status.policy === "loading" ? "round_robin" : status.policy,
        workload_profile: "uniform",
        repetition: 1,
        scenario: "none",
        duration_seconds: 10,
        warmup_seconds: 2,
        concurrency: 2,
        target_base_url: api || (typeof window !== "undefined" ? window.location.origin : "http://localhost:8000"),
      }),
    });

  const toggleBackend = (backend: Backend) =>
    action(`${backend.name} update`, `/api/v1/backends/${backend.id}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled: !backend.enabled }),
    });

  useEffect(() => {
    refresh(false);
    const id = window.setInterval(() => refresh(true), 3000);
    return () => clearInterval(id);
  }, []);

  const successful = decisions.filter((d) => d.success).length;
  const withLatency = decisions
    .map((d) => d.actual_latency_ms)
    .filter((ms): ms is number => typeof ms === "number" && !isNaN(ms))
    .sort((a, b) => a - b);

  let p95: number | undefined;
  if (withLatency.length > 0) {
    const idx = Math.min(withLatency.length - 1, Math.floor(withLatency.length * 0.95));
    p95 = withLatency[idx];
  }

  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">LAYER-7 RESEARCH DEMONSTRATOR</p>
          <h1>Load Balancing Console</h1>
        </div>
        <button onClick={() => refresh(false)} disabled={isRefreshing} className="refresh-btn">
          {isRefreshing ? "Refreshing…" : "Refresh live data"}
        </button>
      </header>

      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}
      {initialLoading && <p className="muted">Initializing live dashboard connection…</p>}

      <section className="panel controls">
        <h2>Operator controls</h2>
        <div className="control-row">
          <label htmlFor="admin-token-input">
            Admin token
            <input
              id="admin-token-input"
              type="password"
              value={adminToken}
              onChange={(e) => handleTokenChange(e.target.value)}
              placeholder="Required for admin actions"
            />
          </label>
          <label htmlFor="policy-select">
            Policy
            <select
              id="policy-select"
              value={status.policy === "loading" ? "round_robin" : status.policy}
              onChange={(e) => setPolicy(e.target.value)}
            >
              <option value="round_robin">Round Robin</option>
              <option value="least_connections">Least Connections</option>
              <option value="ai_latency">AI latency</option>
            </select>
          </label>
          <div className="btn-group">
            <button onClick={demoRequest}>Send demo request</button>
            <button onClick={healthCheck}>Health check all</button>
            <button onClick={createExperiment}>Create experiment</button>
            <button onClick={trainModel}>Train model</button>
          </div>
        </div>
        <p className="muted">The admin token is securely stored in this browser session.</p>
      </section>

      <section className="kpis">
        <Card title="Total decisions" value={String(decisions.length)} />
        <Card
          title="Successful"
          value={`${successful} (${decisions.length ? Math.round((successful / decisions.length) * 100) : 0}%)`}
        />
        <Card title="P95 latency" value={p95 !== undefined ? `${p95.toFixed(1)} ms` : "—"} />
        <Card title="Active policy" value={status.policy} />
      </section>

      <section className="panel">
        <h2>Backend health</h2>
        <p className="muted">Worker metrics are marked simulated by this local demonstrator.</p>
        <div className="backends">
          {backends.map((b) => (
            <article key={b.id}>
              <div className="backend-header">
                <strong>{b.name}</strong>
                <span className={`badge ${b.health_status}`}>
                  {b.health_status === "healthy" ? "● Healthy" : b.health_status === "disabled" ? "○ Disabled" : "✕ Unhealthy"}
                </span>
              </div>
              <p>Capacity weight: {b.capacity_weight}</p>
              <p>State: <strong>{b.enabled ? "Enabled" : "Disabled"}</strong></p>
              <p className="muted">Last health check: {formatTime(b.last_health_at)}</p>
              <button onClick={() => toggleBackend(b)} className={b.enabled ? "btn-warn" : "btn-primary"}>
                {b.enabled ? "Disable" : "Enable"}
              </button>
            </article>
          ))}
          {!backends.length && !initialLoading && <p className="muted">No registered backends found.</p>}
        </div>
      </section>

      <section className="panel">
        <h2>Recent routing decisions</h2>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Policy</th>
                <th>Backend</th>
                <th>Predicted</th>
                <th>Actual</th>
                <th>Status</th>
                <th>Fallback</th>
              </tr>
            </thead>
            <tbody>
              {decisions.map((d) => (
                <tr key={d.request_id}>
                  <td>{formatTime(d.decided_at)}</td>
                  <td><code className="policy-tag">{d.policy}</code></td>
                  <td>{d.selected_backend_id ? d.selected_backend_id.slice(0, 8) : "—"}</td>
                  <td>{d.predicted_latency_ms !== undefined ? `${d.predicted_latency_ms.toFixed(1)} ms` : "—"}</td>
                  <td>{d.actual_latency_ms !== undefined ? `${d.actual_latency_ms.toFixed(1)} ms` : "—"}</td>
                  <td>
                    <span className={`status-pill ${d.success ? "success" : "fail"}`}>
                      {d.status_code || (d.success ? "200" : "500")}
                    </span>
                  </td>
                  <td>{d.fallback_reason ? <span className="fallback-tag">{d.fallback_reason}</span> : "—"}</td>
                </tr>
              ))}
              {!decisions.length && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "#94a9c8", padding: "24px" }}>
                    No routing decisions recorded yet. Send a demo request above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ExperimentComparison experiments={experiments} />

      <footer>
        AI mode uses a persisted Random Forest regressor only when a validated artifact is active; otherwise it safely falls back to Least Connections.
      </footer>
    </main>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <article className="card">
      <p>{title}</p>
      <strong>{value}</strong>
    </article>
  );
}

function ExperimentComparison({ experiments }: { experiments: Experiment[] }) {
  const completed = experiments.filter((e) => e.status === "completed" && e.metric);
  const p95Values = completed
    .map((e) => e.metric?.latency_p95_ms)
    .filter((val): val is number => typeof val === "number" && !isNaN(val) && val > 0);
  const maxP95 = p95Values.length > 0 ? Math.max(...p95Values) : 1;

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Experiment comparison</h2>
          <p className="muted">Measured runs only; queued or failed runs are excluded from the comparison chart.</p>
        </div>
        <a className="button-link" href={`${api}/api/v1/experiments`} target="_blank" rel="noreferrer">
          API results ↗
        </a>
      </div>
      {!completed.length ? (
        <p className="muted" style={{ padding: "16px 0" }}>
          No completed experiments yet. Start the Phase 7 benchmark CLI or create a run above.
        </p>
      ) : (
        <>
          <div className="comparison-chart" role="img" aria-label="P95 latency by completed experiment">
            {completed.slice(0, 12).map((e) => {
              const val = e.metric?.latency_p95_ms;
              const widthPct = val && maxP95 > 0 ? Math.min(100, Math.max(2, (val / maxP95) * 100)) : 2;
              return (
                <div className="bar-row" key={e.id}>
                  <span>
                    {e.policy} · {e.workload_profile} · r{e.repetition}
                  </span>
                  <div className="bar-track">
                    <div className="bar" style={{ width: `${widthPct}%` }} />
                  </div>
                  <strong>{val !== undefined ? `${val.toFixed(1)} ms` : "—"}</strong>
                </div>
              );
            })}
          </div>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Status</th>
                  <th>Requests</th>
                  <th>Throughput</th>
                  <th>P50</th>
                  <th>P95</th>
                  <th>Errors</th>
                  <th>Export</th>
                </tr>
              </thead>
              <tbody>
                {completed.map((e) => (
                  <tr key={e.id}>
                    <td>
                      {e.policy} / {e.workload_profile} / r{e.repetition}
                    </td>
                    <td><span className="status-pill success">{e.status}</span></td>
                    <td>{e.metric?.request_count}</td>
                    <td>{e.metric?.throughput_rps?.toFixed(2)} req/s</td>
                    <td>{e.metric?.latency_p50_ms !== undefined ? `${e.metric.latency_p50_ms.toFixed(1)} ms` : "—"}</td>
                    <td>{e.metric?.latency_p95_ms !== undefined ? `${e.metric.latency_p95_ms.toFixed(1)} ms` : "—"}</td>
                    <td>{((e.metric?.error_rate || 0) * 100).toFixed(1)}%</td>
                    <td>
                      <a href={`${api}/api/v1/experiments/${e.id}/export?format=csv`} download>CSV</a> ·{" "}
                      <a href={`${api}/api/v1/experiments/${e.id}/export?format=json`} download>JSON</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
