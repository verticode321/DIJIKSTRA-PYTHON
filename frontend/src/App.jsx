import React, { useState, useEffect } from "react";

const API_BASE = "http://localhost:8080";

const C = {
  purple50:  "#EEEDFE", purple100: "#CECBF6", purple200: "#AFA9EC",
  purple400: "#7F77DD", purple600: "#534AB7", purple800: "#3C3489",
  teal50:    "#E1F5EE", teal100:   "#9FE1CB", teal200:   "#5DCAA5",
  teal400:   "#1D9E75", teal600:   "#0F6E56", teal800:   "#085041",
  coral50:   "#FAECE7", coral100:  "#F5C4B3", coral200:  "#F0997B",
  coral400:  "#D85A30", coral600:  "#993C1D", coral800:  "#712B13",
  gray50:    "#F1EFE8", gray100:   "#D3D1C7", gray400:   "#888780",
  gray800:   "#2C2C2A",
};

export default function App() {
  const [numNodes, setNumNodes] = useState(null);
  const [source,   setSource]   = useState(0);
  const [dest,     setDest]     = useState(4999);
  const [threads,  setThreads]  = useState(4);
  const [result,   setResult]   = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/api/info`)
      .then((r) => r.json())
      .then((d) => setNumNodes(d.numNodes))
      .catch(() => setError("Cannot connect to backend. Is server.py running?"));
  }, []);

  const runDijkstra = async () => {
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/shortest-path?source=${source}&dest=${dest}&threads=${threads}`
      );
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Request failed"); }
      setResult(await res.json());
    } catch (e) {
      setError(e.message || "Failed to fetch. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.purple50, padding: "1.5rem", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: C.purple800, margin: 0 }}>
            Dijkstra's shortest path
          </h1>
          <p style={{ fontSize: 13, color: C.purple600, marginTop: 4 }}>
            Parallel implementation using Python multiprocessing
          </p>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: C.purple100, color: C.purple800,
            fontSize: 12, fontWeight: 500, padding: "4px 10px",
            borderRadius: 20, marginTop: 6,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.teal400, display: "inline-block" }} />
            {numNodes !== null
              ? `Graph loaded: ${numNodes.toLocaleString()} nodes · SQLite DB`
              : "Connecting to backend…"}
          </span>
        </div>

        {/* Input panel */}
        <div style={panel}>
          <div style={panelLabel}>Query parameters</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
            <Field label="Source node"      value={source}  max={numNodes - 1} onChange={setSource} />
            <Field label="Destination node" value={dest}    max={numNodes - 1} onChange={setDest} />
            <div>
              <label style={lbl}>Worker processes</label>
              <select value={threads} onChange={e => setThreads(Number(e.target.value))} style={inp}>
                {[1, 2, 4, 8].map(t => (
                  <option key={t} value={t}>{t} {t === 1 ? "process" : "processes"}</option>
                ))}
              </select>
            </div>
            <button onClick={runDijkstra} disabled={loading || numNodes === null}
              style={{
                background: loading ? C.purple200 : C.purple600,
                color: "#fff", border: "none", borderRadius: 8,
                padding: "9px 18px", fontSize: 14, fontWeight: 500,
                cursor: loading ? "not-allowed" : "pointer", whiteSpace: "nowrap",
              }}>
              {loading ? "Running…" : "▶ Run Dijkstra"}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: "#FCEBEB", color: "#A32D2D", padding: "10px 14px", borderRadius: 10, marginBottom: 12, fontSize: 13 }}>
            ⚠ {error}
          </div>
        )}

        {loading && (
          <div style={{ ...panel, textAlign: "center", color: C.purple600, fontSize: 13 }}>
            ⏳ Running sequential + parallel Dijkstra on {numNodes?.toLocaleString()} nodes…
          </div>
        )}

        {result && <>
          {/* Two result cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <ResultCard title="Sequential" sub="Single process · no parallelism"
              accentColor={C.coral400} titleColor={C.coral600} data={result.sequential} />
            <ResultCard title={`Parallel (${result.threadsUsed} processes)`} sub={`Python multiprocessing · Pool(${result.threadsUsed})`}
              accentColor={C.teal400} titleColor={C.teal600} data={result.parallel} />
          </div>

          {/* Performance panel */}
          <div style={panel}>
            <div style={panelLabel}>Performance comparison</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
              <Stat label="Sequential time" value={`${result.sequential.executionTimeMs.toFixed(2)} ms`} />
              <Stat label="Parallel time"   value={`${result.parallel.executionTimeMs.toFixed(2)} ms`} />
              <Stat label="Speedup" value={`${result.speedup.toFixed(2)}×`} highlight />
            </div>

            <div style={{ fontSize: 11, color: C.gray400, marginBottom: 5 }}>Time proportion — sequential vs parallel</div>
            <div style={{ display: "flex", height: 24, borderRadius: 8, overflow: "hidden", background: C.gray50 }}>
              <Bar
                pct={result.sequential.executionTimeMs / (result.sequential.executionTimeMs + result.parallel.executionTimeMs) * 100}
                bg={C.coral200} color={C.coral800} label="Sequential"
              />
              <Bar
                pct={result.parallel.executionTimeMs / (result.sequential.executionTimeMs + result.parallel.executionTimeMs) * 100}
                bg={C.teal200} color={C.teal800} label="Parallel"
              />
            </div>

            <div style={{
              marginTop: 12, background: C.purple50, borderRadius: 10,
              padding: "10px 12px", fontSize: 12, color: C.purple800, lineHeight: 1.6,
            }}>
              <strong>How it works:</strong>{" "}
              <code style={{ background: C.purple100, padding: "1px 5px", borderRadius: 4, fontSize: 11 }}>
                multiprocessing.Pool({result.threadsUsed})
              </code>{" "}
              spawns {result.threadsUsed} worker processes. Step 1 (find minimum unvisited node) is split across workers —
              each scans its chunk, master picks the global minimum. Step 2 (relax neighbors) is also distributed.
              This mirrors OpenMP's{" "}
              <code style={{ background: C.purple100, padding: "1px 5px", borderRadius: 4, fontSize: 11 }}>
                #pragma omp parallel for
              </code>.
            </div>
          </div>
        </>}
      </div>
    </div>
  );
}

