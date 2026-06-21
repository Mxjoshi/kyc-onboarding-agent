"use client";

import { useEffect, useState } from "react";

type Doc = { type: string; icon: string; text: string };
type Customer = {
  id: string; name: string; nationality: string; dob: string; age: number;
  category: string; employment: string; emirates_id_masked: string;
  applied_for: string; intends: string; expected: string;
  screening: { sanctions_hit: boolean; pep_flag: boolean; risk_band: string };
  documents: Doc[];
};
type Citation = { claim: string; section: string };
type Decision = {
  recommendation: "proceed" | "request_documents" | "escalate";
  summary: string; key_points: string[];
  answer_text: string; citations: Citation[];
  missing_documents: string[]; escalation_reason: string;
  confidence: "high" | "medium" | "low";
};
type Check = { check_id: string; passed: boolean; reason: string };
type Eval = { per_check: Check[]; failed_checks: string[]; score: number; rca_tag: string; all_passed: boolean };
type SourcedCitation = Citation & { source_text?: string };
type Result = { case_id?: string; decision: Decision; citations?: SourcedCitation[]; retrieved_sections: string[]; eval: Eval; rubric: { id: string; question: string }[]; breakIt: boolean };
type Rec = {
  case_id: string; ts: string; customer: string; name: string; applied_for: string; intends: string;
  recommendation: Decision["recommendation"]; confidence: string; score: number; rca_tag: string; all_passed: boolean; breakIt: boolean;
  officer_status?: string; officer_ts?: string; officer_note?: string;
};

