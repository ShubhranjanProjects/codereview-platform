import { useState, useEffect, useCallback } from "react";

// ─── API Client ───────────────────────────────────────────────────────────────
const api = (() => {
  const BASE = "/api";
  const tok  = () => localStorage.getItem("cr_token");
  const req  = async (path, opts = {}) => {
    const t = tok();
    const res = await fetch(BASE + path, {
      ...opts,
      headers: { "Content-Type":"application/json", ...(t?{Authorization:`Bearer ${t}`}:{}), ...(opts.headers||{}) },
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  };
  return {
    login:         b  => req("/auth/login",      { method:"POST", body:JSON.stringify(b) }),
    me:            ()  => req("/auth/me"),
    getEmployees:  ()  => req("/employees"),
    getEmpStats:   id  => req(`/employees/${id}/stats`),
    getReviews:    p   => req("/reviews?" + new URLSearchParams(p||{})),
    analyzeCode:   b   => req("/reviews/analyze", { method:"POST", body:JSON.stringify(b) }),
    getDashboard:  ()  => req("/analytics/dashboard"),
  };
})();

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:"#0a0d14", surface:"#111520", card:"#161c2d", border:"#1e2a45",
  accent:"#3b82f6", gold:"#f59e0b", green:"#10b981", red:"#ef4444",
  orange:"#f97316", purple:"#8b5cf6", text:"#e2e8f0", muted:"#64748b", dim:"#334155",
};

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Space Grotesk',sans-serif;background:${C.bg};color:${C.text};min-height:100vh;overflow-x:hidden}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:${C.surface}}::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px}
.mono{font-family:'JetBrains Mono',monospace}
@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes slideIn{from{transform:translateX(-12px);opacity:0}to{transform:translateX(0);opacity:1}}
.fade-in{animation:fadeIn .3s ease forwards}.slide-in{animation:slideIn .3s ease forwards}
.btn{display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:8px;border:none;cursor:pointer;font-family:'Space Grotesk',sans-serif;font-size:14px;font-weight:500;transition:all .15s}
.btn:disabled{opacity:.5;cursor:not-allowed}
.btn-primary{background:${C.accent};color:#fff}.btn-primary:hover:not(:disabled){background:#2563eb;transform:translateY(-1px)}
.btn-ghost{background:transparent;color:${C.muted};border:1px solid ${C.border}}.btn-ghost:hover{background:${C.card};color:${C.text}}
.input{width:100%;padding:10px 14px;background:${C.surface};border:1px solid ${C.border};border-radius:8px;color:${C.text};font-family:'Space Grotesk',sans-serif;font-size:14px;transition:border-color .15s;outline:none}
.input:focus{border-color:${C.accent}}.input::placeholder{color:${C.dim}}
.textarea{width:100%;padding:12px 14px;min-height:140px;resize:vertical;background:${C.surface};border:1px solid ${C.border};border-radius:8px;color:${C.text};font-family:'JetBrains Mono',monospace;font-size:13px;transition:border-color .15s;outline:none;line-height:1.6}
.textarea:focus{border-color:${C.accent}}
.select{padding:9px 12px;background:${C.surface};border:1px solid ${C.border};border-radius:8px;color:${C.text};font-family:'Space Grotesk',sans-serif;font-size:14px;cursor:pointer;outline:none}
.select:focus{border-color:${C.accent}}
.badge{display:inline-flex;align-items:center;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase}
.badge-critical{background:${C.red}20;color:${C.red};border:1px solid ${C.red}30}
.badge-high{background:${C.orange}20;color:${C.orange};border:1px solid ${C.orange}30}
.badge-medium{background:${C.gold}20;color:${C.gold};border:1px solid ${C.gold}30}
.badge-low{background:${C.green}20;color:${C.green};border:1px solid ${C.green}30}
.spinner{width:18px;height:18px;border:2px solid ${C.border};border-top-color:${C.accent};border-radius:50%;animation:spin .6s linear infinite;display:inline-block;flex-shrink:0}
.toast{position:fixed;bottom:24px;right:24px;padding:12px 18px;border-radius:10px;background:${C.card};border:1px solid ${C.border};font-size:14px;z-index:9999;animation:fadeIn .3s ease}
.toast-success{border-color:${C.green}50;color:${C.green}}.toast-error{border-color:${C.red}50;color:${C.red}}
table{width:100%;border-collapse:collapse}
th{text-align:left;font-size:11px;font-weight:600;color:${C.muted};text-transform:uppercase;letter-spacing:.06em;padding:10px 16px;border-bottom:1px solid ${C.border}}
td{padding:12px 16px;font-size:14px;border-bottom:1px solid ${C.border}20}
tr:hover td{background:${C.card}}
.progress-bar{height:5px;background:${C.border};border-radius:3px;overflow:hidden}
.progress-fill{height:100%;border-radius:3px;transition:width .6s ease}
.tabs{display:flex;gap:2px;background:${C.surface};padding:4px;border-radius:10px}
.tab{padding:8px 14px;border-radius:7px;cursor:pointer;font-size:13px;font-weight:500;color:${C.muted};transition:all .15s;border:none;background:transparent;font-family:'Space Grotesk',sans-serif}
.tab.active{background:${C.card};color:${C.text}}
.modal-overlay{position:fixed;inset:0;background:#000000a0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn .2s ease}
.modal{background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:28px;width:100%;max-width:640px;max-height:90vh;overflow-y:auto}
.nav-item{display:flex;align-items:center;gap:10px;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:500;color:${C.muted};transition:all .15s;border:none;background:transparent;font-family:'Space Grotesk',sans-serif;width:100%;text-align:left}
.nav-item:hover{background:${C.border}30;color:${C.text}}.nav-item.active{background:${C.accent}15;color:${C.accent}}
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const scoreColor = s => s >= 8 ? C.green : s >= 6 ? C.gold : s >= 4 ? C.orange : C.red;

function Avatar({ initials="?", size=36, color=C.accent }) {
  return (
    <div style={{width:size,height:size,borderRadius:"50%",background:`${color}25`,border:`1px solid ${color}40`,
      display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.33,fontWeight:600,color,flexShrink:0}}>
      {initials}
    </div>
  );
}

function Spinner() { return <span className="spinner"/>; }

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, []);
  return <div className={`toast toast-${type}`}>{msg}</div>;
}

function ScoreRing({ score }) {
  const color = scoreColor(score);
  return (
    <div style={{width:64,height:64,borderRadius:"50%",background:`conic-gradient(${color} ${score*36}deg, ${C.border} 0deg)`,padding:3,flexShrink:0}}>
      <div style={{width:"100%",height:"100%",borderRadius:"50%",background:C.card,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color}}>
        {score.toFixed(1)}
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, color=C.accent }) {
  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"18px 20px",flex:1,minWidth:130}}>
      <div style={{fontSize:12,color:C.muted,marginBottom:8}}>{label}</div>
      <div style={{fontSize:26,fontWeight:700,color,lineHeight:1}}>{value}</div>
      {sub && <div style={{fontSize:12,color:C.muted,marginTop:6}}>{sub}</div>}
    </div>
  );
}

