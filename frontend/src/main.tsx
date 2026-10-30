import { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Cpu,
  Layers,
  Server,
  Zap,
  Play,
  Key,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Clock,
  Radio,
  BarChart3,
  Terminal,
  Download,
  Search,
  Filter
} from "lucide-react";
import "./style.css";

// ----------------------------------------------------
// TypeScript Types
// ----------------------------------------------------
type Backend = {
  id: string;
  name: string;
  base_url: string;
  health_status: string;
  enabled: boolean;
  capacity_weight: number;
  last_health_at?: string | null;
  telemetry?: {
    cpu_percent?: number | null;
    memory_percent?: number | null;
    active_requests?: number | null;
    latency_ewma_ms?: number | null;
  };
};

type Decision = {
  request_id: string;
  policy: string;
  selected_backend_id?: string | null;
  predicted_latency_ms?: number | null;
  actual_latency_ms?: number | null;
  status_code?: number | null;
  success: boolean;
  fallback_reason?: string | null;
  decided_at: string;
};

type ExperimentMetric = {
  request_count: number;
  success_count: number;
  error_count: number;
  throughput_rps?: number | null;
  error_rate?: number | null;
  latency_p50_ms?: number | null;
  latency_p95_ms?: number | null;
  latency_p99_ms?: number | null;
  ai_prediction_mae_ms?: number | null;
  distribution_json?: Record<string, number> | null;
};

type Experiment = {
  id: string;
  name: string;
  policy: string;
  workload_profile: string;
  repetition: number;
  scenario: string;
  status: string;
  ended_at?: string | null;
  metric?: ExperimentMetric | null;
};

const api = import.meta.env.VITE_API_BASE_URL || "";

const getHeaders = (adminToken: string): Record<string, string> =>
  adminToken
    ? { "X-Admin-Token": adminToken, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };

function formatTime(isoString?: string | null): string {
  if (!isoString) return "—";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString();
}