const ICON_COLOR: Record<string, string> = {
  passport: "#4f46e5", id: "#0d9488", visa: "#7c3aed", salary: "#16a34a", home: "#d97706", shield: "#2563eb",
};
const DocIcon = ({ name }: { name: string }) => {
  const color = ICON_COLOR[name] ?? "#475569";
  const p = { viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, width: 18, height: 18 };
  let svg;
  switch (name) {
    case "passport": svg = (<svg {...p}><rect x="5" y="3" width="14" height="18" rx="2" /><circle cx="12" cy="10" r="2.4" /><path d="M8.5 16c1-1.6 6-1.6 7 0" /></svg>); break;
    case "id": svg = (<svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="11" r="2" /><path d="M13 9.5h5M13 12.5h5M6.5 15h6" /></svg>); break;
    case "visa": svg = (<svg {...p}><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="10.5" r="3" /><path d="M9 16.5h6" /></svg>); break;
    case "salary": svg = (<svg {...p}><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 9.5v5M18 9.5v5" /></svg>); break;
    case "home": svg = (<svg {...p}><path d="M4 11l8-6 8 6" /><path d="M6 10v9h12v-9" /><path d="M10 19v-5h4v5" /></svg>); break;
    case "shield": svg = (<svg {...p}><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" /><path d="M9 11.5l2 2 4-4" /></svg>); break;
    default: svg = (<svg {...p}><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" /></svg>);
  }
  return <span className="doc-ico-wrap" style={{ background: color + "1a" }}>{svg}</span>;
};

const Info = ({ text }: { text: string }) => (<span className="info">i<span className="tip">{text}</span></span>);

const REC_LABEL: Record<string, string> = { proceed: "PROCEED", request_documents: "REQUEST DOCUMENTS", escalate: "ESCALATE" };
const REC_SUB: Record<string, string> = {
  proceed: "All checks satisfied. The customer can be onboarded.",
  request_documents: "Onboarding paused. One or more required documents are missing.",
  escalate: "Routed to a human officer. The assistant did not auto-decide.",
};
const Outcome = ({ r }: { r: string }) => {
  const m: Record<string, [string, string]> = { proceed: ["green", "Proceed"], request_documents: ["amber", "Request docs"], escalate: ["red", "Escalate"] };
  const [c, l] = m[r] ?? ["gray", r];
  return <span className={`chip ${c}`}>{l}</span>;
};
const fmt = (ts: string) => { try { return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return ts; } };

const STEPS = [
  { id: "retrieving", label: "Retrieving policy", sub: "finding the relevant KYC/AML sections by meaning" },
  { id: "deciding", label: "Deciding", sub: "Claude drafts a grounded recommendation and cites each rule" },
  { id: "grading", label: "Trust review", sub: "the judge grades the answer and tags any failure" },
];
const STEP_ORDER = ["retrieving", "deciding", "grading"];
function stepState(stage: string, id: string) {
  const cur = STEP_ORDER.indexOf(stage); const idx = STEP_ORDER.indexOf(id);
  return idx < cur ? "done" : idx === cur ? "active" : "pending";
}

const NAV = [
  { id: "dashboard", label: "Dashboard" },
  { id: "onboarding", label: "Onboarding" },
  { id: "review", label: "Review queue" },
  { id: "retrieval", label: "RAG search" },
  { id: "evals", label: "Evals" },
  { id: "audit", label: "Audit log" },
  { id: "report", label: "Report" },
];

// The pipeline map shown on the Dashboard. Click a step to read what it does.
const PIPELINE = [
  { icon: "📂", label: "Documents in", tech: "input", core: false,
    desc: "Two things go in: the customer's own files (passport, Emirates ID, visa, salary, tenancy) and the bank's KYC/AML policy. Everything here is synthetic." },
  { icon: "🔍", label: "Policy search", tech: "RAG · transformers.js", core: false, goto: "retrieval",
    desc: "Before deciding, the app finds the few policy sections that relate to this case by meaning, and gives the agent only those. Open the RAG search tab to watch this run." },
  { icon: "🤖", label: "Agent decides", tech: "Claude", core: true,
    desc: "Claude reads ONLY the retrieved sections plus the documents, then recommends proceed / request documents / escalate, citing the exact section for every claim. It refuses instead of guessing when the policy is silent." },
  { icon: "⚖️", label: "Trust judge", tech: "Claude", core: true, goto: "evals",
    desc: "A second, independent Claude call grades that answer against the 4-point rubric, scores it, and tags the root cause of any failure. This is the trust layer. Open the Evals tab to see it catch planted bad answers." },
  { icon: "📋", label: "Audit log", tech: "in-memory store", core: false, goto: "audit",
    desc: "Every decision (outcome, trust score, root-cause tag, officer action, time) is recorded. It powers the Dashboard, Review queue, Audit log and Report." },
  { icon: "🤝", label: "Handoff", tech: "→ capstone", core: false,
    desc: "The verified customer profile flows to the credit copilot (the capstone), which reads the economic fields as its Applicant and decides approve / decline / refer." },
];

export default function Home() {
  const [view, setView] = useState("dashboard");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [breakIt, setBreakIt] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [stage, setStage] = useState("");
  const [log, setLog] = useState<Rec[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [evals, setEvals] = useState<any>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [retr, setRetr] = useState<any>(null);
  const [retrLoading, setRetrLoading] = useState(false);
  const [retrCustomer, setRetrCustomer] = useState<string>("");
  const [mapStep, setMapStep] = useState(0);
  const [mapSel, setMapSel] = useState<any>(null);
  const [flt, setFlt] = useState({ outcome: "all", status: "all", mode: "all", q: "" });

  useEffect(() => {
    fetch("/api/customers").then((r) => r.json()).then((d) => {
      setCustomers(d.customers);
      if (d.customers?.length) { setSelected(d.customers[0].id); setRetrCustomer(d.customers[0].id); }
    });
    fetchLog();
  }, []);
  useEffect(() => { if (["dashboard", "review", "audit", "report"].includes(view)) fetchLog(); }, [view]);

  async function fetchLog() { try { const d = await fetch("/api/log").then((r) => r.json()); setLog(d.records || []); } catch {} }
  async function act(case_id: string, status: string) {
    try {
      const note = notes[case_id] || "";
      const d = await fetch("/api/review-action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ case_id, status, note }) }).then((r) => r.json());
      if (d.records) setLog(d.records);
      setNotes((n) => { const m = { ...n }; delete m[case_id]; return m; });
    } catch {}
  }
  async function reopen(case_id: string) {
    try { const d = await fetch("/api/review-action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ case_id, status: "Reopen" }) }).then((r) => r.json()); if (d.records) setLog(d.records); } catch {}
  }
  async function runDiscrimination() {
    setEvalLoading(true);
    try { const d = await fetch("/api/discrimination", { method: "POST" }).then((r) => r.json()); setEvals(d); }
    catch {} finally { setEvalLoading(false); }
  }
  async function runRetrieval() {
    const id = retrCustomer || customers[0]?.id;
    if (!id) return;
    setRetrLoading(true); setRetr(null); setMapSel(null);
    try { const d = await fetch("/api/retrieval", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customer: id }) }).then((r) => r.json()); setRetr(d); }
    catch {} finally { setRetrLoading(false); }
  }
  async function clearLog() {
    try { const d = await fetch("/api/log", { method: "DELETE" }).then((r) => r.json()); setLog(d.records || []); } catch {}
  }
  const cust = customers.find((c) => c.id === selected);
  function pick(id: string) { setSelected(id); setResult(null); setError(""); }
  function goOnboard(id: string) { setSelected(id); setResult(null); setError(""); setView("onboarding"); }

  async function run() {
    setLoading(true); setError(""); setResult(null); setStage("retrieving");
    try {
      const res = await fetch("/api/onboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customer: selected, breakIt }) });
      if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`);
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true }); const lines = buf.split("\n"); buf = lines.pop() ?? "";
        for (const line of lines) { const t = line.trim(); if (!t) continue; const msg = JSON.parse(t);
          if (msg.step === "done") setResult(msg.result); else if (msg.step === "error") setError(msg.error); else setStage(msg.step); }
      }
      fetchLog();
    } catch (e: any) { setError(e.message || "Something went wrong"); }
    finally { setLoading(false); setStage(""); }
  }

  // stats
  const total = log.length;
  const cnt = (r: string) => log.filter((x) => x.recommendation === r).length;
  const proceed = cnt("proceed"), reqdocs = cnt("request_documents"), esc = cnt("escalate");
  const avg = total ? Math.round((log.reduce((s, x) => s + x.score, 0) / total) * 100) : 0;
  const reviewItems = log.filter((x) => x.recommendation !== "proceed" && !x.officer_status);
  const resolvedItems = log.filter((x) => x.officer_status);

  // Report filtering
  const filtered = log.filter((r) => {
    if (flt.outcome !== "all" && r.recommendation !== flt.outcome) return false;
    if (flt.status === "pending" && r.officer_status) return false;
    if (flt.status === "actioned" && !r.officer_status) return false;
    if (flt.mode === "normal" && r.breakIt) return false;
    if (flt.mode === "breakit" && !r.breakIt) return false;
    if (flt.q && !`${r.name} ${r.case_id} ${r.applied_for}`.toLowerCase().includes(flt.q.toLowerCase())) return false;
    return true;
  });
  const ftot = filtered.length;
  const fcnt = (x: string) => filtered.filter((r) => r.recommendation === x).length;
  const favg = ftot ? Math.round((filtered.reduce((s, r) => s + r.score, 0) / ftot) * 100) : 0;
  const fhuman = filtered.filter((r) => r.recommendation !== "proceed").length;

  function downloadCSV() {
    const headers = ["case_id", "time", "applicant", "opening", "intends", "outcome", "trust_score", "rca", "mode", "officer_action", "officer_note"];
    const rows = filtered.map((r) => [r.case_id, new Date(r.ts).toISOString(), r.name, r.applied_for, r.intends, r.recommendation, Math.round(r.score * 100) + "%", r.rca_tag, r.breakIt ? "break-it" : "normal", r.officer_status || "", (r.officer_note || "")]);
    const csv = [headers, ...rows].map((line) => line.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" }); const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "acme-onboarding-report.csv"; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div><div className="brand-name">Acme Bank UAE</div><div className="brand-sub">Onboarding &amp; Compliance Console</div></div>
        </div>
        <div className="topbar-right">
          <span className="env-badge">Synthetic / Demo</span>
          <div className="officer"><b>R. Al Mansoori</b><br />Onboarding Officer</div>
        </div>
      </header>

      <nav className="nav">
        {NAV.map((n) => (
          <button key={n.id} className={`nav-item${view === n.id ? " active" : ""}`} onClick={() => setView(n.id)}>
            {n.label}
            {n.id === "review" && reviewItems.length > 0 && <span className="nav-badge">{reviewItems.length}</span>}
          </button>
        ))}
      </nav>

      {/* ===================== DASHBOARD ===================== */}
      {view === "dashboard" && (
        <div className="page">
          <div className="panel hero">
            <div className="hero-main">
              <h2 className="panel-title" style={{ fontSize: 22 }}>Trustworthy KYC &amp; AML onboarding</h2>
              <p className="hero-text">
                Reviews a new customer against the bank&apos;s KYC/AML policy and returns a cited decision you
                can defend. The assistant refuses when the policy is silent, escalates risk to a human, and a
                built-in trust layer grades every answer.
              </p>
            </div>
            <div className="hero-tags">
              <span className="hero-tag">Grounded in policy</span>
              <span className="hero-tag">Every decision cited</span>
              <span className="hero-tag">Refuses when unsure</span>
              <span className="hero-tag">Escalates to a human</span>
              <span className="hero-tag">Self-graded trust layer</span>
            </div>
          </div>

          <div className="panel">
            <div className="panel-h">How it works &middot; the pipeline map<Info text="Click any step to read what it does. Steps in green are the trust layer - the part that makes the answer defensible." /></div>
            <div className="pmap">
              {PIPELINE.map((s, i) => (
                <div key={i} className="pmap-cell">
                  <button className={`pmap-step${i === mapStep ? " active" : ""}${s.core ? " core" : ""}`} onClick={() => setMapStep(i)}>
                    <span className="pmap-ic">{s.icon}</span>
                    <span className="pmap-lb">{s.label}</span>
                    <span className="pmap-tc">{s.tech}</span>
                  </button>
                  {i < PIPELINE.length - 1 && <span className="pmap-arrow">→</span>}
                </div>
              ))}
            </div>
            <div className="pmap-detail">
              <p><b>{PIPELINE[mapStep].icon} {PIPELINE[mapStep].label}.</b> {PIPELINE[mapStep].desc}</p>
              {PIPELINE[mapStep].goto && (
                <button className="btn-ghost" onClick={() => setView(PIPELINE[mapStep].goto as string)}>Open this step →</button>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-h">How to use this console</div>
            <ol className="howto">
              <li><b>Open Onboarding</b> and pick an applicant from the queue.</li>
              <li>Review their <b>profile and submitted documents</b> on screen.</li>
              <li>Click <b>Run KYC / AML check</b>. Watch it retrieve policy, decide, and self-grade.</li>
              <li>Read the <b>decision</b> (proceed / request documents / escalate) with cited reasons. Click a citation to read the exact rule.</li>
              <li>Anything escalated or paused appears in the <b>Review queue</b> for an officer.</li>
              <li>Every decision is recorded in the <b>Audit log</b>; the <b>Report</b> shows alignment with CBUAE expectations.</li>
              <li>Tip: turn on <b>Break it</b> before running to inject bad retrieval and watch the trust scoreboard catch the failure.</li>
            </ol>
          </div>

          <div className="stats">
            <div className="stat"><div className="stat-n">{total}</div><div className="stat-l">Checks run</div></div>
            <div className="stat"><div className="stat-n" style={{ color: "var(--green)" }}>{proceed}</div><div className="stat-l">Proceeded</div></div>
            <div className="stat"><div className="stat-n" style={{ color: "var(--amber)" }}>{reqdocs}</div><div className="stat-l">Awaiting documents</div></div>
            <div className="stat"><div className="stat-n" style={{ color: "var(--red)" }}>{esc}</div><div className="stat-l">Escalated to human</div></div>
            <div className="stat"><div className="stat-n">{total ? avg + "%" : "-"}</div><div className="stat-l">Avg trust score</div></div>
          </div>

          <div className="panel">
            <div className="panel-h">Recent activity</div>
            {total === 0 && <p className="check-reason">No checks run yet. Go to <b>Onboarding</b> and run one.</p>}
            {log.slice(0, 6).map((r) => (
              <div key={r.case_id} className="logrow">
                <span className="mono">{r.case_id}</span>
                <span style={{ flex: 1 }}>{r.name} &middot; {r.applied_for}</span>
                <Outcome r={r.recommendation} />
                <span className="chip gray">{Math.round(r.score * 100)}%</span>
                <span className="muted-sm">{fmt(r.ts)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================== ONBOARDING CONSOLE ===================== */}
      {view === "onboarding" && (
        <div className="layout3">
          <aside>
            <div className="queue-h">Onboarding queue</div>
            {customers.map((c) => (
              <button key={c.id} className={`queue-item${selected === c.id ? " active" : ""}`} onClick={() => pick(c.id)}>
                <div className="queue-name">{c.name}</div>
                <div className="queue-meta">{c.applied_for} &middot; {c.documents.length - 1} docs</div>
              </button>
            ))}
            <div className="side-card">
              <div className="queue-h" style={{ marginTop: 0 }}>What the outcomes mean</div>
              <div className="legend-row"><span className="legend-dot green" /> Proceed &middot; all checks pass</div>
              <div className="legend-row"><span className="legend-dot amber" /> Request documents &middot; something missing</div>
              <div className="legend-row"><span className="legend-dot red" /> Escalate &middot; risk, goes to a human</div>
              <div className="side-tip">Tip: run a check, then turn on <b>Break it</b> to watch the trust scoreboard catch a failure.</div>
            </div>
          </aside>

          <section className="col-evidence">
            {!cust && <div className="panel">Loading cases...</div>}
            {cust && (
              <>
                <section className="panel">
                  <div className="profile-top">
                    <div className="avatar">{cust.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</div>
                    <div>
                      <h2 className="panel-title">{cust.name}</h2>
                      <div className="brand-sub" style={{ color: "var(--muted)" }}>Applicant file &middot; opening a {cust.applied_for.toLowerCase()}</div>
                    </div>
                  </div>
                  <div className="profile-grid">
                    <div className="kv"><div className="k">Nationality</div><div className="v">{cust.nationality}</div></div>
                    <div className="kv"><div className="k">Date of birth</div><div className="v">{cust.dob}</div></div>
                    <div className="kv"><div className="k">Age</div><div className="v">{cust.age}</div></div>
                    <div className="kv"><div className="k">Category</div><div className="v">{cust.category}</div></div>
                    <div className="kv"><div className="k">Employment</div><div className="v">{cust.employment}</div></div>
                    <div className="kv"><div className="k">Emirates ID</div><div className="v">{cust.emirates_id_masked}</div></div>
                    <div className="kv"><div className="k">Opening</div><div className="v">{cust.applied_for}</div></div>
                    <div className="kv"><div className="k">Intends to apply for<Info text="The credit product the customer plans to apply for after onboarding. That decision is made by the Newcomer Credit Decisioning Copilot (the capstone) using the verified profile produced here." /></div><div className="v">{cust.intends} <span className="chip gray" style={{ fontSize: 10 }}>&rarr; credit copilot</span></div></div>
                    <div className="kv"><div className="k">Sanctions screening<Info text="Checks the applicant's name against official banned-persons lists (UN, US, EU, UAE). A match means high risk and must go to a human, never auto-onboarded." /></div><div className="v">{cust.screening.sanctions_hit ? <span className="chip red">MATCH</span> : <span className="chip green">Clear</span>}</div></div>
                    <div className="kv"><div className="k">PEP<Info text="Politically Exposed Person: holds or recently held a prominent public role (or is close to one). Higher bribery/corruption risk, so it needs extra scrutiny and a human review before onboarding." /></div><div className="v">{cust.screening.pep_flag ? <span className="chip red">Yes</span> : <span className="chip green">No</span>}</div></div>
                    <div className="kv"><div className="k">Indicative risk<Info text="Overall AML risk rating. Low = onboard normally; Medium = onboard with enhanced monitoring; High = escalate to a human officer." /></div><div className="v" style={{ textTransform: "capitalize" }}>{cust.screening.risk_band}</div></div>
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-h">Compliance check<Info text="On run: the assistant retrieves the relevant policy sections, decides proceed / request documents / escalate from those sections only, cites each claim, refuses when the policy is silent, and escalates risky cases. The trust layer then grades the result." /></div>
                  <div className="runbar">
                    <button className="btn-primary" onClick={run} disabled={loading}>{loading ? "Running check..." : "Run KYC / AML check"}</button>
                    <label className="toggle"><input type="checkbox" checked={breakIt} onChange={(e) => setBreakIt(e.target.checked)} /><span>Break it &middot; test the trust layer</span></label>
                  </div>
                  {error && <p style={{ color: "var(--red)", marginTop: 12 }}>{error}</p>}
                </section>

                <section className="panel">
                  <div className="panel-h">Submitted documents</div>
                  <div className="docs-grid">
                    {cust.documents.map((d, i) => {
                      const isScreen = d.type === "Screening result";
                      const flagged = isScreen && (cust.screening.sanctions_hit || cust.screening.pep_flag);
                      return (
                        <div key={i} className="doc-card">
                          <div className="doc-head"><DocIcon name={d.icon} />{d.type}
                            {isScreen ? (flagged ? <span className="doc-flag">REVIEW</span> : <span className="doc-verified">CLEAR</span>) : <span className="doc-verified">RECEIVED</span>}
                          </div>
                          <pre className="doc-body">{d.text}</pre>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </>
            )}
          </section>

          <section className="col-verdict">
            {!result && !loading && (
              <div className="panel placeholder">
                <div className="placeholder-ico">&#9878;</div>
                <div className="panel-title" style={{ marginBottom: 6 }}>Decision &amp; trust scoreboard</div>
                <p className="check-reason">Pick a customer and run the check. The cited recommendation and the trust scoreboard (with score and root-cause tag) appear here, beside the documents.</p>
              </div>
            )}
            {loading && (
              <div className="panel">
                <div className="panel-h">Running compliance check</div>
                <ol className="steps">
                  {STEPS.map((s) => { const st = stepState(stage, s.id); return (
                    <li key={s.id} className={`step ${st}`}>
                      <span className="step-ico">{st === "done" ? "✓" : st === "active" ? <span className="spin" /> : ""}</span>
                      <div><div className="step-label">{s.label}</div><div className="step-sub">{s.sub}</div></div>
                    </li>); })}
                </ol>
                <p className="spinner" style={{ marginTop: 6 }}>First run also loads the local embedding model, so it may take a few extra seconds.</p>
              </div>
            )}
            {result && (
              <>
                <section className="panel">
                  <div className="panel-h">Decision {result.case_id && <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400, color: "var(--muted)" }}>&middot; {result.case_id}</span>}</div>
                  <div className={`banner ${result.decision.recommendation}`}>
                    <div className="banner-rec">{REC_LABEL[result.decision.recommendation]}</div>
                    <div className="banner-sub">{REC_SUB[result.decision.recommendation]}</div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <span className="chip gray">confidence: {result.decision.confidence}</span>
                    {result.breakIt && <span className="chip red" style={{ marginLeft: 8 }}>BREAK-IT MODE</span>}
                  </div>
                  <p className="summary">{result.decision.summary}</p>
                  <ul className="keypoints">{result.decision.key_points.map((k, i) => <li key={i}>{k}</li>)}</ul>
                  {result.decision.missing_documents.length > 0 && (<div className="callout"><b>Missing documents:</b> {result.decision.missing_documents.join(", ")}</div>)}
                  {result.decision.escalation_reason && (<div className="callout"><b>Escalation reason:</b> {result.decision.escalation_reason}</div>)}
                  <details className="reasoning"><summary>Full reasoning</summary><p className="answer">{result.decision.answer_text}</p></details>
                  <div className="panel-h" style={{ marginTop: 14 }}>Citations <span style={{ textTransform: "none", fontWeight: 400, letterSpacing: 0, color: "var(--muted)" }}>&middot; click a section to read the rule</span></div>
                  {(result.citations ?? result.decision.citations).map((c, i) => (
                    <details key={i} className="cite"><summary><span className="cite-sec">[{c.section}]</span> {c.claim}</summary>
                      <pre className="cite-src">{(c as SourcedCitation).source_text ?? "Rule text not found for this section."}</pre>
                    </details>
                  ))}
                </section>

                <section className="panel scoreboard">
                  <div className="panel-h">Trust scoreboard &middot; the judge graded this answer<Info text="The answer takes a 4-question test (the rubric checks below). The score is how many it passed: 4 of 4 = 100%, 3 = 75%, 2 = 50%. For a real decision you want 100%." /></div>
                  <div className="score-line">
                    <span className="score-big" style={{ color: result.eval.all_passed ? "var(--green)" : "var(--red)" }}>{(result.eval.score * 100).toFixed(0)}%</span>
                    <span className="muted-sm">{result.eval.per_check.filter((c) => c.passed).length} of {result.eval.per_check.length} checks passed</span>
                    {result.eval.all_passed ? <span className="chip green">all checks passed</span> : <span className="chip amber">RCA: {result.eval.rca_tag}</span>}
                  </div>
                  {result.rubric.map((r) => { const chk = result.eval.per_check.find((c) => c.check_id === r.id); const passed = chk?.passed; return (
                    <div key={r.id} className="check-row"><div className="check-main"><div className="check-id">{r.id}</div><div className="check-reason">{chk?.reason}</div></div>
                      <span className={`badge ${passed ? "pass" : "fail"}`}>{passed ? "PASS" : "FAIL"}</span></div>); })}
                  <p className="check-reason" style={{ marginTop: 12 }}>Policy sections the agent used: {result.retrieved_sections.join(", ")}</p>
                </section>
              </>
            )}
          </section>
        </div>
      )}

      {/* ===================== REVIEW QUEUE ===================== */}
      {view === "review" && (
        <div className="page">
          <div className="panel">
            <div className="panel-h">Review queue &middot; cases needing a human</div>
            <p className="check-reason" style={{ marginTop: 0 }}>The AI never auto-approves these. As the officer, you make the final call. Your decision is recorded in the audit log.</p>
            {reviewItems.length === 0 && <p className="check-reason">Nothing waiting. Run some checks in Onboarding (escalations and document requests land here).</p>}
            {reviewItems.map((r) => (
              <div key={r.case_id} className="review-row">
                <div className="review-info">
                  <div style={{ fontWeight: 600 }}>{r.name} <span className="muted-sm">&middot; {r.case_id}</span></div>
                  <div className="muted-sm">{r.applied_for} &middot; intends: {r.intends} &middot; {fmt(r.ts)}</div>
                  <div style={{ marginTop: 6 }}><Outcome r={r.recommendation} /> <span className="chip gray">trust {Math.round(r.score * 100)}%</span></div>
                </div>
                <input className="note-input" placeholder="Add a note for the audit log (optional)"
                  value={notes[r.case_id] || ""} onChange={(e) => setNotes((n) => ({ ...n, [r.case_id]: e.target.value }))} />
                <div className="review-actions">
                  <button className="act act-approve" onClick={() => act(r.case_id, "Approved & onboarded")}>Approve &amp; onboard</button>
                  {r.recommendation === "request_documents" && <button className="act act-request" onClick={() => act(r.case_id, "Documents requested")}>Request documents</button>}
                  <button className="act act-decline" onClick={() => act(r.case_id, "Declined")}>Decline</button>
                  <button className="act act-open" onClick={() => goOnboard(r.customer)}>Open file</button>
                </div>
              </div>
            ))}
          </div>

          {resolvedItems.length > 0 && (
            <div className="panel">
              <div className="panel-h">Recently actioned</div>
              {resolvedItems.map((r) => (
                <div key={r.case_id} className="logrow">
                  <span className="mono">{r.case_id}</span>
                  <div style={{ flex: 1 }}>
                    <div>{r.name} &middot; {r.applied_for}</div>
                    {r.officer_note && <div className="muted-sm">&ldquo;{r.officer_note}&rdquo;</div>}
                  </div>
                  <Outcome r={r.recommendation} />
                  <span className="chip green">{r.officer_status}</span>
                  <span className="muted-sm">{fmt(r.officer_ts || r.ts)}</span>
                  <button className="act act-open" onClick={() => reopen(r.case_id)}>Clear</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================== EVALS ===================== */}
      {view === "retrieval" && (
        <div className="page">
          <div className="panel">
            <div className="panel-h">Policy search (RAG) - the step before the agent decides</div>
            <div className="rmap">
              {[
                { ic: "📋", lb: "Case → query", tc: "the customer's facts" },
                { ic: "🔢", lb: "Turn to numbers", tc: "embeddings · transformers.js" },
                { ic: "📐", lb: "Compare by meaning", tc: "cosine similarity" },
                { ic: "✅", lb: "Keep top 7", tc: "drop the rest", core: true },
                { ic: "🤖", lb: "Send to agent", tc: "only these rules", core: true },
              ].map((s, i, a) => (
                <div key={i} className="rmap-cell">
                  <div className={`rmap-step${s.core ? " core" : ""}`}>
                    <span className="rmap-ic">{s.ic}</span>
                    <span className="rmap-lb">{s.lb}</span>
                    <span className="rmap-tc">{s.tc}</span>
                  </div>
                  {i < a.length - 1 && <span className="rmap-arrow">→</span>}
                </div>
              ))}
            </div>
            <p className="check-reason" style={{ marginBottom: 12 }}>Pick a customer and run the search to see which policy sections the agent is given for that case.</p>
            <details className="ragabout">
              <summary>New to RAG? What this is and how to read it</summary>
              <table className="audit rubric-table" style={{ marginTop: 10 }}>
                <tbody>
                  <tr><td><b>What this is</b></td><td>RAG = retrieval-augmented generation. Before the AI decides, we FIND the few policy sections that actually relate to the case and give it ONLY those. The AI never answers from memory.</td></tr>
                  <tr><td><b>Why it matters</b></td><td>Grounding every answer in retrieved policy is what makes citations possible and stops the AI inventing rules. Good decisions start with good retrieval.</td></tr>
                  <tr><td><b>How it works</b></td><td>Each policy section and the case are turned into &quot;meaning-numbers&quot; (embeddings) by a small model running locally (transformers.js). We score every section by closeness in meaning (cosine similarity) and keep the top {retr?.top_k ?? 7}.</td></tr>
                  <tr><td><b>How to read it</b></td><td>Higher score = closer in meaning. The green &quot;used&quot; rows are sent to the agent; the grey ones are dropped. (In Onboarding, &quot;Break it&quot; deliberately feeds the agent the dropped rows instead - bad retrieval - so you can watch the trust layer catch the failure.)</td></tr>
                </tbody>
              </table>
            </details>
            <div className="run-row" style={{ marginTop: 14 }}>
              <label className="run-label">Customer&nbsp;
                <select value={retrCustomer} onChange={(e) => { setRetrCustomer(e.target.value); setRetr(null); }}>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <button className="btn-primary" onClick={runRetrieval} disabled={retrLoading}>
                {retrLoading ? "Searching the policy..." : "Run policy search"}
              </button>
            </div>
          </div>

          {retr && (
            <div className="panel">
              <div className="panel-h">Similarity map &middot; {retr.name} &middot; sections inside the green ring were kept</div>
              <div className="simmap-wrap">
                <div className="simmap">
                  {(() => {
                    const cx = 175, cy = 165, minR = 40, maxR = 140;
                    const secs = retr.sections;
                    const scores = secs.map((s: any) => s.score);
                    const max = Math.max(...scores), min = Math.min(...scores);
                    const pts = secs.map((s: any, i: number) => {
                      const norm = max === min ? 0.5 : (s.score - min) / (max - min); // 1 = closest
                      const r = minR + (1 - norm) * (maxR - minR);
                      const ang = i * (2 * Math.PI / secs.length) - Math.PI / 2;
                      const num = (String(s.section).match(/\d+/) || ["?"])[0];
                      return { r, x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang), num, ...s };
                    });
                    // cut-off ring sits between the last kept section and the first dropped one.
                    const k = retr.top_k;
                    const cutoffR = (k < pts.length) ? (pts[k - 1].r + pts[k].r) / 2 : maxR + 10;
                    return (
                      <svg viewBox="0 0 350 340" role="img" aria-label="similarity map">
                        {/* kept zone */}
                        <circle cx={cx} cy={cy} r={cutoffR} fill="var(--green)" opacity={0.08} />
                        <circle cx={cx} cy={cy} r={cutoffR} fill="none" stroke="var(--green)" strokeWidth={1.5} strokeDasharray="5 4" />
                        <text x={cx} y={cy - cutoffR - 7} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--green)">cut-off: top {k} kept</text>
                        {/* spokes to kept dots */}
                        {pts.filter((p: any) => p.used).map((p: any, i: number) => (
                          <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--green)" strokeWidth={1} opacity={0.3} />
                        ))}
                        {/* dots */}
                        {pts.map((p: any, i: number) => (
                          <g key={i} style={{ cursor: "pointer" }} onClick={() => setMapSel(p)}>
                            {mapSel && mapSel.section === p.section && <circle cx={p.x} cy={p.y} r={p.used ? 14 : 12} fill="none" stroke="var(--brand)" strokeWidth={2} />}
                            <circle cx={p.x} cy={p.y} r={p.used ? 11 : 9} fill={p.used ? "var(--green)" : "var(--muted)"} opacity={p.used ? 1 : 0.5} />
                            <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" style={{ pointerEvents: "none" }}>{p.num}</text>
                            <title>{p.section} - similarity {p.score.toFixed(3)} ({p.used ? "kept" : "dropped"})</title>
                          </g>
                        ))}
                        {/* the case at the centre */}
                        <circle cx={cx} cy={cy} r={15} fill="#0b2545" />
                        <text x={cx} y={cy + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#f6c453">case</text>
                      </svg>
                    );
                  })()}
                </div>
                {/* the key: which number is which section */}
                <div className="simmap-key">
                  <div className="simmap-key-h">What each number is (click a row or dot)</div>
                  {retr.sections.map((s: any) => {
                    const num = (String(s.section).match(/\d+/) || ["?"])[0];
                    const name = String(s.section).replace(/^Section\s*\d+\.?\s*/i, "");
                    const on = mapSel && mapSel.section === s.section;
                    return (
                      <button key={s.rank} className={`simmap-key-row${on ? " on" : ""}`} onClick={() => setMapSel({ ...s, num })}>
                        <span className="simmap-num" style={{ background: s.used ? "var(--green)" : "var(--muted)" }}>{num}</span>
                        <span className="simmap-nm">{name}</span>
                        <span className="simmap-sc">{s.score.toFixed(3)}</span>
                        <span className={`chip ${s.used ? "green" : "gray"}`} style={{ fontSize: 10 }}>{s.used ? "kept" : "dropped"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {mapSel ? (
                <div className="cite" style={{ marginTop: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <b>{mapSel.section}</b>
                    <span className="muted-sm">similarity {mapSel.score.toFixed(3)}</span>
                    <span className={`chip ${mapSel.used ? "green" : "gray"}`}>{mapSel.used ? "kept" : "dropped"}</span>
                  </div>
                  {mapSel.shared_terms && mapSel.shared_terms.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <span className="muted-sm">Words it shares with the case: </span>
                      {mapSel.shared_terms.map((t: string) => <span key={t} className="term-chip">{t}</span>)}
                    </div>
                  )}
                  <p className="muted-sm" style={{ margin: "0 0 8px" }}>These shared words are only a hint. The ranking is really by <b>meaning</b> (embeddings), so a section can match even with no word in common (e.g. &quot;salary&quot; matches &quot;income&quot;).</p>
                  <pre className="cite-src" style={{ whiteSpace: "pre-wrap" }}>{mapSel.text}</pre>
                </div>
              ) : (
                <p className="check-reason" style={{ marginTop: 12 }}>How to read it: the <b>navy dot is the case</b>. Every other dot is a policy section, placed by how close it is in meaning - <b>closer to the centre = more relevant</b>. Sections inside the dashed green ring (the top {retr.top_k}) are kept and sent to the agent; the rest are dropped. <b>Click any dot or row to read that section&apos;s full rule.</b></p>
              )}
            </div>
          )}

          {retr && (
            <div className="panel">
              <div className="panel-h">The same result as a table</div>
              <p className="check-reason" style={{ marginBottom: 6 }}>The case was turned into this search query, then matched against all {retr.total} policy sections:</p>
              <pre className="cite-src" style={{ whiteSpace: "pre-wrap", marginBottom: 14 }}>{retr.query}</pre>
              <table className="audit">
                <thead><tr><th>#</th><th>Policy section</th><th>Match (similarity)</th><th>Sent to agent?</th></tr></thead>
                <tbody>
                  {retr.sections.map((s: any) => (
                    <tr key={s.rank} style={{ opacity: s.used ? 1 : 0.5 }}>
                      <td>{s.rank}</td>
                      <td>
                        <b>{s.section}</b>
                        <div className="muted-sm">{s.preview}...</div>
                      </td>
                      <td style={{ minWidth: 160 }}>
                        <div className="simbar"><div className="simfill" style={{ width: `${Math.max(2, Math.round(s.score * 100))}%`, background: s.used ? "var(--green)" : "var(--muted)" }} /></div>
                        <span className="muted-sm">{s.score.toFixed(3)}</span>
                      </td>
                      <td>{s.used ? <span className="chip green">used</span> : <span className="chip gray">dropped</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="check-reason" style={{ marginTop: 10 }}>The top {retr.top_k} sections (green) become the only policy text the agent is allowed to use - so every claim it makes can be cited back to one of these. This is the &quot;retrieval&quot; that the &quot;generation&quot; is augmented with.</p>
            </div>
          )}

          <div className="panel">
            <div className="panel-h">Reference &middot; which word means what</div>
            <table className="audit rubric-table">
              <thead><tr><th>Word on screen</th><th>What it really means</th><th>Example (Omar)</th></tr></thead>
              <tbody>
                <tr><td><b>Query</b></td><td>The case turned into one search sentence. This is what we search the policy with.</td><td>&quot;Onboarding decision. Resident newcomer... documents provided... AML risk, escalation...&quot;</td></tr>
                <tr><td><b>Policy section</b></td><td>One chunk of the bank rulebook (the policy is split into 9).</td><td>&quot;Section 4. Required documents&quot;</td></tr>
                <tr><td><b>Match (similarity) / score</b></td><td>How close that section is to the query in <b>meaning</b>, from 0 to 1. Higher = more relevant. It is NOT a percentage of correctness - it is a closeness number.</td><td>0.641 = closest; 0.346 = barely related</td></tr>
                <tr><td><b>used / kept</b> (green)</td><td>This section scored high enough (top 7) to be handed to the AI. The AI may only use these.</td><td>Sections 1, 4, 3, 6, 5, 8, 2</td></tr>
                <tr><td><b>dropped</b> (grey)</td><td>Scored too low, so it is left out. The AI never sees it.</td><td>Section 9 and Section 7</td></tr>
              </tbody>
            </table>
            <p className="check-reason" style={{ marginTop: 12 }}>Do not confuse this with the trust score: the <b>similarity score here picks the input</b> (which rules go in, 0 to 1, higher = more relevant), while the <b>trust score in Evals grades the output</b> (0 to 100%, higher = more correct). One chooses the rules; the other judges the answer.</p>
          </div>

          <div className="panel">
            <div className="panel-h">The tech behind it &middot; embeddings, transformers.js, cosine similarity</div>
            <table className="audit rubric-table">
              <thead><tr><th>Term</th><th>What it is (plain words)</th><th>In this project</th></tr></thead>
              <tbody>
                <tr><td><b>Embedding</b></td><td>Turning a piece of text into a list of numbers that captures its <b>meaning</b>. Text with similar meaning gets similar numbers - so meaning becomes math you can compare.</td><td>&quot;Section 4. Required documents&quot; becomes ~384 numbers; the case query becomes its own ~384 numbers.</td></tr>
                <tr><td><b>transformers.js</b></td><td>A free software library (the JavaScript version of Hugging Face&apos;s &quot;Transformers&quot;) that <b>runs a small AI model on our own server</b> to produce those embeddings - no internet, no extra API key.</td><td>It is the tool that does the &quot;turn to numbers&quot; step in the flow map above.</td></tr>
                <tr><td><b>The model</b></td><td>The specific small model transformers.js runs. It is trained to place similar-meaning text close together.</td><td><span className="mono">all-MiniLM-L6-v2</span> - small, fast, runs locally.</td></tr>
                <tr><td><b>Cosine similarity</b></td><td>The math that measures how close two embeddings point in the same direction. Result is 0 to 1; higher = more alike in meaning.</td><td>It produces the <b>score</b> on the map and in the table (e.g. 0.641).</td></tr>
                <tr><td><b>Why local, not a cloud call</b></td><td>Embeddings here are computed on our own server instead of a paid API.</td><td>Free, works offline, and Anthropic (Claude) has no embeddings API - so transformers.js fills that gap. Claude is still used for the decision and the judge.</td></tr>
              </tbody>
            </table>
            <p className="check-reason" style={{ marginTop: 12 }}>The clean split: <b>transformers.js finds the relevant rules</b> (the search/meaning step), then <b>Claude reasons and writes the cited decision</b> (the language step). Different tools, different jobs.</p>
          </div>
        </div>
      )}

      {view === "evals" && (
        <div className="page">
          <div className="panel">
            <div className="panel-h">The trust layer (evals)</div>
            <table className="audit rubric-table" style={{ marginBottom: 14 }}>
              <tbody>
                <tr><td><b>What this is</b></td><td>A test of the grader itself. The assistant already grades every onboarding answer (the Trust scoreboard). This checks whether that grader can be trusted.</td></tr>
                <tr><td><b>Why it matters</b></td><td>A grader that only passes good answers is useless. To trust it, we must prove it also catches BAD answers.</td></tr>
                <tr><td><b>How it works</b></td><td>We hand the grader three answers we deliberately broke, each with one planted flaw. A good grader marks each as failing.</td></tr>
                <tr><td><b>How to read it</b></td><td>&quot;Caught&quot; = the grader failed at least one rubric check on that bad answer. 3 / 3 caught = the grader is reliable.</td></tr>
              </tbody>
            </table>
            <table className="audit rubric-table" style={{ marginBottom: 14 }}>
              <thead><tr><th>Two scores, do not confuse them</th><th>What it measures</th><th>Range</th><th>Higher means</th></tr></thead>
              <tbody>
                <tr><td><b>Similarity score</b> (RAG search)</td><td>How <b>relevant</b> a policy section is to the case - it picks the input.</td><td>0 to 1</td><td>more likely to be <b>picked</b></td></tr>
                <tr><td><b>Trust score</b> (here &amp; the scoreboard)</td><td>How <b>correct</b> an answer is against the 4 rubric checks - it grades the output.</td><td>0 to 100%</td><td>more <b>trustworthy</b></td></tr>
              </tbody>
            </table>
            <button className="btn-primary" onClick={runDiscrimination} disabled={evalLoading}>
              {evalLoading ? "Running discrimination test..." : "Run discrimination test"}
            </button>
          </div>

          {evals && (
            <div className="panel scoreboard">
              <div className="panel-h">Result</div>
              <div className="score-line">
                <span className="score-big" style={{ color: evals.caught === evals.total ? "var(--green)" : "var(--red)" }}>{evals.caught}/{evals.total}</span>
                {evals.caught === evals.total
                  ? <span className="chip green">rubric proven - every bad answer caught</span>
                  : <span className="chip red">a bad answer slipped through</span>}
              </div>
              <table className="audit" style={{ marginTop: 10 }}>
                <thead><tr><th>Test case</th><th>What the fake answer claimed</th><th>Why it&apos;s wrong</th><th>Result (caught by failing)</th><th>Rubric checks</th></tr></thead>
                <tbody>
                  {evals.cases.map((c: any, i: number) => {
                    const total = c.per_check.length; const passed = total - c.failed_checks.length;
                    return (
                    <tr key={i}>
                      <td><b>{c.name}</b></td>
                      <td className="muted-sm">{c.claimed}</td>
                      <td className="muted-sm">{c.flaw}</td>
                      <td>
                        <span className={`chip ${c.caught ? "green" : "red"}`}>{c.caught ? "CAUGHT" : "MISSED"}</span>
                        <div style={{ marginTop: 6 }}>{c.failed_checks.map((f: string) => <span key={f} className="chip red" style={{ fontSize: 10, marginRight: 4, marginBottom: 4, display: "inline-block" }}>{f}</span>)}</div>
                      </td>
                      <td><b>{c.failed_checks.length}</b> of {total} failed<div className="muted-sm">({passed} passed)</div></td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="check-reason" style={{ marginTop: 10 }}>Read it like this: each row is a fake answer with one planted flaw. There are 4 rubric checks; the grader fails the ones the answer breaks. <b>Failing even one = CAUGHT.</b> For these deliberately-bad answers, <b>more failures is good</b> - it means the grader is strict. (The Onboarding Trust scoreboard is the opposite: a real answer should pass all 4.)</p>
            </div>
          )}

          <div className="panel">
            <div className="panel-h">The rubric (every answer is checked against these)</div>
            <table className="audit rubric-table">
              <thead><tr><th>Check</th><th>What it verifies</th><th>Why it matters</th><th>A failure looks like</th></tr></thead>
              <tbody>
                <tr>
                  <td><b>grounded_citations</b></td>
                  <td>Every claim is backed by a cited policy section that actually says it.</td>
                  <td>An officer or regulator must be able to trace every statement to the source.</td>
                  <td>Cites a section that does not support the claim, or makes a claim with no citation.</td>
                </tr>
                <tr>
                  <td><b>honest_refusal</b></td>
                  <td>Refuses or escalates when the policy does not cover the case; does not refuse when it does.</td>
                  <td>A confident answer to an uncovered case is a compliance risk; needless refusals waste time.</td>
                  <td>Confidently approves a tourist/remote case the policy never addresses.</td>
                </tr>
                <tr>
                  <td><b>no_hallucination</b></td>
                  <td>Invents no rule, fee, threshold, document, or section.</td>
                  <td>Made-up rules in KYC/AML are dangerous and can breach regulation.</td>
                  <td>States an &quot;AED 5,000 minimum salary&quot; that appears nowhere in the policy.</td>
                </tr>
                <tr>
                  <td><b>correct_action</b></td>
                  <td>The recommendation matches the policy and the escalation rules.</td>
                  <td>The final action (proceed / request documents / escalate) is what affects the customer.</td>
                  <td>Proceeds when a required document is missing, or auto-approves a sanctions match.</td>
                </tr>
              </tbody>
            </table>
            <p className="check-reason" style={{ marginTop: 12 }}>How it is graded: a second Claude call (the LLM judge) reads the bank policy, the case, and the assistant&apos;s answer, then marks each check pass/fail with a reason and tags the root cause of any failure (bad_retrieval / bad_generation / ambiguous_input). The same rubric runs on every decision in Onboarding (the Trust scoreboard); the &quot;Break it&quot; toggle there forces a failure so you can watch it get caught live.</p>
          </div>
        </div>
      )}

      {/* ===================== AUDIT LOG ===================== */}
      {view === "audit" && (
        <div className="page">
          <div className="panel">
            <div className="panel-head-row">
              <div className="panel-h" style={{ margin: 0 }}>Audit log &middot; every decision is recorded</div>
              {total > 0 && <button className="btn-secondary" onClick={clearLog}>Clear log (reset demo)</button>}
            </div>
            {total === 0 && <p className="check-reason">No decisions yet. Each check you run is recorded here with its outcome, trust score, and root-cause tag.</p>}
            {total > 0 && (
              <table className="audit">
                <thead><tr><th>Case</th><th>Time</th><th>Applicant</th><th>Outcome</th><th>Trust</th><th>RCA</th><th>Officer action</th></tr></thead>
                <tbody>
                  {log.map((r) => (
                    <tr key={r.case_id}>
                      <td className="mono">{r.case_id}</td><td className="muted-sm">{fmt(r.ts)}</td><td>{r.name}</td>
                      <td><Outcome r={r.recommendation} /></td><td>{Math.round(r.score * 100)}%</td>
                      <td className="muted-sm">{r.rca_tag}</td>
                      <td>{r.officer_status ? <><span className="chip green">{r.officer_status}</span>{r.officer_note && <div className="muted-sm" style={{ marginTop: 4 }}>&ldquo;{r.officer_note}&rdquo;</div>}</> : <span className="muted-sm">pending</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ===================== REPORT ===================== */}
      {view === "report" && (
        <div className="page">
          <div className="panel">
            <div className="panel-head-row">
              <div className="panel-h" style={{ margin: 0 }}>Onboarding decisions report</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-secondary" onClick={downloadCSV} disabled={ftot === 0}>Download CSV</button>
                <button className="btn-secondary" onClick={() => window.print()} disabled={ftot === 0}>Print</button>
              </div>
            </div>
            <div className="filters">
              <select className="filter-sel" value={flt.outcome} onChange={(e) => setFlt({ ...flt, outcome: e.target.value })}>
                <option value="all">All outcomes</option><option value="proceed">Proceed</option><option value="request_documents">Request documents</option><option value="escalate">Escalate</option>
              </select>
              <select className="filter-sel" value={flt.status} onChange={(e) => setFlt({ ...flt, status: e.target.value })}>
                <option value="all">Any status</option><option value="pending">Pending officer</option><option value="actioned">Actioned by officer</option>
              </select>
              <select className="filter-sel" value={flt.mode} onChange={(e) => setFlt({ ...flt, mode: e.target.value })}>
                <option value="all">All modes</option><option value="normal">Normal</option><option value="breakit">Break-it</option>
              </select>
              <input className="note-input" style={{ maxWidth: 260 }} placeholder="Search name, case, product..." value={flt.q} onChange={(e) => setFlt({ ...flt, q: e.target.value })} />
              {(flt.outcome !== "all" || flt.status !== "all" || flt.mode !== "all" || flt.q) &&
                <button className="act act-open" onClick={() => setFlt({ outcome: "all", status: "all", mode: "all", q: "" })}>Reset filters</button>}
            </div>

            <div className="stats" style={{ marginTop: 2 }}>
              <div className="stat"><div className="stat-n">{ftot}</div><div className="stat-l">Decisions{ftot !== total ? ` (of ${total})` : ""}</div></div>
              <div className="stat"><div className="stat-n" style={{ color: "var(--green)" }}>{fcnt("proceed")}</div><div className="stat-l">Proceeded</div></div>
              <div className="stat"><div className="stat-n" style={{ color: "var(--amber)" }}>{fcnt("request_documents")}</div><div className="stat-l">Awaiting documents</div></div>
              <div className="stat"><div className="stat-n" style={{ color: "var(--red)" }}>{fcnt("escalate")}</div><div className="stat-l">Escalated</div></div>
              <div className="stat"><div className="stat-n">{ftot ? favg + "%" : "-"}</div><div className="stat-l">Avg trust score</div></div>
            </div>

            {ftot === 0 ? (
              <p className="check-reason">No decisions match. Run checks in Onboarding, or reset the filters.</p>
            ) : (
              <table className="audit">
                <thead><tr><th>Case</th><th>Time</th><th>Applicant</th><th>Opening</th><th>Outcome</th><th>Trust</th><th>RCA</th><th>Mode</th><th>Officer action</th></tr></thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.case_id}>
                      <td className="mono">{r.case_id}</td><td className="muted-sm">{fmt(r.ts)}</td><td>{r.name}</td><td className="muted-sm">{r.applied_for}</td>
                      <td><Outcome r={r.recommendation} /></td><td>{Math.round(r.score * 100)}%</td><td className="muted-sm">{r.rca_tag}</td>
                      <td>{r.breakIt ? <span className="chip red" style={{ fontSize: 10 }}>break-it</span> : <span className="muted-sm">normal</span>}</td>
                      <td>{r.officer_status ? <span className="chip green">{r.officer_status}</span> : <span className="muted-sm">pending</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="panel">
            <div className="panel-h">Alignment with CBUAE expectations</div>
            <div className="stats" style={{ marginTop: 2 }}>
              <div className="stat"><div className="stat-n">100%</div><div className="stat-l">Decisions citing policy</div></div>
              <div className="stat"><div className="stat-n">{fhuman}</div><div className="stat-l">Sent to a human</div></div>
              <div className="stat"><div className="stat-n">0</div><div className="stat-l">High-risk auto-approved</div></div>
              <div className="stat"><div className="stat-n">{ftot ? favg + "%" : "-"}</div><div className="stat-l">Avg trust score</div></div>
            </div>
            <table className="audit" style={{ marginTop: 14 }}>
              <thead><tr><th>CBUAE expectation</th><th>How this system meets it</th></tr></thead>
              <tbody>
                <tr><td><b>Transparency / explainability</b></td><td>Every decision is grounded in policy and cites the exact section; the rule is one click away.</td></tr>
                <tr><td><b>Human oversight</b></td><td>Risky or uncovered cases are escalated to an officer; the AI never auto-approves them.</td></tr>
                <tr><td><b>Accountability / auditability</b></td><td>Every decision is recorded with outcome, trust score, root cause, and the officer&apos;s action and note.</td></tr>
                <tr><td><b>Fairness / non-discrimination</b></td><td>Decisions use only identity, documents, and AML signals; gender and photos are not collected.</td></tr>
                <tr><td><b>Reliability</b></td><td>A trust layer grades every answer and is proven by a discrimination test that plants bad answers and confirms the rubric catches them.</td></tr>
              </tbody>
            </table>
            <p className="check-reason" style={{ marginTop: 12 }}>Synthetic demo. Maps to the CBUAE Guidance Note on Consumer Protection and Responsible Adoption of AI (Feb 2026).</p>
          </div>
        </div>
      )}

      <footer className="footer">
        Synthetic data only. No real customers. Acme Bank UAE is fictional. Decisions are explainable and
        align with CBUAE expectations: every claim is cited, the assistant refuses when policy is silent, and risk is escalated to a human.
      </footer>
    </div>
  );
}