function Sparkline({ data=[], color=C.accent }) {
  if (data.length < 2) return null;
  const min=Math.min(...data), max=Math.max(...data), range=max-min||1;
  const W=110, H=30;
  const pts = data.map((v,i) => `${(i/(data.length-1))*W},${H-((v-min)/range)*(H-4)-2}`).join(" ");
  return (
    <svg width={W} height={H}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={pts.split(" ").pop().split(",")[0]} cy={pts.split(" ").pop().split(",")[1]} r="3" fill={color}/>
    </svg>
  );
}

function LoadingBox({ text="Loading…" }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"40px 0",color:C.muted,fontSize:14}}>
      <Spinner/> {text}
    </div>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass,  setPass]  = useState("");
  const [err,   setErr]   = useState("");
  const [busy,  setBusy]  = useState(false);

  const demo = [
    { email:"admin@company.com", pass:"admin123", role:"admin" },
    { email:"dev@company.com",   pass:"dev123",   role:"developer" },
    { email:"lead@company.com",  pass:"lead123",  role:"lead" },
  ];

  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      const { token, user } = await api.login({ email, password:pass });
      localStorage.setItem("cr_token", token);
      onLogin(user);
    } catch(e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",
      background:`radial-gradient(ellipse at 30% 20%,${C.accent}12 0%,transparent 60%),radial-gradient(ellipse at 70% 80%,${C.purple}10 0%,transparent 60%),${C.bg}`,padding:20}}>
      <div className="fade-in" style={{width:"100%",maxWidth:400}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{width:52,height:52,borderRadius:14,background:`linear-gradient(135deg,${C.accent},${C.purple})`,
            display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",fontSize:22}}>⚡</div>
          <h1 style={{fontSize:24,fontWeight:700,marginBottom:4}}>CodeReview AI</h1>
          <p style={{fontSize:14,color:C.muted}}>Intelligent code review analytics platform</p>
        </div>

        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:28}}>
          {[["Email","email","you@company.com",email,setEmail],["Password","password","••••••••",pass,setPass]].map(([lbl,type,ph,val,set])=>(
            <div key={lbl} style={{marginBottom:16}}>
              <label style={{fontSize:11,color:C.muted,fontWeight:600,letterSpacing:".05em",textTransform:"uppercase",display:"block",marginBottom:6}}>{lbl}</label>
              <input className="input" type={type} placeholder={ph} value={val} onChange={e=>set(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}/>
            </div>
          ))}

          {err && <div style={{background:`${C.red}15`,border:`1px solid ${C.red}30`,borderRadius:8,padding:"10px 14px",fontSize:13,color:C.red,marginBottom:16}}>{err}</div>}

          <button className="btn btn-primary" style={{width:"100%",justifyContent:"center"}} onClick={submit} disabled={busy||!email||!pass}>
            {busy ? <><Spinner/> Signing in…</> : "Sign in"}
          </button>

          <div style={{marginTop:20,padding:14,background:C.surface,borderRadius:8}}>
            <div style={{fontSize:11,color:C.muted,fontWeight:600,marginBottom:8,textTransform:"uppercase",letterSpacing:".04em"}}>Demo accounts</div>
            {demo.map(d=>(
              <div key={d.email} style={{fontSize:12,color:C.dim,marginBottom:4,cursor:"pointer"}} onClick={()=>{setEmail(d.email);setPass(d.pass)}}>
                <span style={{color:C.accent}}>{d.email}</span> / {d.pass} <span style={{color:C.muted}}>({d.role})</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
function Sidebar({ page, setPage, user, onLogout }) {
  const nav = [
    {id:"dashboard",  icon:"▦", label:"Dashboard"},
    {id:"reviews",    icon:"◈", label:"Code Reviews"},
    {id:"new-review", icon:"＋", label:"New Review"},
    {id:"performance",icon:"◎", label:"Performance"},
    {id:"team",       icon:"◉", label:"Team"},
  ];
  return (
    <div style={{width:220,background:C.surface,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",
      padding:"20px 12px",position:"fixed",top:0,left:0,bottom:0,zIndex:100}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:28,paddingLeft:4}}>
        <div style={{width:30,height:30,borderRadius:8,background:`linear-gradient(135deg,${C.accent},${C.purple})`,
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>⚡</div>
        <div>
          <div style={{fontSize:13,fontWeight:700,lineHeight:1}}>CodeReview</div>
          <div style={{fontSize:10,color:C.muted,marginTop:2}}>AI Platform</div>
        </div>
      </div>

      <nav style={{flex:1}}>
        {nav.map(n=>(
          <button key={n.id} className={`nav-item ${page===n.id?"active":""}`} onClick={()=>setPage(n.id)}>
            <span style={{fontSize:14,width:18,textAlign:"center"}}>{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>

      <div style={{borderTop:`1px solid ${C.border}`,paddingTop:16}}>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 6px",marginBottom:8}}>
          <Avatar initials={user.avatar||"?"} size={32}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{user.name}</div>
            <div style={{fontSize:11,color:C.muted,textTransform:"capitalize"}}>{user.role}</div>
          </div>
        </div>
        <button className="btn btn-ghost" style={{width:"100%",justifyContent:"center",fontSize:13}} onClick={onLogout}>Sign out</button>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function DashboardPage() {
  const [data, setData] = useState(null);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    api.getDashboard().then(setData).catch(console.error);
    api.getReviews({ limit:6 }).then(setReviews).catch(console.error);
  }, []);

  if (!data) return <LoadingBox text="Loading dashboard…"/>;

  const { totals, byLanguage=[], teamSnapshot=[] } = data;

  return (
    <div className="fade-in">
      <div style={{marginBottom:28}}>
        <h2 style={{fontSize:22,fontWeight:700,marginBottom:4}}>Dashboard</h2>
        <p style={{fontSize:14,color:C.muted}}>Overview of code review activity and team performance</p>
      </div>

      <div style={{display:"flex",gap:12,marginBottom:24,flexWrap:"wrap"}}>
        <MetricCard label="Total Reviews"   value={totals.total_reviews}  sub="All time"         color={C.accent}/>
        <MetricCard label="Avg Score"       value={`${totals.avg_score}/10`} sub="Platform wide" color={scoreColor(parseFloat(totals.avg_score))}/>
        <MetricCard label="Critical Issues" value={totals.critical_count} sub="Need attention"   color={C.red}/>
        <MetricCard label="High Issues"     value={totals.high_count}     sub="Require review"   color={C.orange}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
          <div style={{fontSize:12,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:14}}>Recent Reviews</div>
          {reviews.length === 0 ? <div style={{color:C.muted,fontSize:13}}>No reviews yet</div> :
            reviews.map(r=>(
              <div key={r.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <Avatar initials={r.employee_avatar||"?"} size={30} color={C.purple}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.employee_name}</div>
                  <div style={{fontSize:11,color:C.muted}}>{r.language} · {new Date(r.created_at).toLocaleDateString()}</div>
                </div>
                <span style={{fontSize:14,fontWeight:700,color:scoreColor(parseFloat(r.severity_score))}}>{parseFloat(r.severity_score).toFixed(1)}</span>
              </div>
            ))
          }
        </div>

        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
          <div style={{fontSize:12,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:14}}>Score by Language</div>
          {byLanguage.map(l=>(
            <div key={l.language} style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:13}}>
                <span className="mono" style={{fontSize:12}}>{l.language}</span>
                <span style={{fontWeight:600,color:scoreColor(parseFloat(l.avg_score))}}>{parseFloat(l.avg_score).toFixed(1)}</span>
              </div>
              <div className="progress-bar"><div className="progress-fill" style={{width:`${parseFloat(l.avg_score)*10}%`,background:scoreColor(parseFloat(l.avg_score))}}/></div>
            </div>
          ))}
        </div>
      </div>

      {teamSnapshot.length > 0 && (
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
          <div style={{fontSize:12,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:14}}>Team Snapshot</div>
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            {teamSnapshot.map(emp=>{
              const latest = parseFloat(emp.latest_score)||0;
              const oldest = parseFloat(emp.oldest_score)||0;
              const trend  = latest - oldest;
              return (
                <div key={emp.id} style={{flex:1,minWidth:140,background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 16px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                    <Avatar initials={emp.avatar||"?"} size={28} color={C.purple}/>
                    <div>
                      <div style={{fontSize:12,fontWeight:600}}>{emp.name.split(" ")[0]}</div>
                      <div style={{fontSize:10,color:C.muted}}>{emp.role}</div>
                    </div>
                  </div>
                  <div style={{fontSize:22,fontWeight:700,color:latest?scoreColor(latest):C.muted}}>{latest?latest.toFixed(1):"—"}</div>
                  <div style={{fontSize:11,color:trend>0.3?C.green:trend<-0.3?C.red:C.muted,marginTop:2}}>
                    {trend>0.3?"↑ Improving":trend<-0.3?"↓ Declining":"→ Stable"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reviews ──────────────────────────────────────────────────────────────────
function ReviewsPage() {
  const [reviews,  setReviews]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState("all");
  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.getReviews().then(r=>{ setReviews(r); setLoading(false); }).catch(()=>setLoading(false));
  }, []);

  const filtered = reviews.filter(r => {
    const ms = filter==="all" || r.severity_label===filter;
    const mq = !search || r.employee_name?.toLowerCase().includes(search.toLowerCase()) || r.language?.toLowerCase().includes(search.toLowerCase());
    return ms && mq;
  });

  return (
    <div className="fade-in">
      <div style={{marginBottom:24}}>
        <h2 style={{fontSize:22,fontWeight:700,marginBottom:4}}>Code Reviews</h2>
        <p style={{fontSize:14,color:C.muted}}>All review records stored in your database</p>
      </div>

      <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
        <input className="input" style={{maxWidth:240,padding:"8px 12px"}} placeholder="Search name or language…" value={search} onChange={e=>setSearch(e.target.value)}/>
        <div className="tabs">
          {["all","critical","high","medium","low"].map(f=>(
            <button key={f} className={`tab ${filter===f?"active":""}`} onClick={()=>setFilter(f)}>
              {f[0].toUpperCase()+f.slice(1)}
            </button>
          ))}
        </div>
        <span style={{marginLeft:"auto",fontSize:13,color:C.muted}}>{filtered.length} reviews</span>
      </div>

      {loading ? <LoadingBox/> : (
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
          <table>
            <thead><tr>
              <th>Developer</th><th>Language</th><th>Date</th><th>Score</th><th>Severity</th><th>Issues</th><th>Confidence</th>
            </tr></thead>
            <tbody>
              {filtered.map(r=>(
                <tr key={r.id} style={{cursor:"pointer"}} onClick={()=>setSelected(r)}>
                  <td>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <Avatar initials={r.employee_avatar||"?"} size={28} color={C.purple}/>
                      <div>
                        <div style={{fontSize:13,fontWeight:500}}>{r.employee_name}</div>
                        <div style={{fontSize:11,color:C.muted}}>{r.dept}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="mono" style={{fontSize:12,color:C.accent}}>{r.language}</span></td>
                  <td style={{color:C.muted,fontSize:13}}>{new Date(r.created_at).toLocaleDateString()}</td>
                  <td><span style={{fontSize:15,fontWeight:700,color:scoreColor(parseFloat(r.severity_score))}}>{parseFloat(r.severity_score).toFixed(1)}</span></td>
                  <td><span className={`badge badge-${r.severity_label}`}>{r.severity_label}</span></td>
                  <td style={{color:C.muted,fontSize:13}}>{(r.issues||[]).length} found</td>
                  <td><span style={{fontSize:12,color:r.confidence==="High"?C.green:C.gold}}>{r.confidence}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length===0 && <div style={{textAlign:"center",padding:"40px 20px",color:C.muted,fontSize:14}}>No reviews match filters</div>}
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setSelected(null)}>
          <div className="modal">
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
              <ScoreRing score={parseFloat(selected.severity_score)}/>
              <div>
                <div style={{fontSize:16,fontWeight:700}}>{selected.employee_name}</div>
                <div style={{fontSize:13,color:C.muted}}>{selected.language} · {new Date(selected.created_at).toLocaleDateString()}</div>
                <span className={`badge badge-${selected.severity_label}`} style={{marginTop:4}}>{selected.severity_label}</span>
                <span style={{marginLeft:8,fontSize:12,color:C.muted}}>Confidence: {selected.confidence}</span>
              </div>
            </div>
            <div style={{fontSize:14,color:C.muted,lineHeight:1.7,marginBottom:20,background:C.surface,borderRadius:8,padding:"12px 14px",borderLeft:`3px solid ${C.accent}`}}>
              {selected.summary}
            </div>
            <div style={{display:"flex",gap:10,marginBottom:20}}>
              {[["Security",selected.security_count,C.red],["Performance",selected.performance_count,C.orange],["Quality",selected.quality_count,C.gold]].map(([l,v,col])=>(
                <div key={l} style={{flex:1,background:C.surface,borderRadius:8,padding:"12px 14px",textAlign:"center"}}>
                  <div style={{fontSize:22,fontWeight:700,color:col}}>{v||0}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:4}}>{l}</div>
                </div>
              ))}
            </div>
            {(selected.issues||[]).length>0 && (
              <div style={{marginBottom:20}}>
                <div style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>Issues Found</div>
                {(selected.issues||[]).map((iss,i)=>(
                  <div key={i} style={{display:"flex",gap:8,marginBottom:8}}>
                    <span style={{color:C.red,flexShrink:0,marginTop:2}}>●</span>
                    <span style={{fontSize:13}}>{iss}</span>
                  </div>
                ))}
              </div>
            )}
            <button className="btn btn-ghost" style={{width:"100%",justifyContent:"center"}} onClick={()=>setSelected(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── New Review ───────────────────────────────────────────────────────────────
function NewReviewPage({ showToast }) {
  const [employees, setEmployees] = useState([]);
  const [code,      setCode]      = useState("");
  const [empId,     setEmpId]     = useState("");
  const [language,  setLanguage]  = useState("Python");
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState(null);

  useEffect(() => { api.getEmployees().then(setEmployees).catch(console.error); }, []);

  const analyze = async () => {
    if (!code.trim() || !empId) return;
    setLoading(true); setResult(null);
    try {
      const data = await api.analyzeCode({ employee_id:empId, language, code_snippet:code, save:true });
      setResult(data);
      showToast("Review saved to database!", "success");
    } catch(e) {
      showToast("Analysis failed: " + e.message, "error");
    }
    setLoading(false);
  };

  const analysis = result?.analysis;
  const review   = result?.review;

  return (
    <div className="fade-in">
      <div style={{marginBottom:24}}>
        <h2 style={{fontSize:22,fontWeight:700,marginBottom:4}}>New Code Review</h2>
        <p style={{fontSize:14,color:C.muted}}>
          AI analyses your code server-side — results are saved directly to PostgreSQL
        </p>
      </div>

      {/* How it works banner */}
      <div style={{background:`${C.accent}10`,border:`1px solid ${C.accent}25`,borderRadius:10,padding:"12px 16px",marginBottom:20,fontSize:13,color:C.muted,lineHeight:1.7}}>
        <span style={{color:C.accent,fontWeight:600}}>How it works: </span>
        You select a developer, choose the language, and paste their code. Your Node.js backend sends it to{" "}
        <span style={{color:C.accent}}>AI Sonnet</span> with a structured prompt asking for a JSON report covering
        security, performance, quality and naming issues. AI returns scores (1–10) and categorised findings.
        The result is immediately saved to your Neon PostgreSQL and shown here.
      </div>

      <div style={{display:"grid",gridTemplateColumns:result?"1fr 1fr":"1fr",gap:20}}>
        <div>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20,marginBottom:16}}>
            <div style={{display:"flex",gap:12,marginBottom:16}}>
              <div style={{flex:1}}>
                <label style={{fontSize:11,color:C.muted,fontWeight:600,letterSpacing:".05em",textTransform:"uppercase",display:"block",marginBottom:6}}>Developer</label>
                <select className="select" style={{width:"100%"}} value={empId} onChange={e=>setEmpId(e.target.value)}>
                  <option value="">Select developer…</option>
                  {employees.filter(e=>e.role==="developer").map(e=>(
                    <option key={e.id} value={e.id}>{e.name} — {e.department}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{fontSize:11,color:C.muted,fontWeight:600,letterSpacing:".05em",textTransform:"uppercase",display:"block",marginBottom:6}}>Language</label>
                <select className="select" value={language} onChange={e=>setLanguage(e.target.value)}>
                  {["Python","TypeScript","JavaScript","Go","Java","Rust","C#","PHP"].map(l=><option key={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <label style={{fontSize:11,color:C.muted,fontWeight:600,letterSpacing:".05em",textTransform:"uppercase",display:"block",marginBottom:6}}>Code Snippet</label>
            <textarea className="textarea" style={{minHeight:300}} placeholder={`Paste ${language} code here…`}
              value={code} onChange={e=>setCode(e.target.value)}/>
          </div>

          <button className="btn btn-primary" style={{width:"100%",justifyContent:"center",padding:"13px"}}
            onClick={analyze} disabled={loading||!code.trim()||!empId}>
            {loading ? <><Spinner/> AI is analysing…</> : "⚡ Run AI Review"}
          </button>
        </div>

        {result && (
          <div className="slide-in">
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
              <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:18}}>
                {review && <ScoreRing score={parseFloat(review.severity_score)}/>}
                <div>
                  <div style={{fontSize:15,fontWeight:700}}>Review Complete — Saved to DB</div>
                  <div style={{fontSize:12,color:C.muted}}>
                    {employees.find(e=>e.id===empId)?.name} · {language}
                  </div>
                  {analysis && <span className={`badge badge-${analysis.severity_label}`} style={{marginTop:4}}>{analysis.severity_label}</span>}
                </div>
              </div>

              {analysis?.summary && (
                <div style={{fontSize:13,color:C.muted,lineHeight:1.7,background:C.surface,borderRadius:8,padding:"12px 14px",borderLeft:`3px solid ${C.accent}`,marginBottom:16}}>
                  {analysis.summary}
                </div>
              )}

              {[
                {label:"Security Issues",    items:analysis?.security_issues,    color:C.red},
                {label:"Performance Issues", items:analysis?.performance_issues, color:C.orange},
                {label:"Code Quality",       items:analysis?.code_quality,       color:C.gold},
                {label:"Naming & Design",    items:analysis?.naming_design,      color:C.purple},
              ].filter(s=>s.items?.length>0).map(s=>(
                <div key={s.label} style={{marginBottom:14}}>
                  <div style={{fontSize:11,fontWeight:600,color:s.color,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>{s.label}</div>
                  {s.items.map((item,i)=>(
                    <div key={i} style={{display:"flex",gap:8,marginBottom:6}}>
                      <span style={{color:s.color,flexShrink:0}}>●</span>
                      <span style={{fontSize:13,lineHeight:1.5}}>{item}</span>
                    </div>
                  ))}
                </div>
              ))}

              {analysis?.improved_snippet && (
                <div style={{marginTop:14}}>
                  <div style={{fontSize:11,fontWeight:600,color:C.green,textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>Suggested Fix</div>
                  <pre className="mono" style={{background:C.surface,borderRadius:8,padding:"10px 12px",fontSize:12,overflowX:"auto",color:C.green,whiteSpace:"pre-wrap",wordBreak:"break-all"}}>
                    {analysis.improved_snippet}
                  </pre>
                </div>
              )}

              <div style={{marginTop:16,padding:"10px 14px",background:C.surface,borderRadius:8,fontSize:12,color:C.muted,borderLeft:`3px solid ${C.green}`}}>
                ✓ Saved to <span className="mono" style={{color:C.accent}}>code_reviews</span> + <span className="mono" style={{color:C.accent}}>review_issues</span> tables
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Performance ──────────────────────────────────────────────────────────────
function PerformancePage() {
  const [employees, setEmployees] = useState([]);
  const [selected,  setSelected]  = useState(null);
  const [stats,     setStats]     = useState(null);
  const [loadingE,  setLoadingE]  = useState(true);
  const [loadingS,  setLoadingS]  = useState(false);

  useEffect(() => {
    api.getEmployees().then(emps => {
      const devs = emps.filter(e=>e.role==="developer");
      setEmployees(devs);
      if (devs.length) setSelected(devs[0].id);
      setLoadingE(false);
    }).catch(()=>setLoadingE(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoadingS(true);
    api.getEmpStats(selected).then(s=>{ setStats(s); setLoadingS(false); }).catch(()=>setLoadingS(false));
  }, [selected]);

  const emp        = employees.find(e=>e.id===selected);
  const trendData  = stats?.trend || [];
  const scores     = trendData.map(r=>parseFloat(r.severity_score));
  const avgScore   = stats?.summary?.avg_score || 0;
  const trend      = scores.length>1 ? scores[scores.length-1]-scores[0] : 0;

  const learning = trend>1 ? "Significantly improving" :
    trend>0.3  ? "Gradually improving" :
    trend<-1   ? "Performance declining" :
    trend<-0.3 ? "Slight regression" : "Consistent performance";

  // SVG chart
  const CW=420, CH=160, pL=32, pB=24, pR=10, pT=10;
  const iW=CW-pL-pR, iH=CH-pB-pT;
  const pts = scores.map((s,i)=>({
    x: pL+(i/Math.max(scores.length-1,1))*iW,
    y: pT+iH-(s/10)*iH,
    s,
    date: trendData[i]?.created_at,
  }));
  const polyline = pts.map(p=>`${p.x},${p.y}`).join(" ");
  const area     = pts.length>1 ? `${pts[0].x},${pT+iH} ${polyline} ${pts[pts.length-1].x},${pT+iH}` : "";

  return (
    <div className="fade-in">
      <div style={{marginBottom:24}}>
        <h2 style={{fontSize:22,fontWeight:700,marginBottom:4}}>Performance Analytics</h2>
        <p style={{fontSize:14,color:C.muted}}>Developer growth trends from your database</p>
      </div>

      {loadingE ? <LoadingBox/> : (
        <>
          <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
            {employees.map(e=>(
              <button key={e.id} onClick={()=>setSelected(e.id)} style={{
                display:"flex",alignItems:"center",gap:8,padding:"8px 14px",borderRadius:8,
                border:`1px solid ${selected===e.id?C.accent:C.border}`,
                background:selected===e.id?`${C.accent}15`:C.surface,
                color:selected===e.id?C.accent:C.muted,
                cursor:"pointer",fontSize:13,fontFamily:"Space Grotesk,sans-serif",transition:"all .15s",
              }}>
                <Avatar initials={e.avatar||"?"} size={22} color={selected===e.id?C.accent:C.purple}/>
                {e.name.split(" ")[0]}
              </button>
            ))}
          </div>

          {loadingS ? <LoadingBox text="Loading stats…"/> : stats && (
            <>
              <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
                <MetricCard label="Avg Score"     value={`${avgScore}/10`}              sub="All reviews"    color={scoreColor(parseFloat(avgScore))}/>
                <MetricCard label="Total Reviews" value={stats.summary?.total_reviews||0} sub="In database" color={C.accent}/>
                <MetricCard label="Security Issues" value={stats.summary?.total_security||0} sub="Cumulative" color={C.red}/>
                <MetricCard label="Trend"         value={`${trend>0.3?"↑":trend<-0.3?"↓":"→"} ${Math.abs(trend).toFixed(1)}`} sub={learning} color={trend>0.3?C.green:trend<-0.3?C.red:C.muted}/>
              </div>

              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20,marginBottom:16}}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
                  <Avatar initials={emp?.avatar||"?"} size={40} color={C.purple}/>
                  <div>
                    <div style={{fontSize:16,fontWeight:700}}>{emp?.name}</div>
                    <div style={{fontSize:13,color:C.muted}}>{emp?.job_title} · {emp?.department}</div>
                  </div>
                  <span style={{marginLeft:"auto",padding:"6px 14px",borderRadius:20,fontSize:13,fontWeight:600,
                    background:trend>0.3?`${C.green}15`:trend<-0.3?`${C.red}15`:`${C.muted}15`,
                    color:trend>0.3?C.green:trend<-0.3?C.red:C.muted,
                    border:`1px solid ${trend>0.3?C.green:trend<-0.3?C.red:C.muted}30`,
                  }}>{learning}</span>
                </div>

                <div style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:12}}>Score over time</div>
                {pts.length < 2 ? <div style={{color:C.muted,fontSize:13}}>Not enough data yet</div> : (
                  <svg width="100%" viewBox={`0 0 ${CW} ${CH}`} style={{overflow:"visible"}}>
                    {[2,4,6,8,10].map(v=>{
                      const y=pT+iH-(v/10)*iH;
                      return <g key={v}><line x1={pL} x2={CW-pR} y1={y} y2={y} stroke={C.border} strokeWidth={0.5}/>
                        <text x={pL-4} y={y+4} textAnchor="end" fontSize={10} fill={C.dim}>{v}</text></g>;
                    })}
                    <defs>
                      <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={scoreColor(parseFloat(avgScore))} stopOpacity="0.2"/>
                        <stop offset="100%" stopColor={scoreColor(parseFloat(avgScore))} stopOpacity="0.01"/>
                      </linearGradient>
                    </defs>
                    <polygon points={area} fill="url(#ag)"/>
                    <polyline points={polyline} fill="none" stroke={scoreColor(parseFloat(avgScore))} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                    {pts.map((p,i)=>(
                      <g key={i}><circle cx={p.x} cy={p.y} r={4} fill={scoreColor(p.s)}/>
                        <text x={p.x} y={CH-4} textAnchor="middle" fontSize={9} fill={C.dim}>
                          {p.date ? new Date(p.date).toLocaleDateString("en",{month:"short"}) : ""}
                        </text>
                      </g>
                    ))}
                  </svg>
                )}
              </div>

              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
                <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.border}`,fontSize:12,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:".06em"}}>
                  Review History
                </div>
                <table>
                  <thead><tr><th>Date</th><th>Language</th><th>Score</th><th>Severity</th></tr></thead>
                  <tbody>
                    {[...trendData].reverse().map((r,i)=>(
                      <tr key={i}>
                        <td style={{color:C.muted,fontSize:13}}>{new Date(r.created_at).toLocaleDateString()}</td>
                        <td><span className="mono" style={{fontSize:12,color:C.accent}}>{r.language}</span></td>
                        <td><span style={{fontSize:15,fontWeight:700,color:scoreColor(parseFloat(r.severity_score))}}>{parseFloat(r.severity_score).toFixed(1)}</span></td>
                        <td><span className={`badge badge-${r.severity_label}`}>{r.severity_label}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── Team ─────────────────────────────────────────────────────────────────────
function TeamPage() {
  const [employees, setEmployees] = useState([]);
  const [allStats,  setAllStats]  = useState({});
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    api.getEmployees().then(async emps => {
      setEmployees(emps);
      const statsMap = {};
      await Promise.all(
        emps.filter(e=>e.role==="developer").map(async e => {
          try { statsMap[e.id] = await api.getEmpStats(e.id); } catch {}
        })
      );
      setAllStats(statsMap);
      setLoading(false);
    }).catch(()=>setLoading(false));
  }, []);

  if (loading) return <LoadingBox text="Loading team…"/>;

  return (
    <div className="fade-in">
      <div style={{marginBottom:24}}>
        <h2 style={{fontSize:22,fontWeight:700,marginBottom:4}}>Team Overview</h2>
        <p style={{fontSize:14,color:C.muted}}>All developers and their live statistics from the database</p>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
        {employees.filter(e=>e.role==="developer").map(emp=>{
          const s     = allStats[emp.id];
          const trend = s?.trend||[];
          const scores= trend.map(r=>parseFloat(r.severity_score));
          const avg   = parseFloat(s?.summary?.avg_score||0);
          const diff  = scores.length>1 ? scores[scores.length-1]-scores[0] : 0;
          const latest= scores[scores.length-1]||0;

          return (
            <div key={emp.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:20}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
                <Avatar initials={emp.avatar||"?"} size={44} color={C.purple}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:15,fontWeight:700}}>{emp.name}</div>
                  <div style={{fontSize:12,color:C.muted}}>{emp.job_title} · {emp.department}</div>
                </div>
                {latest>0 && <ScoreRing score={latest}/>}
              </div>

              <div style={{display:"flex",gap:8,marginBottom:14}}>
                {[["Avg",avg?avg.toFixed(1):"—",scoreColor(avg)],["Reviews",s?.summary?.total_reviews||0,C.accent],["Security",s?.summary?.total_security||0,C.red]].map(([l,v,col])=>(
                  <div key={l} style={{flex:1,background:C.surface,borderRadius:8,padding:"10px 12px",textAlign:"center"}}>
                    <div style={{fontSize:16,fontWeight:700,color:col}}>{v}</div>
                    <div style={{fontSize:10,color:C.muted,marginTop:2}}>{l}</div>
                  </div>
                ))}
              </div>

              {[["Security",s?.summary?.total_security||0,C.red,6],["Performance",s?.summary?.total_performance||0,C.orange,6]].map(([l,v,col,max])=>(
                <div key={l} style={{marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3,fontSize:11}}>
                    <span style={{color:C.muted}}>{l} issues</span>
                    <span style={{color:col}}>{v}</span>
                  </div>
                  <div className="progress-bar"><div className="progress-fill" style={{width:`${Math.min(100,(v/max)*100)}%`,background:col}}/></div>
                </div>
              ))}

              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:10}}>
                <Sparkline data={scores} color={scoreColor(avg)}/>
                <span style={{fontSize:12,fontWeight:600,color:diff>0.3?C.green:diff<-0.3?C.red:C.muted}}>
                  {diff>0.3?"↑ Improving":diff<-0.3?"↓ Declining":"→ Stable"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user,  setUser]  = useState(null);
  const [page,  setPage]  = useState("dashboard");
  const [toast, setToast] = useState(null);
  const [booting, setBoot] = useState(true);

  // Restore session on load
  useEffect(() => {
    const token = localStorage.getItem("cr_token");
    if (!token) { setBoot(false); return; }
    api.me().then(u=>{ setUser(u); setBoot(false); }).catch(()=>{ localStorage.removeItem("cr_token"); setBoot(false); });
  }, []);

  const showToast = useCallback((msg,type="success")=>setToast({msg,type}), []);
  const logout    = ()=>{ localStorage.removeItem("cr_token"); setUser(null); setPage("dashboard"); };

  if (booting) return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",gap:12,color:C.muted,fontSize:14}}>
        <Spinner/> Loading…
      </div>
    </>
  );

  if (!user) return (
    <>
      <style>{GLOBAL_CSS}</style>
      <LoginPage onLogin={setUser}/>
    </>
  );

  const pages = {
    dashboard:  <DashboardPage/>,
    reviews:    <ReviewsPage/>,
    "new-review": <NewReviewPage showToast={showToast}/>,
    performance: <PerformancePage/>,
    team:        <TeamPage/>,
  };

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{display:"flex",minHeight:"100vh"}}>
        <Sidebar page={page} setPage={setPage} user={user} onLogout={logout}/>
        <main style={{flex:1,marginLeft:220,padding:"28px 32px",maxWidth:"calc(100vw - 220px)"}}>
          {pages[page] || pages.dashboard}
        </main>
      </div>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
    </>
  );
}