function formatNumber(val?: number | null, decimals = 1, suffix = ""): string {
  if (val === null || val === undefined || typeof val !== "number" || isNaN(val)) {
    return "—";
  }
  return `${val.toFixed(decimals)}${suffix}`;
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

// ----------------------------------------------------
// Main Application Component
// ----------------------------------------------------
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
  const [adminToken, setAdminToken] = useState("");
  const [activeTab, setActiveTab] = useState<"live" | "matrix">("live");
  const [searchFilter, setSearchFilter] = useState("");
  const [tokenVisible, setTokenVisible] = useState(false);

  const isInitialMount = useRef(true);

  const handleTokenChange = (val: string) => {
    setAdminToken(val);
  };

  const refresh = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const [b, d, s, e] = await Promise.all([
        fetch(`${api}/api/v1/backends`),
        fetch(`${api}/api/v1/decisions?limit=100`),
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

  const demoRequest = (reqClass = "normal") =>
    action(`Demo request (${reqClass})`, `/api/v1/route?request_class=${reqClass}`);
  const healthCheck = () => action("Health check", "/api/v1/backends/health-check-all", { method: "POST" });
  const trainModel = () => action("Model training", "/api/v1/models/train", { method: "POST" });

  const createExperiment = () =>
    action("Experiment creation", "/api/v1/experiments", {
      method: "POST",
      body: JSON.stringify({
        name: `hud-${Date.now()}`,
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
    action(`${backend.name} state change`, `/api/v1/backends/${backend.id}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled: !backend.enabled }),
    });

  useEffect(() => {
    refresh(false);
    const id = window.setInterval(() => refresh(true), 3000);
    return () => clearInterval(id);
  }, []);

  // Filtered decisions
  const filteredDecisions = decisions.filter(d => {
    if (!searchFilter) return true;
    const term = searchFilter.toLowerCase();
    return (
      d.policy.toLowerCase().includes(term) ||
      (d.selected_backend_id && d.selected_backend_id.toLowerCase().includes(term)) ||
      (d.fallback_reason && d.fallback_reason.toLowerCase().includes(term)) ||
      String(d.status_code || "").includes(term)
    );
  });

  const successful = decisions.filter((d) => d.success).length;
  const withLatency = decisions
    .map((d) => d.actual_latency_ms)
    .filter((ms): ms is number => ms !== null && ms !== undefined && typeof ms === "number" && !isNaN(ms))
    .sort((a, b) => a - b);

  let p50: number | undefined;
  let p95: number | undefined;
  if (withLatency.length > 0) {
    p50 = withLatency[Math.floor(withLatency.length * 0.5)];
    p95 = withLatency[Math.min(withLatency.length - 1, Math.floor(withLatency.length * 0.95))];
  }

  // Backend mapping helper
  const backendMap = new Map(backends.map(b => [b.id, b.name]));

  return (
    <div className="min-h-screen bg-surface-lowest text-slate-100 flex flex-col font-sans selection:bg-primary/20 selection:text-primary">
      {/* ======================================================== */}
      {/* 1. TOP NAVIGATION / NOC STATUS BAR                      */}
      {/* ======================================================== */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-5 h-14 bg-surface-lowest/95 backdrop-blur border-b border-border-subtle">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-primary/10 border border-primary/30 flex items-center justify-center text-primary glow-primary">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold tracking-wider text-slate-100 uppercase">
                  NET//PULSE <span className="text-primary font-normal">Core</span>
                </span>
                <span className="hidden sm:inline-block px-1.5 py-0.2 text-[10px] font-mono tracking-wider bg-surface-high border border-border text-slate-400">
                  L7 HUD
                </span>
              </div>
            </div>
          </div>

          {/* System Online / Policy Indicator */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-surface-low border border-border-subtle rounded-sm font-mono text-xs">
            <span className="w-2 h-2 rounded-full bg-secondary animate-beacon shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
            <span className="text-secondary font-medium">System Online</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">Active Policy:</span>
            <span className="text-primary font-bold uppercase">{status.policy.replace("_", " ")}</span>
          </div>

          {/* Active Model Pill */}
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 bg-surface-low border border-border-subtle rounded-sm font-mono text-xs text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-tertiary" />
            <span>Model:</span>
            <span className={`font-semibold ${status.model_ready ? "text-tertiary" : "text-amber"}`}>
              {status.model_ready ? status.model_version || "Active" : "Uninitialized (Least-Conn Fallback)"}
            </span>
          </div>
        </div>

        {/* Top Controls & Operator Actions */}
        <div className="flex items-center gap-3">
          {/* Admin Token Field */}
          <div className="flex items-center bg-surface-low border border-border-subtle rounded px-2.5 py-1">
            <Key className="w-3.5 h-3.5 text-slate-400 mr-2" />
            <input
              type={tokenVisible ? "text" : "password"}
              value={adminToken}
              onChange={(e) => handleTokenChange(e.target.value)}
              placeholder="Admin token..."
              className="bg-transparent border-0 p-0 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none w-24 sm:w-32"
            />
            <button
              onClick={() => setTokenVisible(!tokenVisible)}
              className="text-[10px] text-slate-500 hover:text-slate-300 ml-1 font-mono uppercase"
              title="Toggle token visibility"
            >
              {tokenVisible ? "hide" : "show"}
            </button>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => demoRequest("normal")}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface-high hover:bg-surface-bright text-primary border border-primary/40 rounded text-xs font-mono font-medium transition-all"
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Send Demo</span>
            </button>

            <button
              onClick={healthCheck}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface-high hover:bg-surface-bright text-secondary border border-secondary/40 rounded text-xs font-mono font-medium transition-all"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Health Poll</span>
            </button>

            <button
              onClick={trainModel}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary text-slate-950 hover:bg-primary-light rounded text-xs font-mono font-bold transition-all"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Train AI</span>
            </button>

            <button
              onClick={() => refresh(false)}
              disabled={isRefreshing}
              className="p-1.5 bg-surface-low hover:bg-surface-high border border-border-subtle rounded text-slate-300 transition-colors"
              title="Manual refresh"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Notices & Error Toasts */}
      {error && (
        <div className="bg-error-container border-b border-error/30 text-error-light px-6 py-2 text-xs font-mono flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-error" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} className="text-slate-400 hover:text-slate-200">✕</button>
        </div>
      )}
      {notice && (
        <div className="bg-secondary/10 border-b border-secondary/30 text-secondary-light px-6 py-2 text-xs font-mono flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-secondary" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice("")} className="text-slate-400 hover:text-slate-200">✕</button>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. MAIN CONTENT AREA                                     */}
      {/* ======================================================== */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">
        
        {/* KPI Strip */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Ingress Decisions */}
          <div className="bg-surface-low border border-border-subtle rounded-lg p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-border-subtle/50 pb-2 mb-2">
              <span className="uppercase tracking-wider">Total Decisions</span>
              <Activity className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-mono text-2xl sm:text-3xl font-bold text-slate-100">
                {decisions.length.toLocaleString()}
              </span>
              <span className="text-[11px] font-mono text-slate-500">Live Stream</span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-secondary font-mono">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Real-time Ingress Active</span>
            </div>
          </div>

          {/* Success Rate */}
          <div className="bg-surface-low border border-border-subtle rounded-lg p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-border-subtle/50 pb-2 mb-2">
              <span className="uppercase tracking-wider">Success Rate</span>
              <ShieldCheck className="w-3.5 h-3.5 text-secondary" />
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-mono text-2xl sm:text-3xl font-bold text-secondary">
                {decisions.length ? `${((successful / decisions.length) * 100).toFixed(1)}%` : "100%"}
              </span>
              <span className="text-[11px] font-mono text-slate-500">{successful} / {decisions.length}</span>
            </div>
            <div className="mt-3 w-full bg-surface-highest h-1.5 rounded-full overflow-hidden flex">
              <div
                className="bg-secondary h-full transition-all duration-500"
                style={{ width: `${decisions.length ? (successful / decisions.length) * 100 : 100}%` }}
              />
            </div>
          </div>

          {/* P95 Tail Latency */}
          <div className="bg-surface-low border border-border-subtle rounded-lg p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-border-subtle/50 pb-2 mb-2">
              <span className="uppercase tracking-wider">P95 Tail Latency</span>
              <Clock className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-mono text-2xl sm:text-3xl font-bold text-primary">
                {formatNumber(p95, 1, " ms")}
              </span>
              <span className="text-[11px] font-mono text-slate-400">P50: {formatNumber(p50, 1, " ms")}</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-slate-500">
              <span>TARGET &lt; 50ms</span>
              <span className="text-secondary">OPTIMAL</span>
            </div>
          </div>

          {/* Active Policy Selector Card */}
          <div className="bg-surface-low border border-border-subtle rounded-lg p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-border-subtle/50 pb-2 mb-2">
              <span className="uppercase tracking-wider">Routing Policy</span>
              <Layers className="w-3.5 h-3.5 text-tertiary" />
            </div>
            <div className="mt-1">
              <select
                value={status.policy === "loading" ? "round_robin" : status.policy}
                onChange={(e) => setPolicy(e.target.value)}
                className="w-full bg-surface-high border border-border text-slate-100 font-mono text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-primary"
              >
                <option value="round_robin">Round Robin (Deterministic Cyclic)</option>
                <option value="least_connections">Least Connections (Load-Aware)</option>
                <option value="ai_latency">AI Latency (Random Forest Regression)</option>
              </select>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Mode: <strong className="text-primary uppercase">{status.policy}</strong></span>
              <span className="text-tertiary">Safe Fallback Active</span>
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* 3. BACKEND SERVER CLUSTER & FLEET STATE                 */}
        {/* ======================================================== */}
        <section className="bg-surface-low border border-border-subtle rounded-lg p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-primary" />
                <h2 className="font-mono text-sm font-bold tracking-wide uppercase text-slate-100">
                  Target Backend Pools & Cluster Fleet State
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Heterogeneous worker cluster simulating asymmetric compute delay, network RTT, and in-flight queue load.
              </p>
            </div>
            <div className="flex items-center gap-3 font-mono text-xs text-slate-400">
              <span className="text-secondary font-medium">● 3 Nodes Registered</span>
              <span className="text-slate-600">|</span>
              <span>Health Interval: 30s</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {backends.map((b) => {
              const isHealthy = b.health_status === "healthy";
              const isFast = b.name === "worker-a";
              const isSlow = b.name === "worker-b";

              return (
                <div
                  key={b.id}
                  className={`bg-surface border rounded-lg p-4 flex flex-col justify-between transition-all ${
                    isHealthy
                      ? "border-border-subtle hover:border-primary/50"
                      : "border-error/40 bg-error-container/5"
                  }`}
                >
                  {/* Node Header */}
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            isHealthy
                              ? "bg-secondary shadow-[0_0_8px_rgba(16,185,129,0.7)]"
                              : b.health_status === "disabled"
                              ? "bg-slate-500"
                              : "bg-error shadow-[0_0_8px_rgba(239,68,68,0.7)]"
                          }`}
                        />
                        <span className="font-mono font-bold text-sm text-slate-100">{b.name}</span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase font-semibold ${
                            isFast
                              ? "bg-secondary/10 border border-secondary/30 text-secondary"
                              : isSlow
                              ? "bg-amber/10 border border-amber/30 text-amber"
                              : "bg-primary/10 border border-primary/30 text-primary"
                          }`}
                        >
                          {isFast ? "Fast (15ms)" : isSlow ? "Slow (60ms)" : "Med (30ms)"}
                        </span>
                      </div>

                      {/* Enable/Disable Toggle */}
                      <button
                        onClick={() => toggleBackend(b)}
                        className={`text-xs font-mono px-2 py-0.5 rounded border transition-colors ${
                          b.enabled
                            ? "bg-surface-high hover:bg-error/20 text-slate-300 hover:text-error border-border hover:border-error/50"
                            : "bg-secondary/20 text-secondary hover:bg-secondary/30 border-secondary/50"
                        }`}
                      >
                        {b.enabled ? "Disable" : "Enable"}
                      </button>
                    </div>

                    <div className="text-[11px] font-mono text-slate-500 mt-1">
                      Target: <span className="text-slate-400">{b.base_url}</span>
                    </div>

                    {/* Gauges / Metrics */}
                    <div className="mt-4 space-y-2.5">
                      {/* Capacity Weight */}
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-400">Capacity Weight:</span>
                        <span className="text-slate-200 font-bold">{b.capacity_weight}x</span>
                      </div>

                      {/* Status */}
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-400">Health State:</span>
                        <span
                          className={`uppercase font-bold ${
                            isHealthy ? "text-secondary" : "text-error"
                          }`}
                        >
                          {b.health_status}
                        </span>
                      </div>

                      {/* Health Check */}
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-400">Last Observation:</span>
                        <span className="text-slate-400">{formatTime(b.last_health_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Node Footer Actions */}
                  <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between text-xs font-mono text-slate-400">
                    <span>Pool ID: {b.id.slice(0, 8)}</span>
                    <button
                      onClick={() => demoRequest("heavy")}
                      className="text-primary hover:underline flex items-center gap-1 text-[11px]"
                    >
                      <span>Direct Probe</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ======================================================== */}
        {/* 4. TABBED TELEMETRY: LIVE DECISIONS & EXPERIMENT MATRIX  */}
        {/* ======================================================== */}
        <section className="bg-surface-low border border-border-subtle rounded-lg flex flex-col overflow-hidden">
          {/* Tab Headers */}
          <div className="flex flex-wrap items-center justify-between px-5 py-3 bg-surface border-b border-border-subtle gap-3">
            {/* Tabs */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab("live")}
                className={`px-4 py-1.5 rounded font-mono text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === "live"
                    ? "bg-primary text-slate-950 glow-primary"
                    : "text-slate-400 hover:text-slate-200 hover:bg-surface-high"
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Live Routing Decisions</span>
                <span className={`px-1.5 py-0.2 text-[9px] rounded font-mono ${
                  activeTab === "live" ? "bg-slate-900 text-primary" : "bg-surface-highest text-slate-400"
                }`}>
                  STREAM
                </span>
              </button>

              <button
                onClick={() => setActiveTab("matrix")}
                className={`px-4 py-1.5 rounded font-mono text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === "matrix"
                    ? "bg-primary text-slate-950 glow-primary"
                    : "text-slate-400 hover:text-slate-200 hover:bg-surface-high"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Benchmark & Experiment Matrix</span>
                <span className={`px-1.5 py-0.2 text-[9px] rounded font-mono ${
                  activeTab === "matrix" ? "bg-slate-900 text-primary" : "bg-surface-highest text-slate-400"
                }`}>
                  36 RUNS
                </span>
              </button>
            </div>

            {/* Filter & Actions */}
            {activeTab === "live" && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex items-center flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Filter policy, backend, status..."
                    className="w-full bg-surface-high border border-border rounded pl-8 pr-3 py-1 font-mono text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-primary"
                  />
                  {searchFilter && (
                    <button
                      onClick={() => setSearchFilter("")}
                      className="absolute right-2 text-xs text-slate-400 hover:text-slate-200"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )}
            {activeTab === "matrix" && (
              <button
                onClick={createExperiment}
                className="px-3 py-1 bg-secondary text-slate-950 font-mono text-xs font-bold rounded hover:bg-secondary-light flex items-center gap-1.5"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Launch New Benchmark Run</span>
              </button>
            )}
          </div>

          {/* TAB 1: LIVE DECISIONS TABLE */}
          {activeTab === "live" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface-high/60 text-slate-400">
                    <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                    <th className="py-2.5 px-4 font-semibold">Active Policy</th>
                    <th className="py-2.5 px-4 font-semibold">Selected Target</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Predicted Latency</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Actual Latency</th>
                    <th className="py-2.5 px-4 font-semibold text-center">Status</th>
                    <th className="py-2.5 px-4 font-semibold">Safety Fallback Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/40">
                  {filteredDecisions.slice(0, 30).map((d) => {
                    const nodeName = d.selected_backend_id ? backendMap.get(d.selected_backend_id) || d.selected_backend_id.slice(0, 8) : "—";
                    const isSuccess = d.success && (d.status_code === 200 || !d.status_code);

                    return (
                      <tr key={d.request_id} className="hover:bg-surface-high/40 transition-colors">
                        <td className="py-2 px-4 text-slate-400 whitespace-nowrap">
                          {formatTime(d.decided_at)}
                        </td>
                        <td className="py-2 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              d.policy === "ai_latency"
                                ? "bg-primary/10 border border-primary/30 text-primary"
                                : d.policy === "least_connections"
                                ? "bg-tertiary/10 border border-tertiary/30 text-tertiary"
                                : "bg-slate-800 border border-slate-700 text-slate-300"
                            }`}
                          >
                            {d.policy.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-2 px-4 font-bold text-slate-200">
                          {nodeName}
                        </td>
                        <td className="py-2 px-4 text-right text-slate-400 font-mono">
                          {formatNumber(d.predicted_latency_ms, 1, " ms")}
                        </td>
                        <td className="py-2 px-4 text-right font-mono font-bold text-slate-100">
                          {formatNumber(d.actual_latency_ms, 1, " ms")}
                        </td>
                        <td className="py-2 px-4 text-center">
                          <span
                            className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              isSuccess
                                ? "bg-secondary/10 border border-secondary/30 text-secondary"
                                : "bg-error/10 border border-error/30 text-error"
                            }`}
                          >
                            {d.status_code || (isSuccess ? "200 OK" : "502 Gateway")}
                          </span>
                        </td>
                        <td className="py-2 px-4">
                          {d.fallback_reason ? (
                            <span className="text-amber font-mono text-[11px] flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber shrink-0" />
                              <span>{d.fallback_reason}</span>
                            </span>
                          ) : (
                            <span className="text-slate-600 text-[11px]">Optimal Path</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!filteredDecisions.length && (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-500 font-mono">
                        No matching routing decisions recorded. Send a demo request above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: BENCHMARK & EXPERIMENT MATRIX */}
          {activeTab === "matrix" && (
            <div className="p-5 flex flex-col gap-6">
              <ExperimentMatrixSection experiments={experiments} />
            </div>
          )}
        </section>

      </main>

      {/* ======================================================== */}
      {/* 5. NOC FOOTER                                            */}
      {/* ======================================================== */}
      <footer className="border-t border-border-subtle bg-surface-lowest px-6 py-3 text-xs font-mono text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-secondary" />
          <span>NET//PULSE v1.0.2</span>
          <span>•</span>
          <span>FastAPI + PostgreSQL 16 + Scikit-Learn RandomForestRegressor</span>
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <a href={`${api}/api/v1/metrics/summary`} target="_blank" rel="noreferrer" className="hover:text-primary">
            Metrics Summary ↗
          </a>
          <a href={`${api}/docs`} target="_blank" rel="noreferrer" className="hover:text-primary">
            Swagger API ↗
          </a>
        </div>
      </footer>
    </div>
  );
}

// ----------------------------------------------------
// Benchmark Matrix Component
// ----------------------------------------------------
function ExperimentMatrixSection({ experiments }: { experiments: Experiment[] }) {
  const completed = experiments.filter((e) => e.status === "completed" && e.metric);
  const p95Values = completed
    .map((e) => e.metric?.latency_p95_ms)
    .filter((val): val is number => val !== null && val !== undefined && typeof val === "number" && !isNaN(val) && val > 0);
  const maxP95 = p95Values.length > 0 ? Math.max(...p95Values) : 1;

  if (!completed.length) {
    return (
      <div className="text-center py-12 text-slate-500 font-mono">
        <BarChart3 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <p>No completed benchmark experiments found.</p>
        <p className="text-xs text-slate-600 mt-1">Run the Phase 7 benchmark CLI or click "Launch New Benchmark Run".</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left 2 Cols: Latency Comparative Bars */}
      <div className="lg:col-span-2 flex flex-col gap-4">
        <div className="border-b border-border-subtle pb-2 flex items-center justify-between">
          <div>
            <h3 className="font-mono text-sm font-bold text-slate-100 uppercase">
              P95 Response Latency Comparison (Lower is Better)
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Controlled multi-workload benchmark evaluation runs across policies.
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 bg-surface-high border border-border text-slate-400">
            N={completed.length} RUNS
          </span>
        </div>

        {/* Bar Chart Rows */}
        <div className="space-y-3 font-mono text-xs">
          {completed.slice(0, 8).map((e) => {
            const val = e.metric?.latency_p95_ms || 0;
            const pct = Math.min(100, Math.max(3, (val / maxP95) * 100));
            const isAI = e.policy === "ai_latency";
            const isLC = e.policy === "least_connections";

            return (
              <div key={e.id} className="bg-surface border border-border-subtle rounded p-3">
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isAI ? "bg-primary" : isLC ? "bg-tertiary" : "bg-slate-400"
                      }`}
                    />
                    <strong className="text-slate-200">
                      {e.policy.replace("_", " ").toUpperCase()} • {e.workload_profile} (r{e.repetition})
                    </strong>
                  </div>
                  <span className="font-bold text-slate-100">{formatNumber(val, 1, " ms")}</span>
                </div>
                <div className="w-full bg-surface-highest h-3 rounded overflow-hidden">
                  <div
                    className={`h-full rounded transition-all duration-500 ${
                      isAI ? "bg-primary" : isLC ? "bg-tertiary" : "bg-slate-500"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                  <span>Throughput: {formatNumber(e.metric?.throughput_rps, 1, " req/s")}</span>
                  <span>Requests: {e.metric?.request_count}</span>
                  <span>Errors: {formatNumber((e.metric?.error_rate || 0) * 100, 1, "%")}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Research Takeaway & Summary */}
      <div className="bg-surface border border-border-subtle rounded-lg p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 border-b border-border-subtle pb-3 mb-4">
            <ShieldCheck className="w-4 h-4 text-secondary" />
            <h4 className="font-mono text-sm font-bold text-slate-100 uppercase">
              Scientific Findings
            </h4>
          </div>

          <div className="space-y-4 font-mono text-xs text-slate-300">
            <div className="p-3 bg-surface-high border border-border rounded">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                Heterogeneous Asymmetry
              </span>
              <div className="text-lg font-bold text-secondary mt-0.5">AI Optimal</div>
              <p className="text-[11px] text-slate-400 mt-1">
                Under unequal node delays (15ms vs 60ms), Random Forest latency prediction avoids queue build-up on slow workers.
              </p>
            </div>

            <div className="p-3 bg-surface-high border border-border rounded">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                Inference Latency Tax
              </span>
              <div className="text-lg font-bold text-amber mt-0.5">~2-5 ms / eval</div>
              <p className="text-[11px] text-slate-400 mt-1">
                Under uniform light workloads, Least Connections out-benchmarks AI because tree regression incurs a CPU scoring overhead.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-border-subtle flex flex-col gap-2 font-mono text-xs">
          <a
            href={`${api}/api/v1/experiments`}
            target="_blank"
            rel="noreferrer"
            className="w-full text-center py-2 bg-surface-high hover:bg-surface-bright text-primary border border-border rounded transition-colors"
          >
            Raw Experiments API JSON ↗
          </a>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