function Field({ label, value, max, onChange }) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      <input type="number" min={0} max={max || 4999} value={value}
        onChange={e => onChange(Number(e.target.value))} style={inp} />
    </div>
  );
}

function ResultCard({ title, sub, accentColor, titleColor, data }) {
  return (
    <div style={{
      background: "#fff", borderRadius: "0 14px 14px 0",
      borderLeft: `4px solid ${accentColor}`,
      border: `0.5px solid #E0DED8`,
      borderLeft: `4px solid ${accentColor}`,
      padding: "1.25rem",
    }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: titleColor, marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 11, color: "#888780", marginBottom: 12 }}>{sub}</div>
      {[
        ["Total cost",     data.totalCost === -1 ? "No path found" : data.totalCost.toLocaleString()],
        ["Execution time", `${data.executionTimeMs.toFixed(4)} ms`],
        ["Path length",    data.path.length > 0 ? `${data.path.length} nodes` : "—"],
      ].map(([k, v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", borderBottom: `0.5px solid ${C.gray50}` }}>
          <span style={{ color: C.gray400 }}>{k}</span>
          <span style={{ fontWeight: 500, color: C.gray800 }}>{v}</span>
        </div>
      ))}
      <div style={{ marginTop: 10, background: C.gray50, borderRadius: 8, padding: "8px 10px", fontSize: 11, color: C.gray400, maxHeight: 64, overflowY: "auto", wordBreak: "break-all", lineHeight: 1.6 }}>
        {data.path.length > 0 ? data.path.join(" → ") : "—"}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div style={{
      background: highlight ? C.purple50 : C.gray50,
      borderRadius: 10, padding: 12, textAlign: "center",
    }}>
      <div style={{ fontSize: 11, color: C.gray400, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 500, color: highlight ? C.purple600 : C.gray800 }}>{value}</div>
    </div>
  );
}

function Bar({ pct, bg, color, label }) {
  return (
    <div style={{
      width: `${Math.max(pct, 8)}%`, background: bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 10, color, fontWeight: 500, transition: "width 0.5s ease",
    }}>
      {pct > 15 ? label : ""}
    </div>
  );
}

const panel = {
  background: "#fff", borderRadius: 14, border: `0.5px solid #AFA9EC`,
  padding: "1.25rem", marginBottom: "1rem",
};
const panelLabel = {
  fontSize: 11, fontWeight: 500, color: C.purple600,
  letterSpacing: ".04em", marginBottom: 10, textTransform: "uppercase",
};
const lbl = { display: "block", fontSize: 12, color: C.gray400, marginBottom: 5 };
const inp = {
  width: "100%", border: `1.5px solid ${C.purple100}`, borderRadius: 8,
  padding: "8px 10px", fontSize: 14, color: C.gray800,
  background: C.purple50, outline: "none", boxSizing: "border-box",
};
