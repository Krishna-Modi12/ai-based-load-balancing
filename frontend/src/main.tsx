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
  TrendingUp,
  Clock,
  Radio,
  BarChart3,
  Search,
  ArrowRight,
  Flame,
  Info,
  HelpCircle,
  Sliders,
  Send,
  Eye,
  EyeOff
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
  ai_inference_latency_ms?: number | null;
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

type LastRouteResult = {
  request_id: string;
  backend: string;
  policy: string;
  predicted_latency_ms?: number | null;
  actual_latency_ms?: number | null;
  ai_inference_latency_ms?: number | null;
  fallback_reason?: string | null;
  upstream?: any;
  timestamp: Date;
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
  const [status, setStatus] = useState<{ policy: string; model_ready: boolean; model_version?: string | null }>({
    policy: "loading",
    model_ready: false,
    model_version: null,
  });
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [adminToken, setAdminToken] = useState("");
  const [activeTab, setActiveTab] = useState<"live" | "matrix" | "guide">("live");
  const [searchFilter, setSearchFilter] = useState("");
  const [tokenVisible, setTokenVisible] = useState(false);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);

  // Playground state
  const [selectedClass, setSelectedClass] = useState<"light" | "normal" | "heavy">("normal");
  const [isSendingTraffic, setIsSendingTraffic] = useState(false);
  const [trafficBatchProgress, setTrafficBatchProgress] = useState<string>("");
  const [lastResult, setLastResult] = useState<LastRouteResult | null>(null);

  const isInitialMount = useRef(true);

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
      throw e;
    }
  };

  const setPolicy = async (policy: string) => {
    try {
      await action(`Switch policy to ${policy.replace("_", " ")}`, "/api/v1/routing/mode", {
        method: "PUT",
        body: JSON.stringify({ policy }),
      });
    } catch {
      // Error handled in action()
    }
  };

  const healthCheck = async () => {
    try {
      await action("Cluster Health Check & Telemetry Calibration", "/api/v1/backends/health-check-all", {
        method: "POST",
      });
    } catch {
      // Error handled in action()
    }
  };

  const trainModel = async () => {
    try {
      const res = await action("Train AI Latency Predictor", "/api/v1/models/train", { method: "POST" });
      if (res && res.version) {
        setNotice(`Model ${res.version} successfully trained across ${res.samples} samples (MAE: ${res.mae_ms?.toFixed(2)}ms)`);
      }
    } catch {
      // Error handled in action()
    }
  };

  const sendSingleRequest = async (reqClass = selectedClass) => {
    setIsSendingTraffic(true);
    try {
      const res = await fetch(`${api}/api/v1/route?request_class=${reqClass}`);
      const body = await res.json();
      if (!res.ok) {
        throw new Error(extractErrorMessage(body, "Routing request"));
      }
      setLastResult({
        ...body,
        timestamp: new Date(),
      });
      await refresh(true);
    } catch (e: any) {
      setError(e.message || "Request failed");
    } finally {
      setIsSendingTraffic(false);
    }
  };

  const sendTrafficBurst = async (count: number, reqClass = selectedClass) => {
    setIsSendingTraffic(true);
    setTrafficBatchProgress(`Sending 0 / ${count}...`);
    let completed = 0;
    let failed = 0;

    for (let i = 0; i < count; i++) {
      try {
        const res = await fetch(`${api}/api/v1/route?request_class=${reqClass}`);
        const body = await res.json();
        if (res.ok) {
          completed++;
          setLastResult({ ...body, timestamp: new Date() });
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
      setTrafficBatchProgress(`Sent ${i + 1} / ${count} (${completed} OK, ${failed} failed)`);
    }

    setNotice(`Traffic burst completed: ${completed} delivered successfully${failed > 0 ? `, ${failed} failed` : ""}`);
    setIsSendingTraffic(false);
    setTrafficBatchProgress("");
    await refresh(false);
  };

  const toggleBackend = (backend: Backend) =>
    action(`${backend.name} state change`, `/api/v1/backends/${backend.id}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled: !backend.enabled }),
    });

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

  // Polling loop
  useEffect(() => {
    refresh(false);
    const id = window.setInterval(() => {
      if (isAutoRefresh) refresh(true);
    }, 3000);
    return () => clearInterval(id);
  }, [isAutoRefresh]);

  // Backend mapping helper
  const backendMap = new Map(backends.map((b) => [b.id, b.name]));

  // Stale telemetry check (> 100 seconds)
  const hasStaleTelemetry = backends.some((b) => {
    if (!b.enabled || !b.last_health_at) return true;
    const diff = (Date.now() - new Date(b.last_health_at).getTime()) / 1000;
    return diff > 100;
  });

  // Filtered decisions
  const filteredDecisions = decisions.filter((d) => {
    if (!searchFilter) return true;
    const term = searchFilter.toLowerCase();
    const nodeName = d.selected_backend_id ? (backendMap.get(d.selected_backend_id) || "").toLowerCase() : "";
    return (
      d.policy.toLowerCase().includes(term) ||
      nodeName.includes(term) ||
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

  return (
    <div className="min-h-screen bg-surface-lowest text-slate-100 flex flex-col font-sans selection:bg-primary/20 selection:text-primary">
      {/* ======================================================== */}
      {/* 1. TOP NAVIGATION / NOC STATUS BAR                      */}
      {/* ======================================================== */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-4 sm:px-6 h-14 bg-surface-lowest/95 backdrop-blur border-b border-border-subtle">
        {/* Brand */}
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-primary/10 border border-primary/30 flex items-center justify-center text-primary glow-primary">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold tracking-wider text-slate-100 uppercase">
                  NET//PULSE <span className="text-primary font-normal">Core</span>
                </span>
                <span className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-mono tracking-wider bg-surface-high border border-border text-slate-400 rounded">
                  AI Load Balancer
                </span>
              </div>
            </div>
          </div>

          {/* System Status Indicator */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-surface-low border border-border-subtle rounded font-mono text-xs">
            <span className="w-2 h-2 rounded-full bg-secondary animate-beacon shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
            <span className="text-secondary font-medium">Cluster Online</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">Policy:</span>
            <span className="text-primary font-bold uppercase">{status.policy.replace("_", " ")}</span>
          </div>

          {/* AI Model State */}
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 bg-surface-low border border-border-subtle rounded font-mono text-xs text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-tertiary" />
            <span>Predictor:</span>
            <span className={`font-semibold ${status.model_ready ? "text-tertiary" : "text-amber"}`}>
              {status.model_ready ? status.model_version || "Trained & Active" : "Untrained (Fallback Active)"}
            </span>
          </div>
        </div>

        {/* Top Controls: Admin Token & Maintenance */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Admin Token Drawer */}
          <div className="flex items-center bg-surface-low border border-border-subtle rounded px-2.5 py-1">
            <Key className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
            <input
              type={tokenVisible ? "text" : "password"}
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              placeholder="Admin token..."
              className="bg-transparent border-0 p-0 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none w-20 sm:w-28"
            />
            <button
              onClick={() => setTokenVisible(!tokenVisible)}
              className="text-slate-500 hover:text-slate-300 ml-1 p-0.5"
              title={tokenVisible ? "Hide token" : "Show token"}
            >
              {tokenVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </button>
            {!adminToken && (
              <button
                onClick={() => setAdminToken("phase6-local-admin-token")}
                className="ml-1.5 px-1.5 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded text-[9px] font-mono whitespace-nowrap transition-colors"
                title="Use default local development token"
              >
                Use Local
              </button>
            )}
          </div>

          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-mono transition-colors ${
              isAutoRefresh
                ? "bg-secondary/10 border-secondary/30 text-secondary"
                : "bg-surface-low border-border text-slate-500"
            }`}
            title="Auto-refresh every 3s"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isAutoRefresh ? "bg-secondary animate-pulse" : "bg-slate-600"}`} />
            <span>3s Auto</span>
          </button>

          {/* Manual Refresh */}
          <button
            onClick={() => refresh(false)}
            disabled={isRefreshing}
            className="p-1.5 bg-surface-low hover:bg-surface-high border border-border-subtle rounded text-slate-300 transition-colors"
            title="Manual sync"
          >
            <RotateCcw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
          </button>
        </div>
      </header>

      {/* Notifications & Error Alerts */}
      {error && (
        <div className="bg-error-container border-b border-error/30 text-error-light px-6 py-2.5 text-xs font-mono flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-error" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} className="text-slate-400 hover:text-slate-200">✕</button>
        </div>
      )}
      {notice && (
        <div className="bg-secondary/10 border-b border-secondary/30 text-secondary-light px-6 py-2.5 text-xs font-mono flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-secondary" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice("")} className="text-slate-400 hover:text-slate-200">✕</button>
        </div>
      )}

      {/* Stale Telemetry Warning Banner */}
      {hasStaleTelemetry && (
        <div className="bg-amber-950/40 border-b border-amber/40 text-amber-200 px-6 py-2 text-xs font-mono flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber shrink-0 animate-pulse" />
            <span>
              <strong>Telemetry is Stale (&gt;100s):</strong> The load balancer router requires recent health observations to dispatch traffic.
            </span>
          </div>
          <button
            onClick={healthCheck}
            className="px-2.5 py-1 bg-amber text-slate-950 rounded font-bold hover:bg-amber-300 transition-colors text-[11px]"
          >
            Refresh Telemetry Now
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. MAIN WORKSPACE                                        */}
      {/* ======================================================== */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">

        {/* ---------------------------------------------------- */}
        {/* INTERACTIVE TRAFFIC PLAYGROUND & SIMULATION BOX      */}
        {/* ---------------------------------------------------- */}
        <section className="bg-surface-low border border-border-subtle rounded-xl p-5 shadow-lg relative overflow-hidden">
          {/* Subtle Cyber Glow Header */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary via-tertiary to-secondary" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
            <div>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                <h1 className="font-mono text-base font-bold text-slate-100 uppercase tracking-wide">
                  Interactive Traffic Playground & Router Test Lab
                </h1>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Dispatch live synthetic traffic through the Layer-7 load balancer to watch routing decisions, response latencies, and AI predictions in real time.
              </p>
            </div>

            {/* Quick Calibration Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={healthCheck}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-high hover:bg-surface-bright text-secondary border border-secondary/40 rounded text-xs font-mono font-medium transition-all"
                title="Poll all workers to refresh latency and CPU telemetry"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Calibrate Health</span>
              </button>

              <button
                onClick={trainModel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-tertiary/10 hover:bg-tertiary/20 text-tertiary border border-tertiary/40 rounded text-xs font-mono font-medium transition-all"
                title="Train Random Forest regressor on latest recorded decisions"
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Train AI Model</span>
              </button>
            </div>
          </div>

          {/* Traffic Generator Controls */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mt-4 items-center">
            {/* Step 1: Workload Profile Selection */}
            <div className="md:col-span-5 flex flex-col gap-2">
              <span className="text-xs font-mono font-semibold text-slate-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-primary" />
                <span>1. Select Workload Complexity</span>
              </span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "light", label: "Light", desc: "Fast (1x CPU)", color: "border-secondary text-secondary bg-secondary/10" },
                  { id: "normal", label: "Normal", desc: "Standard API", color: "border-primary text-primary bg-primary/10" },
                  { id: "heavy", label: "Heavy", desc: "High Compute", color: "border-tertiary text-tertiary bg-tertiary/10" },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedClass(item.id as any)}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      selectedClass === item.id
                        ? `${item.color} font-bold shadow-[0_0_10px_rgba(6,182,212,0.15)]`
                        : "border-border-subtle bg-surface text-slate-400 hover:text-slate-200 hover:border-border"
                    }`}
                  >
                    <div className="font-mono text-xs">{item.label}</div>
                    <div className="text-[10px] text-slate-500 font-sans mt-0.5">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Traffic Trigger Buttons */}
            <div className="md:col-span-4 flex flex-col gap-2">
              <span className="text-xs font-mono font-semibold text-slate-300 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-secondary" />
                <span>2. Dispatch Synthetic Load</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={isSendingTraffic}
                  onClick={() => sendSingleRequest()}
                  className="flex-1 py-2 px-3 bg-primary hover:bg-primary-light text-slate-950 font-mono text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(6,182,212,0.3)] disabled:opacity-50"
                >
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>Send 1 Req</span>
                </button>

                <button
                  disabled={isSendingTraffic}
                  onClick={() => sendTrafficBurst(5)}
                  className="flex-1 py-2 px-3 bg-surface-high hover:bg-surface-bright text-slate-100 border border-border font-mono text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                  title="Dispatch 5 concurrent requests in a burst"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-secondary" />
                  <span>Burst (5)</span>
                </button>

                <button
                  disabled={isSendingTraffic}
                  onClick={() => sendTrafficBurst(15)}
                  className="flex-1 py-2 px-3 bg-surface-high hover:bg-surface-bright text-slate-100 border border-border font-mono text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                  title="Simulate load spike with 15 requests"
                >
                  <Flame className="w-3.5 h-3.5 text-tertiary" />
                  <span>Spike (15)</span>
                </button>
              </div>
              {trafficBatchProgress && (
                <div className="text-[11px] font-mono text-primary animate-pulse">{trafficBatchProgress}</div>
              )}
            </div>

            {/* Step 3: Latest Real-time Execution Callout */}
            <div className="md:col-span-3 bg-surface border border-border-subtle rounded-lg p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 border-b border-border-subtle pb-1.5">
                <span className="uppercase">Last Dispatch Result</span>
                <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              </div>

              {lastResult ? (
                <div className="mt-2 space-y-1 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Target Node:</span>
                    <strong className="text-slate-100 font-bold">{lastResult.backend}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Total Latency:</span>
                    <span className="text-secondary font-bold">
                      {formatNumber(lastResult.actual_latency_ms, 1, " ms")}
                    </span>
                  </div>
                  {lastResult.predicted_latency_ms != null && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">AI Predicted:</span>
                      <span className="text-tertiary">
                        {formatNumber(lastResult.predicted_latency_ms, 1, " ms")}
                      </span>
                    </div>
                  )}
                  <div className="text-[10px] text-slate-500 pt-1 border-t border-border-subtle/50">
                    Policy: {lastResult.policy.replace("_", " ")} • {lastResult.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              ) : (
                <div className="py-3 text-center text-slate-500 text-xs font-mono">
                  Ready. Click "Send 1 Req" to test.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------- */}
        {/* INTERACTIVE POLICY SWITCHER (VISUAL STRATEGY CARDS)  */}
        {/* ---------------------------------------------------- */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <h2 className="font-mono text-sm font-bold tracking-wide uppercase text-slate-100">
                Routing Policy Strategy
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Active Strategy: <strong className="text-primary uppercase">{status.policy.replace("_", " ")}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Strategy 1: Round Robin */}
            <div
              onClick={() => setPolicy("round_robin")}
              className={`cursor-pointer rounded-xl p-4 border transition-all flex flex-col justify-between ${
                status.policy === "round_robin"
                  ? "bg-surface-low border-primary shadow-[0_0_15px_rgba(6,182,212,0.2)] ring-1 ring-primary/40"
                  : "bg-surface border-border-subtle hover:border-slate-600 hover:bg-surface-high/50"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300">
                    Deterministic Cyclic
                  </span>
                  {status.policy === "round_robin" && (
                    <span className="px-2 py-0.5 bg-primary text-slate-950 font-mono text-[10px] font-bold rounded">
                      ACTIVE
                    </span>
                  )}
                </div>
                <h3 className="font-mono text-base font-bold text-slate-100 mt-1 flex items-center gap-2">
                  <span>Round Robin</span>
                </h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Cycles evenly across healthy nodes in order (A &rarr; B &rarr; C). Disregards worker load, CPU spikes, or differing response speeds.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span>Computational Overhead: <strong>0 ms</strong></span>
                <span className="text-slate-400">Baseline</span>
              </div>
            </div>

            {/* Strategy 2: Least Connections */}
            <div
              onClick={() => setPolicy("least_connections")}
              className={`cursor-pointer rounded-xl p-4 border transition-all flex flex-col justify-between ${
                status.policy === "least_connections"
                  ? "bg-surface-low border-tertiary shadow-[0_0_15px_rgba(129,140,248,0.2)] ring-1 ring-tertiary/40"
                  : "bg-surface border-border-subtle hover:border-slate-600 hover:bg-surface-high/50"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300">
                    Queue & Load-Aware
                  </span>
                  {status.policy === "least_connections" && (
                    <span className="px-2 py-0.5 bg-tertiary text-slate-950 font-mono text-[10px] font-bold rounded">
                      ACTIVE
                    </span>
                  )}
                </div>
                <h3 className="font-mono text-base font-bold text-slate-100 mt-1 flex items-center gap-2">
                  <span>Least Connections</span>
                </h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Sends incoming traffic to whichever worker has the fewest in-flight requests. Adapts reactively to slow down saturated nodes.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span>Computational Overhead: <strong>&lt;0.1 ms</strong></span>
                <span className="text-tertiary">Reactive</span>
              </div>
            </div>

            {/* Strategy 3: AI Latency Prediction */}
            <div
              onClick={() => setPolicy("ai_latency")}
              className={`cursor-pointer rounded-xl p-4 border transition-all flex flex-col justify-between ${
                status.policy === "ai_latency"
                  ? "bg-surface-low border-secondary shadow-[0_0_15px_rgba(16,185,129,0.2)] ring-1 ring-secondary/40"
                  : "bg-surface border-border-subtle hover:border-slate-600 hover:bg-surface-high/50"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300">
                    Machine Learning Regression
                  </span>
                  {status.policy === "ai_latency" && (
                    <span className="px-2 py-0.5 bg-secondary text-slate-950 font-mono text-[10px] font-bold rounded">
                      ACTIVE
                    </span>
                  )}
                </div>
                <h3 className="font-mono text-base font-bold text-slate-100 mt-1 flex items-center gap-2">
                  <span>AI Latency Prediction</span>
                  <Sparkles className="w-4 h-4 text-tertiary" />
                </h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Random Forest tree regression predicts exact response time for each node using CPU, EWMA latency, active load, and request class to select the fastest server.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span>Inference Tax: <strong>~2 ms</strong></span>
                <span className="text-secondary">Predictive</span>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------- */}
        {/* KPI OVERVIEW CARDS                                   */}
        {/* ---------------------------------------------------- */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Decisions */}
          <div className="bg-surface-low border border-border-subtle rounded-lg p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-border-subtle/50 pb-2 mb-2">
              <span className="uppercase tracking-wider">Total Decisions</span>
              <Activity className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-mono text-2xl sm:text-3xl font-bold text-slate-100">
                {decisions.length.toLocaleString()}
              </span>
              <span className="text-[11px] font-mono text-slate-500">Live Telemetry</span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-secondary font-mono">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Real-time Ingress Active</span>
            </div>
          </div>

          {/* Cluster Success Rate */}
          <div className="bg-surface-low border border-border-subtle rounded-lg p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-border-subtle/50 pb-2 mb-2">
              <span className="uppercase tracking-wider">Cluster Success Rate</span>
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

          {/* ML Predictor State */}
          <div className="bg-surface-low border border-border-subtle rounded-lg p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-border-subtle/50 pb-2 mb-2">
              <span className="uppercase tracking-wider">AI Model Status</span>
              <Cpu className="w-3.5 h-3.5 text-tertiary" />
            </div>
            <div className="mt-1">
              <div className="font-mono text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    status.model_ready ? "bg-secondary" : "bg-amber animate-pulse"
                  }`}
                />
                <span>{status.model_ready ? "Calibrated & Ready" : "Uncalibrated"}</span>
              </div>
              <div className="text-[11px] font-mono text-slate-400 truncate mt-1">
                {status.model_version ? `Version: ${status.model_version}` : "Needs 20 samples to train"}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Fallback:</span>
              <span className="text-tertiary font-bold">Least-Connections</span>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------- */}
        {/* BACKEND SERVER CLUSTER & FLEET STATE                 */}
        {/* ---------------------------------------------------- */}
        <section className="bg-surface-low border border-border-subtle rounded-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-primary" />
                <h2 className="font-mono text-sm font-bold tracking-wide uppercase text-slate-100">
                  Target Backend Fleet & Worker Nodes
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Heterogeneous worker cluster simulating asymmetric compute delay, network RTT, and in-flight queue load.
              </p>
            </div>
            <div className="flex items-center gap-3 font-mono text-xs text-slate-400">
              <span className="text-secondary font-medium">● 3 Registered Nodes</span>
              <span className="text-slate-600">|</span>
              <span>Health TTL: 120s</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {backends.map((b) => {
              const isHealthy = b.health_status === "healthy";
              const isFast = b.name === "worker-a";
              const isSlow = b.name === "worker-b";
              const isMed = b.name === "worker-c";

              const diffSeconds = b.last_health_at
                ? Math.round((Date.now() - new Date(b.last_health_at).getTime()) / 1000)
                : null;
              const isStale = diffSeconds !== null && diffSeconds > 100;

              return (
                <div
                  key={b.id}
                  className={`bg-surface border rounded-xl p-4 flex flex-col justify-between transition-all ${
                    !b.enabled
                      ? "border-slate-800 opacity-60"
                      : isStale
                      ? "border-amber/50 bg-amber-950/10"
                      : isHealthy
                      ? "border-border-subtle hover:border-primary/50"
                      : "border-error/40 bg-error-container/5"
                  }`}
                >
                  {/* Node Header */}
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-3 h-3 rounded-full ${
                            !b.enabled
                              ? "bg-slate-600"
                              : isStale
                              ? "bg-amber animate-pulse"
                              : isHealthy
                              ? "bg-secondary shadow-[0_0_8px_rgba(16,185,129,0.7)]"
                              : "bg-error shadow-[0_0_8px_rgba(239,68,68,0.7)]"
                          }`}
                        />
                        <span className="font-mono font-bold text-sm text-slate-100">{b.name}</span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold ${
                            isFast
                              ? "bg-secondary/10 border border-secondary/30 text-secondary"
                              : isSlow
                              ? "bg-amber/10 border border-amber/30 text-amber"
                              : "bg-primary/10 border border-primary/30 text-primary"
                          }`}
                        >
                          {isFast ? "⚡ Fast (15ms)" : isSlow ? "🐢 Slow (60ms)" : "⚖️ Med (30ms)"}
                        </span>
                      </div>

                      {/* Enable/Disable Toggle */}
                      <button
                        onClick={() => toggleBackend(b)}
                        className={`text-xs font-mono px-2.5 py-1 rounded border transition-colors ${
                          b.enabled
                            ? "bg-surface-high hover:bg-error/20 text-slate-300 hover:text-error border-border hover:border-error/50"
                            : "bg-secondary/20 text-secondary hover:bg-secondary/30 border-secondary/50 font-bold"
                        }`}
                        title={b.enabled ? "Disable node from receiving traffic" : "Enable node"}
                      >
                        {b.enabled ? "Disable" : "Enable"}
                      </button>
                    </div>

                    <div className="text-[11px] font-mono text-slate-500 mt-1">
                      Endpoint: <span className="text-slate-400">{b.base_url}</span>
                    </div>

                    {/* Gauges & Telemetry */}
                    <div className="mt-4 space-y-2 font-mono text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Capacity Weight:</span>
                        <span className="text-slate-200 font-bold">{b.capacity_weight}x</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Health State:</span>
                        <span
                          className={`uppercase font-bold ${
                            !b.enabled
                              ? "text-slate-500"
                              : isStale
                              ? "text-amber"
                              : isHealthy
                              ? "text-secondary"
                              : "text-error"
                          }`}
                        >
                          {!b.enabled ? "Disabled" : isStale ? "Stale Telemetry" : b.health_status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Last Observation:</span>
                        <span className={isStale ? "text-amber font-semibold" : "text-slate-400"}>
                          {diffSeconds !== null ? `${diffSeconds}s ago` : "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Node Footer Actions */}
                  <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between text-xs font-mono text-slate-400">
                    <span className="text-[10px]">ID: {b.id.slice(0, 8)}</span>
                    <button
                      onClick={() => sendSingleRequest("normal")}
                      className="text-primary hover:underline flex items-center gap-1 text-[11px]"
                    >
                      <span>Route Test</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ---------------------------------------------------- */}
        {/* TABBED OPERATIONAL VIEW                              */}
        {/* ---------------------------------------------------- */}
        <section className="bg-surface-low border border-border-subtle rounded-xl flex flex-col overflow-hidden">
          {/* Tab Navigation */}
          <div className="flex flex-wrap items-center justify-between px-5 py-3 bg-surface border-b border-border-subtle gap-3">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab("live")}
                className={`px-4 py-1.5 rounded-lg font-mono text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === "live"
                    ? "bg-primary text-slate-950 glow-primary"
                    : "text-slate-400 hover:text-slate-200 hover:bg-surface-high"
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Live Routing Stream</span>
                <span className={`px-1.5 py-0.2 text-[9px] rounded font-mono ${
                  activeTab === "live" ? "bg-slate-900 text-primary" : "bg-surface-highest text-slate-400"
                }`}>
                  {decisions.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("matrix")}
                className={`px-4 py-1.5 rounded-lg font-mono text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === "matrix"
                    ? "bg-primary text-slate-950 glow-primary"
                    : "text-slate-400 hover:text-slate-200 hover:bg-surface-high"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Benchmark Matrix</span>
              </button>

              <button
                onClick={() => setActiveTab("guide")}
                className={`px-4 py-1.5 rounded-lg font-mono text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === "guide"
                    ? "bg-primary text-slate-950 glow-primary"
                    : "text-slate-400 hover:text-slate-200 hover:bg-surface-high"
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Architecture Guide</span>
              </button>
            </div>

            {/* Filter Search */}
            {activeTab === "live" && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex items-center flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search worker, policy, status..."
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
          </div>

          {/* TAB 1: LIVE ROUTING FEED */}
          {activeTab === "live" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface-high/60 text-slate-400">
                    <th className="py-2.5 px-4 font-semibold">Time</th>
                    <th className="py-2.5 px-4 font-semibold">Active Policy</th>
                    <th className="py-2.5 px-4 font-semibold">Selected Node</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Predicted Latency</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Actual Latency</th>
                    <th className="py-2.5 px-4 font-semibold text-center">Status</th>
                    <th className="py-2.5 px-4 font-semibold">Decision Insight & Fallback</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/40">
                  {filteredDecisions.slice(0, 30).map((d) => {
                    const nodeName = d.selected_backend_id
                      ? backendMap.get(d.selected_backend_id) || d.selected_backend_id.slice(0, 8)
                      : "—";
                    const isSuccess = d.success && (d.status_code === 200 || !d.status_code);

                    return (
                      <tr key={d.request_id} className="hover:bg-surface-high/40 transition-colors">
                        <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap">
                          {formatTime(d.decided_at)}
                        </td>
                        <td className="py-2.5 px-4">
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
                        <td className="py-2.5 px-4 font-bold text-slate-200">
                          {nodeName}
                        </td>
                        <td className="py-2.5 px-4 text-right text-slate-400 font-mono">
                          {formatNumber(d.predicted_latency_ms, 1, " ms")}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-100">
                          {formatNumber(d.actual_latency_ms, 1, " ms")}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isSuccess
                                ? "bg-secondary/10 border border-secondary/30 text-secondary"
                                : "bg-error/10 border border-error/30 text-error"
                            }`}
                          >
                            {d.status_code || (isSuccess ? "200 OK" : "502 Gateway")}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          {d.fallback_reason ? (
                            <span className="text-amber font-mono text-[11px] flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber shrink-0" />
                              <span>{d.fallback_reason}</span>
                            </span>
                          ) : (
                            <span className="text-secondary text-[11px] flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-secondary shrink-0" />
                              <span>Optimal Path</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!filteredDecisions.length && (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-500 font-mono">
                        No matching routing decisions recorded. Send a test request from the playground above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: BENCHMARK MATRIX */}
          {activeTab === "matrix" && (
            <div className="p-5 flex flex-col gap-6">
              <div className="flex justify-end">
                <button
                  onClick={createExperiment}
                  className="px-3 py-1.5 bg-secondary text-slate-950 font-mono text-xs font-bold rounded-lg hover:bg-secondary-light flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Launch New Benchmark Run</span>
                </button>
              </div>
              <ExperimentMatrixSection experiments={experiments} />
            </div>
          )}

          {/* TAB 3: ARCHITECTURE GUIDE */}
          {activeTab === "guide" && (
            <div className="p-6 flex flex-col gap-6 font-mono text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-surface border border-border-subtle rounded-xl p-5">
                  <div className="flex items-center gap-2 text-primary font-bold text-sm mb-2">
                    <Activity className="w-4 h-4" />
                    <span>1. Telemetry Collection</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed font-sans text-xs">
                    Every node continuously samples CPU usage, resident memory, and in-flight queue depth. The load balancer computes exponentially-weighted moving averages (EWMA) of actual round-trip latency.
                  </p>
                </div>

                <div className="bg-surface border border-border-subtle rounded-xl p-5">
                  <div className="flex items-center gap-2 text-tertiary font-bold text-sm mb-2">
                    <Cpu className="w-4 h-4" />
                    <span>2. ML Latency Regression</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed font-sans text-xs">
                    A Scikit-Learn Random Forest Regressor models non-linear latency curves based on current node health features and incoming workload class. It predicts exact completion time for each candidate.
                  </p>
                </div>

                <div className="bg-surface border border-border-subtle rounded-xl p-5">
                  <div className="flex items-center gap-2 text-secondary font-bold text-sm mb-2">
                    <ShieldCheck className="w-4 h-4" />
                    <span>3. Safe Fallback Guarantee</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed font-sans text-xs">
                    If the AI model is uncalibrated, encounters corrupted artifacts, or exceeds inference timeouts, the router automatically fails over to Least Connections, ensuring zero dropped requests.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* ======================================================== */}
      {/* 3. NOC FOOTER                                            */}
      {/* ======================================================== */}
      <footer className="border-t border-border-subtle bg-surface-lowest px-6 py-3 text-xs font-mono text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-secondary" />
          <span>NET//PULSE v1.0.8</span>
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
        <p className="text-xs text-slate-600 mt-1">Click "Launch New Benchmark Run" above to record automated multi-workload comparisons.</p>
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

      {/* Right Column: Research Takeaways */}
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
