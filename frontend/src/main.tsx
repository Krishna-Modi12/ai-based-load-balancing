import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

type Backend = { id:string; name:string; health_status:string; enabled:boolean; capacity_weight:number; last_health_at?:string };
type Decision = { request_id:string; policy:string; selected_backend_id?:string; predicted_latency_ms?:number; actual_latency_ms?:number; status_code?:number; success:boolean; fallback_reason?:string; decided_at:string };
const api = import.meta.env.VITE_API_BASE_URL || "";

function App() {
  const [backends, setBackends] = useState<Backend[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [status, setStatus] = useState<{policy:string; model_ready:boolean; model_version?:string}>({policy:"loading", model_ready:false});
  const [error, setError] = useState("");
  const refresh = async () => {
    try { const [b, d, s] = await Promise.all([fetch(`${api}/api/v1/backends`), fetch(`${api}/api/v1/decisions`), fetch(`${api}/api/v1/system/status`)]);
      if (!b.ok || !d.ok || !s.ok) throw new Error("API is not ready"); setBackends(await b.json()); setDecisions(await d.json()); setStatus(await s.json()); setError("");
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
  <footer>AI mode uses a persisted Random Forest only when a validated artifact is active; otherwise it safely falls back to Least Connections.</footer></main>
}
function Card({title,value}:{title:string;value:string}) { return <article className="card"><p>{title}</p><strong>{value}</strong></article>; }
createRoot(document.getElementById("root")!).render(<App/>);
