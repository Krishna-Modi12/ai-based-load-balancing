import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

type Backend = { id:string; name:string; health_status:string; enabled:boolean; capacity_weight:number; last_health_at?:string };
type Decision = { request_id:string; policy:string; selected_backend_id?:string; predicted_latency_ms?:number; actual_latency_ms?:number; status_code?:number; success:boolean; fallback_reason?:string; decided_at:string };
type ExperimentMetric = { request_count:number; success_count:number; error_count:number; throughput_rps:number; error_rate:number; latency_p50_ms?:number; latency_p95_ms?:number; latency_p99_ms?:number; ai_prediction_mae_ms?:number; distribution_json?:Record<string,number> };
type Experiment = { id:string; name:string; policy:string; workload_profile:string; repetition:number; scenario:string; status:string; ended_at?:string; metric?:ExperimentMetric };
const api = import.meta.env.VITE_API_BASE_URL || "";

function App() {
  const [backends, setBackends] = useState<Backend[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [status, setStatus] = useState<{policy:string; model_ready:boolean; model_version?:string}>({policy:"loading", model_ready:false});
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [error, setError] = useState("");
  const refresh = async () => {
    try { const [b, d, s, e] = await Promise.all([fetch(`${api}/api/v1/backends`), fetch(`${api}/api/v1/decisions`), fetch(`${api}/api/v1/system/status`), fetch(`${api}/api/v1/experiments`)]);
      if (!b.ok || !d.ok || !s.ok || !e.ok) throw new Error("API is not ready"); setBackends(await b.json()); setDecisions(await d.json()); setStatus(await s.json()); setExperiments(await e.json()); setError("");
    } catch { setError("Cannot reach the API. Start Docker Compose and run health checks first."); }
  };
  useEffect(() => { refresh(); const id = window.setInterval(refresh, 3000); return () => clearInterval(id); }, []);
  const successful = decisions.filter(d => d.success).length;
  const p95 = [...decisions].filter(d => d.actual_latency_ms !== undefined).sort((a,b)=>(a.actual_latency_ms||0)-(b.actual_latency_ms||0))[Math.floor(decisions.length*.95)]?.actual_latency_ms;
  return <main><header><div><p className="eyebrow">LAYER-7 RESEARCH DEMONSTRATOR</p><h1>Load Balancing Console</h1></div><button onClick={refresh}>Refresh live data</button></header>
  {error && <p className="error">{error}</p>}
  <section className="kpis"><Card title="Total decisions" value={String(decisions.length)} /><Card title="Successful" value={`${successful} (${decisions.length ? Math.round(successful/decisions.length*100) : 0}%)`} /><Card title="P95 latency" value={p95 ? `${p95.toFixed(1)} ms` : "—"} /><Card title="Active policy" value={status.policy} /></section>
  <section className="panel"><h2>Backend health</h2><p className="muted">Worker metrics are marked simulated by this local demonstrator.</p><div className="backends">{backends.map(b => <article key={b.id}><strong>{b.name}</strong><span className={`badge ${b.health_status}`}>{b.health_status}</span><p>Capacity weight: {b.capacity_weight}</p><p>{b.enabled ? "Enabled" : "Disabled"}</p></article>)}{!backends.length && <p>No registered backends yet.</p>}</div></section>
  <section className="panel"><h2>Recent routing decisions</h2><div className="scroll"><table><thead><tr><th>Time</th><th>Policy</th><th>Backend ID</th><th>Predicted</th><th>Actual</th><th>Status</th><th>Fallback</th></tr></thead><tbody>{decisions.map(d=><tr key={d.request_id}><td>{new Date(d.decided_at).toLocaleTimeString()}</td><td>{d.policy}</td><td>{d.selected_backend_id?.slice(0,8) || "—"}</td><td>{d.predicted_latency_ms?.toFixed(1) || "—"}</td><td>{d.actual_latency_ms?.toFixed(1) || "—"}</td><td>{d.status_code || "—"}</td><td>{d.fallback_reason || "—"}</td></tr>)}</tbody></table></div></section>
  <ExperimentComparison experiments={experiments} />
  <footer>AI mode uses a persisted Random Forest only when a validated artifact is active; otherwise it safely falls back to Least Connections.</footer></main>
}
function Card({title,value}:{title:string;value:string}) { return <article className="card"><p>{title}</p><strong>{value}</strong></article>; }
function ExperimentComparison({experiments}:{experiments:Experiment[]}) {
  const completed = experiments.filter(e => e.status === "completed" && e.metric);
  const maxP95 = Math.max(...completed.map(e => e.metric?.latency_p95_ms || 0), 1);
  return <section className="panel"><div className="section-heading"><div><h2>Experiment comparison</h2><p className="muted">Measured runs only; queued or failed runs are excluded from the chart.</p></div><a className="button-link" href={`${api}/api/v1/experiments`}>API results</a></div>
    {!completed.length ? <p className="muted">No completed experiments yet. Start the Phase 7 CLI or create a run through the API.</p> :
      <><div className="comparison-chart" role="img" aria-label="P95 latency by completed experiment">{completed.slice(0, 12).map(e => <div className="bar-row" key={e.id}><span>{e.policy} · {e.workload_profile} · r{e.repetition}</span><div className="bar-track"><div className="bar" style={{width:`${((e.metric?.latency_p95_ms || 0) / maxP95) * 100}%`}} /></div><strong>{e.metric?.latency_p95_ms?.toFixed(1) || "—"} ms</strong></div>)}</div>
      <div className="scroll"><table><thead><tr><th>Run</th><th>Status</th><th>Requests</th><th>Throughput</th><th>P50</th><th>P95</th><th>Errors</th><th>Export</th></tr></thead><tbody>{completed.map(e=><tr key={e.id}><td>{e.policy} / {e.workload_profile} / r{e.repetition}</td><td>{e.status}</td><td>{e.metric?.request_count}</td><td>{e.metric?.throughput_rps?.toFixed(2)} req/s</td><td>{e.metric?.latency_p50_ms?.toFixed(1)} ms</td><td>{e.metric?.latency_p95_ms?.toFixed(1)} ms</td><td>{(e.metric?.error_rate || 0) * 100}%</td><td><a href={`${api}/api/v1/experiments/${e.id}/export?format=csv`}>CSV</a></td></tr>)}</tbody></table></div></>}
  </section>;
}
createRoot(document.getElementById("root")!).render(<App/>);
