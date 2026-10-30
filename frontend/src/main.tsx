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
  EyeOff,
  Network,
  GitBranch,
  ChevronDown,
  ChevronUp
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
  const [activeTab, setActiveTab] = useState<"diagram" | "live" | "matrix" | "guide">("diagram");
  const [searchFilter, setSearchFilter] = useState("");
  const [tokenVisible, setTokenVisible] = useState(false);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [showBeginnerGuide, setShowBeginnerGuide] = useState(false);

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

  // Active target worker for diagram (defaults to lastResult or first decision)
  const activeWorkerName = lastResult?.backend || (decisions[0]?.selected_backend_id ? backendMap.get(decisions[0].selected_backend_id) || "worker-a" : "worker-a");

  return (
    <div className="min-h-screen bg-surface-lowest text-slate-100 flex flex-col font-sans selection:bg-primary/20 selection:text-primary">
      {/* ======================================================== */}
      {/* 1. TOP NAVIGATION / NOC STATUS BAR                      */}
      {/* ======================================================== */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-4 sm:px-6 h-14 bg-surface-lowest/95 backdrop-blur border-b border-border-subtle">
        {/* Brand */}
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary glow-primary">
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
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-surface-low border border-border-subtle rounded-md font-mono text-xs">
            <span className="w-2 h-2 rounded-full bg-secondary animate-beacon shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
            <span className="text-secondary font-medium">Cluster Online</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">Policy:</span>
            <span className="text-primary font-bold uppercase">{status.policy.replace("_", " ")}</span>
          </div>

          {/* AI Model State */}
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 bg-surface-low border border-border-subtle rounded-md font-mono text-xs text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-tertiary" />
            <span>AI Predictor:</span>
            <span className={`font-semibold ${status.model_ready ? "text-tertiary" : "text-amber"}`}>
              {status.model_ready ? status.model_version || "Trained & Active" : "Untrained (Fallback Active)"}
            </span>
          </div>
        </div>

        {/* Top Controls: Admin Token & Helpers */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Beginner Guide Toggle Button */}
          <button
            onClick={() => setShowBeginnerGuide(!showBeginnerGuide)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-mono transition-all ${
              showBeginnerGuide
                ? "bg-primary text-slate-950 font-bold border-primary"
                : "bg-surface-low hover:bg-surface-high text-primary border-primary/30"
            }`}
            title="Toggle plain-English explanation of how this works"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">How It Works</span>
            {showBeginnerGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {/* Admin Token Drawer */}
          <div className="flex items-center bg-surface-low border border-border-subtle rounded-md px-2.5 py-1">
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
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-mono transition-colors ${
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
            className="p-1.5 bg-surface-low hover:bg-surface-high border border-border-subtle rounded-md text-slate-300 transition-colors"
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
              <strong>Telemetry is Stale (&gt;100s):</strong> The load balancer router requires recent health observations to safely dispatch traffic.
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
      {/* COLLAPSIBLE BEGINNER'S GUIDE (PLAIN ENGLISH EXPLAINER)   */}
      {/* ======================================================== */}
      {showBeginnerGuide && (
        <section className="bg-surface-low border-b border-primary/30 px-6 py-5 bg-gradient-to-b from-primary/5 to-transparent transition-all animate-fadeIn">
          <div className="max-w-[1440px] mx-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-primary" />
                <h2 className="font-mono text-sm font-bold text-slate-100 uppercase tracking-wider">
                  Plain-English Guide: How This System Works & Why It Matters
                </h2>
              </div>
              <button
                onClick={() => setShowBeginnerGuide(false)}
                className="text-xs font-mono text-slate-400 hover:text-slate-200"
              >
                Close ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4 text-xs font-sans">
              <div className="bg-surface border border-border-subtle rounded-xl p-4">
                <div className="font-mono font-bold text-primary text-sm flex items-center gap-1.5 mb-1.5">
                  <span>1. What is a Load Balancer?</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  When millions of users visit a website simultaneously, one single computer would crash. A <strong>load balancer</strong> acts like an air traffic controller at an airport, distributing incoming user requests across a fleet of backend servers so no single machine gets overloaded.
                </p>
              </div>

              <div className="bg-surface border border-border-subtle rounded-xl p-4">
                <div className="font-mono font-bold text-tertiary text-sm flex items-center gap-1.5 mb-1.5">
                  <span>2. Why Do Old Algorithms Fail?</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Classic algorithms like <strong>Round Robin</strong> blindly assign requests in a circle (1 &rarr; 2 &rarr; 3). But real cloud servers are <em>asymmetric</em>: some are fast, some are slow (like <code>Worker B</code> at 60ms). Sending heavy traffic to a slow server causes huge queues and angry users.
                </p>
              </div>

              <div className="bg-surface border border-border-subtle rounded-xl p-4">
                <div className="font-mono font-bold text-secondary text-sm flex items-center gap-1.5 mb-1.5">
                  <span>3. How Does Our AI Model Fix It?</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Our system uses a <strong>Random Forest Regression</strong> machine learning model. It reads live CPU usage, active connections, and historical latency, then calculates: <em>"Which server will finish this specific request fastest?"</em> and routes traffic along the <strong>Optimal Path</strong>!
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* 2. MAIN WORKSPACE                                        */}
      {/* ======================================================== */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">

        {/* ---------------------------------------------------- */}
        {/* INTERACTIVE TRAFFIC PLAYGROUND & SIMULATION BOX      */}
        {/* ---------------------------------------------------- */}
        <section className="bg-surface-low border border-border-subtle rounded-xl p-5 shadow-lg relative overflow-hidden">
          {/* Cyber Accent Line */}
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
                Dispatch simulated web requests through the Layer-7 load balancer to watch routing decisions, response latencies, and AI predictions in real time.
              </p>
            </div>

            {/* Quick Calibration Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={healthCheck}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-high hover:bg-surface-bright text-secondary border border-secondary/40 rounded-md text-xs font-mono font-medium transition-all"
                title="Poll all workers to refresh latency and CPU telemetry"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Calibrate Health</span>
              </button>

              <button
                onClick={trainModel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-tertiary/10 hover:bg-tertiary/20 text-tertiary border border-tertiary/40 rounded-md text-xs font-mono font-medium transition-all"
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
                <span>1. Select Request Complexity</span>
              </span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "light", label: "Light", desc: "Fast (1x CPU ping)", color: "border-secondary text-secondary bg-secondary/10" },
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
                <span>2. Dispatch Live Traffic</span>
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
                <span className="uppercase font-semibold">Latest Request Result</span>
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
        {/* OPTIMAL PATH ARCHITECTURE DIAGRAM & EXPLAINER        */}
        {/* ---------------------------------------------------- */}
        <section className="bg-surface-low border border-border-subtle rounded-xl p-5 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border-subtle">
            <div>
              <div className="flex items-center gap-2">
                <Network className="w-5 h-5 text-primary" />
                <h2 className="font-mono text-sm font-bold tracking-wide uppercase text-slate-100">
                  Live Routing Flow & Optimal Path Diagram
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Interactive topological visualization showing how traffic flows from the client through the AI decision engine to the optimal server.
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
              <span className="px-2 py-0.5 bg-secondary/10 border border-secondary/30 text-secondary rounded">
                Active Target: {activeWorkerName}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4 items-center">
            {/* Visual SVG Diagram */}
            <div className="lg:col-span-8 bg-surface rounded-xl p-4 border border-border-subtle overflow-x-auto flex justify-center">
              <OptimalPathSVG
                activeWorker={activeWorkerName}
                selectedClass={selectedClass}
                policy={status.policy}
                lastResult={lastResult}
              />
            </div>

            {/* Step-by-Step Path Explanation */}
            <div className="lg:col-span-4 flex flex-col gap-3 font-mono text-xs">
              <div className="bg-surface border border-border-subtle rounded-xl p-4">
                <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase mb-2">
                  <GitBranch className="w-4 h-4" />
                  <span>Why this Path was Chosen?</span>
                </div>
                
                <div className="space-y-3 font-sans text-xs text-slate-300">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-mono text-[10px] flex items-center justify-center shrink-0 font-bold">1</span>
                    <p>
                      <strong>Workload Analyzed:</strong> The incoming request was classified as <code>{selectedClass.toUpperCase()}</code>.
                    </p>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-tertiary/20 text-tertiary font-mono text-[10px] flex items-center justify-center shrink-0 font-bold">2</span>
                    <p>
                      <strong>Telemetry Scored:</strong> Real-time CPU, EWMA response times, and queue depth were fed into the router.
                    </p>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-secondary/20 text-secondary font-mono text-[10px] flex items-center justify-center shrink-0 font-bold">3</span>
                    <p>
                      <strong>Optimal Decision:</strong> Routed to <strong>{activeWorkerName}</strong> because it provides the lowest predicted waiting time, successfully bypassing slower nodes.
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border-subtle/50 font-mono text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Routing Strategy:</span>
                  <span className="text-secondary font-bold uppercase">{status.policy.replace("_", " ")}</span>
                </div>
              </div>
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
                Routing Policy Strategy Explained
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
                <p className="text-xs text-slate-400 mt-2 leading-relaxed font-sans">
                  Cycles evenly across healthy nodes in order (A &rarr; B &rarr; C). Disregards worker load, CPU spikes, or differing response speeds.
                </p>
                <div className="mt-3 p-2 bg-surface-high rounded text-[11px] text-slate-300 font-sans">
                  <strong>When to use:</strong> Simple clusters where all servers have identical hardware and identical light workloads.
                </div>
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
                <p className="text-xs text-slate-400 mt-2 leading-relaxed font-sans">
                  Sends incoming traffic to whichever worker has the fewest active in-flight requests. Reacts dynamically when a server becomes overloaded.
                </p>
                <div className="mt-3 p-2 bg-surface-high rounded text-[11px] text-slate-300 font-sans">
                  <strong>When to use:</strong> Long-running database queries, web sockets, or transactions where connections persist.
                </div>
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
                <p className="text-xs text-slate-400 mt-2 leading-relaxed font-sans">
                  A Random Forest ML regressor predicts the exact response time for each server using live CPU, EWMA latency, and request class.
                </p>
                <div className="mt-3 p-2 bg-surface-high rounded text-[11px] text-slate-300 font-sans">
                  <strong>When to use:</strong> Heterogeneous cloud fleets with unequal server speeds and variable request complexities.
                </div>
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
          <div className="bg-surface-low border border-border-subtle rounded-xl p-4 flex flex-col justify-between">
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
          <div className="bg-surface-low border border-border-subtle rounded-xl p-4 flex flex-col justify-between">
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
          <div className="bg-surface-low border border-border-subtle rounded-xl p-4 flex flex-col justify-between">
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
          <div className="bg-surface-low border border-border-subtle rounded-xl p-4 flex flex-col justify-between">
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
                onClick={() => setActiveTab("diagram")}
                className={`px-4 py-1.5 rounded-lg font-mono text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === "diagram"
                    ? "bg-primary text-slate-950 glow-primary"
                    : "text-slate-400 hover:text-slate-200 hover:bg-surface-high"
                }`}
              >
                <Network className="w-3.5 h-3.5" />
                <span>Live Routing Flow</span>
              </button>

              <button
                onClick={() => setActiveTab("live")}
                className={`px-4 py-1.5 rounded-lg font-mono text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === "live"
                    ? "bg-primary text-slate-950 glow-primary"
                    : "text-slate-400 hover:text-slate-200 hover:bg-surface-high"
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Decisions Stream</span>
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

            {/* Filter Search for Live Tab */}
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

          {/* TAB 0: INTERACTIVE ROUTING FLOW */}
          {activeTab === "diagram" && (
            <div className="p-6 flex flex-col gap-6">
              <div className="bg-surface rounded-xl p-5 border border-border-subtle">
                <h3 className="font-mono text-sm font-bold text-slate-100 uppercase mb-1">
                  How The Load Balancer Evaluates The Optimal Path
                </h3>
                <p className="text-xs text-slate-400 mb-4 font-sans">
                  Whenever an HTTP request arrives, the router checks the selected policy to decide which backend will process it:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
                  <div className="p-3 bg-surface-high rounded-lg border border-border-subtle">
                    <div className="font-bold text-secondary flex items-center gap-1.5 mb-1">
                      <span>Worker A (⚡ Fast Tier)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-sans">
                      Base delay: 15ms. Chosen preferentially by the AI for heavy and standard workloads due to low execution latency.
                    </p>
                  </div>

                  <div className="p-3 bg-surface-high rounded-lg border border-border-subtle">
                    <div className="font-bold text-amber flex items-center gap-1.5 mb-1">
                      <span>Worker B (🐢 Slow Tier)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-sans">
                      Base delay: 60ms. Avoided by AI during load bursts. Dumb algorithms (Round Robin) blindly send traffic here, causing slowdowns.
                    </p>
                  </div>

                  <div className="p-3 bg-surface-high rounded-lg border border-border-subtle">
                    <div className="font-bold text-primary flex items-center gap-1.5 mb-1">
                      <span>Worker C (⚖️ Medium Tier)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-sans">
                      Base delay: 30ms. Acts as a balanced intermediary buffer node when Worker A experiences high concurrency.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

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
                    <th className="py-2.5 px-4 font-semibold">Path Decision Explanation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/40">
                  {filteredDecisions.slice(0, 30).map((d) => {
                    const nodeName = d.selected_backend_id
                      ? backendMap.get(d.selected_backend_id) || d.selected_backend_id.slice(0, 8)
                      : "—";
                    const isSuccess = d.success && (d.status_code === 200 || !d.status_code);

                    // Plain English Decision Reason
                    let reasonText = "Optimal path selected";
                    if (d.fallback_reason) {
                      reasonText = `Fallback triggered: ${d.fallback_reason}`;
                    } else if (d.policy === "ai_latency") {
                      reasonText = `AI selected ${nodeName} (Predicted ${d.predicted_latency_ms?.toFixed(1) || "?"}ms, lowest latency)`;
                    } else if (d.policy === "round_robin") {
                      reasonText = `Sequential cyclic dispatch to ${nodeName}`;
                    } else if (d.policy === "least_connections") {
                      reasonText = `Dispatched to ${nodeName} with lowest active connections`;
                    }

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
                              <span>{reasonText}</span>
                            </span>
                          ) : (
                            <span className="text-secondary text-[11px] flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-secondary shrink-0" />
                              <span>{reasonText}</span>
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
// Interactive Optimal Path SVG Diagram Component
// ----------------------------------------------------
function OptimalPathSVG({
  activeWorker,
  selectedClass,
  policy,
  lastResult,
}: {
  activeWorker: string;
  selectedClass: string;
  policy: string;
  lastResult: LastRouteResult | null;
}) {
  const isA = activeWorker === "worker-a";
  const isB = activeWorker === "worker-b";
  const isC = activeWorker === "worker-c";

  return (
    <div className="w-full max-w-[760px] flex flex-col items-center">
      <svg
        viewBox="0 0 760 260"
        className="w-full h-auto select-none"
        style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.5))" }}
      >
        <defs>
          {/* Gradients */}
          <linearGradient id="gradOptimalA" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
          <linearGradient id="gradOptimalB" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
          <linearGradient id="gradOptimalC" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>

          {/* Glow Filters */}
          <filter id="glowGreen" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glowCyan" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ---------------- PATHS ---------------- */}
        {/* Ingress Path: Client -> Router */}
        <path
          d="M 120 130 L 260 130"
          stroke="#06b6d4"
          strokeWidth="3"
          strokeDasharray="6 4"
          className="animate-pulse"
        />

        {/* Branch Path to Worker A */}
        <path
          d="M 390 130 C 470 130, 490 55, 560 55"
          fill="none"
          stroke={isA ? "url(#gradOptimalA)" : "#1e293b"}
          strokeWidth={isA ? "4" : "1.5"}
          strokeDasharray={isA ? undefined : "4 4"}
          filter={isA ? "url(#glowGreen)" : undefined}
          className={isA ? "transition-all duration-300" : "opacity-40"}
        />

        {/* Branch Path to Worker B */}
        <path
          d="M 390 130 C 470 130, 490 130, 560 130"
          fill="none"
          stroke={isB ? "url(#gradOptimalB)" : "#1e293b"}
          strokeWidth={isB ? "4" : "1.5"}
          strokeDasharray={isB ? undefined : "4 4"}
          filter={isB ? "url(#glowGreen)" : undefined}
          className={isB ? "transition-all duration-300" : "opacity-40"}
        />

        {/* Branch Path to Worker C */}
        <path
          d="M 390 130 C 470 130, 490 205, 560 205"
          fill="none"
          stroke={isC ? "url(#gradOptimalC)" : "#1e293b"}
          strokeWidth={isC ? "4" : "1.5"}
          strokeDasharray={isC ? undefined : "4 4"}
          filter={isC ? "url(#glowGreen)" : undefined}
          className={isC ? "transition-all duration-300" : "opacity-40"}
        />

        {/* ---------------- NODE 1: CLIENT INGRESS ---------------- */}
        <g transform="translate(15, 85)">
          <rect
            width="105"
            height="90"
            rx="10"
            fill="#0b1329"
            stroke="#1e293b"
            strokeWidth="1.5"
          />
          <text x="52" y="24" fill="#94a3b8" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            CLIENT
          </text>
          <text x="52" y="44" fill="#38bdf8" fontSize="12" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            127.0.0.1
          </text>
          <rect x="15" y="56" width="75" height="20" rx="4" fill="#0284c7" fillOpacity="0.15" stroke="#0284c7" strokeWidth="0.8" />
          <text x="52" y="70" fill="#38bdf8" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            {selectedClass.toUpperCase()} REQ
          </text>
        </g>

        {/* ---------------- NODE 2: AI ROUTER (NET//PULSE CORE) ---------------- */}
        <g transform="translate(260, 70)">
          <rect
            width="130"
            height="120"
            rx="12"
            fill="#0c1833"
            stroke="#06b6d4"
            strokeWidth="2"
            filter="url(#glowCyan)"
          />
          <text x="65" y="24" fill="#06b6d4" fontSize="11" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            NET//PULSE
          </text>
          <text x="65" y="40" fill="#64748b" fontSize="9" fontFamily="monospace" textAnchor="middle">
            AI DECISION CORE
          </text>

          <rect x="12" y="52" width="106" height="26" rx="5" fill="#050b14" stroke="#1e293b" strokeWidth="1" />
          <text x="65" y="68" fill="#e2e8f0" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            {policy === "ai_latency" ? "RANDOM FOREST" : policy === "least_connections" ? "LEAST CONNS" : "ROUND ROBIN"}
          </text>

          <text x="65" y="96" fill="#10b981" fontSize="9" fontFamily="monospace" textAnchor="middle">
            ● EVALUATING FLEET
          </text>
        </g>

        {/* ---------------- NODE 3A: WORKER A (FAST) ---------------- */}
        <g transform="translate(560, 20)">
          <rect
            width="180"
            height="70"
            rx="8"
            fill="#091426"
            stroke={isA ? "#10b981" : "#1e293b"}
            strokeWidth={isA ? "2.5" : "1"}
            className="transition-all"
          />
          <circle cx="18" cy="22" r="5" fill={isA ? "#10b981" : "#64748b"} />
          <text x="32" y="25" fill="#f8fafc" fontSize="12" fontFamily="monospace" fontWeight="bold">
            Worker A (Fast)
          </text>
          {isA && (
            <rect x="115" y="12" width="55" height="18" rx="4" fill="#10b981" />
          )}
          {isA && (
            <text x="142" y="25" fill="#022c22" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
              OPTIMAL
            </text>
          )}
          <text x="18" y="45" fill="#94a3b8" fontSize="10" fontFamily="monospace">
            Base Delay: 15ms • Weight: 2x
          </text>
          <text x="18" y="60" fill={isA ? "#34d399" : "#64748b"} fontSize="9" fontFamily="monospace">
            {isA && lastResult ? `Actual Latency: ${lastResult.actual_latency_ms?.toFixed(1)}ms` : "Fastest compute tier"}
          </text>
        </g>

        {/* ---------------- NODE 3B: WORKER B (SLOW) ---------------- */}
        <g transform="translate(560, 95)">
          <rect
            width="180"
            height="70"
            rx="8"
            fill="#091426"
            stroke={isB ? "#f59e0b" : "#1e293b"}
            strokeWidth={isB ? "2.5" : "1"}
            className="transition-all"
          />
          <circle cx="18" cy="22" r="5" fill={isB ? "#f59e0b" : "#64748b"} />
          <text x="32" y="25" fill="#f8fafc" fontSize="12" fontFamily="monospace" fontWeight="bold">
            Worker B (Slow)
          </text>
          {isB && (
            <rect x="115" y="12" width="55" height="18" rx="4" fill="#f59e0b" />
          )}
          {isB && (
            <text x="142" y="25" fill="#451a03" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
              SELECTED
            </text>
          )}
          <text x="18" y="45" fill="#94a3b8" fontSize="10" fontFamily="monospace">
            Base Delay: 60ms • Weight: 1x
          </text>
          <text x="18" y="60" fill={isB ? "#fbbf24" : "#64748b"} fontSize="9" fontFamily="monospace">
            {isB && lastResult ? `Actual Latency: ${lastResult.actual_latency_ms?.toFixed(1)}ms` : "High-latency node"}
          </text>
        </g>

        {/* ---------------- NODE 3C: WORKER C (MEDIUM) ---------------- */}
        <g transform="translate(560, 170)">
          <rect
            width="180"
            height="70"
            rx="8"
            fill="#091426"
            stroke={isC ? "#818cf8" : "#1e293b"}
            strokeWidth={isC ? "2.5" : "1"}
            className="transition-all"
          />
          <circle cx="18" cy="22" r="5" fill={isC ? "#818cf8" : "#64748b"} />
          <text x="32" y="25" fill="#f8fafc" fontSize="12" fontFamily="monospace" fontWeight="bold">
            Worker C (Med)
          </text>
          {isC && (
            <rect x="115" y="12" width="55" height="18" rx="4" fill="#818cf8" />
          )}
          {isC && (
            <text x="142" y="25" fill="#1e1b4b" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
              OPTIMAL
            </text>
          )}
          <text x="18" y="45" fill="#94a3b8" fontSize="10" fontFamily="monospace">
            Base Delay: 30ms • Weight: 1x
          </text>
          <text x="18" y="60" fill={isC ? "#a5b4fc" : "#64748b"} fontSize="9" fontFamily="monospace">
            {isC && lastResult ? `Actual Latency: ${lastResult.actual_latency_ms?.toFixed(1)}ms` : "Balanced secondary node"}
          </text>
        </g>
      </svg>
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
              <div key={e.id} className="bg-surface border border-border-subtle rounded-xl p-3">
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
      <div className="bg-surface border border-border-subtle rounded-xl p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 border-b border-border-subtle pb-3 mb-4">
            <ShieldCheck className="w-4 h-4 text-secondary" />
            <h4 className="font-mono text-sm font-bold text-slate-100 uppercase">
              Scientific Findings
            </h4>
          </div>

          <div className="space-y-4 font-mono text-xs text-slate-300">
            <div className="p-3 bg-surface-high border border-border rounded-lg">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                Heterogeneous Asymmetry
              </span>
              <div className="text-lg font-bold text-secondary mt-0.5">AI Optimal</div>
              <p className="text-[11px] text-slate-400 mt-1 font-sans">
                Under unequal node delays (15ms vs 60ms), Random Forest latency prediction avoids queue build-up on slow workers.
              </p>
            </div>

            <div className="p-3 bg-surface-high border border-border rounded-lg">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                Inference Latency Tax
              </span>
              <div className="text-lg font-bold text-amber mt-0.5">~2-5 ms / eval</div>
              <p className="text-[11px] text-slate-400 mt-1 font-sans">
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
            className="w-full text-center py-2 bg-surface-high hover:bg-surface-bright text-primary border border-border rounded-lg transition-colors"
          >
            Raw Experiments API JSON ↗
          </a>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
