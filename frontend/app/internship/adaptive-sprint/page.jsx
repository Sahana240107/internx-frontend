"use client";

import { useEffect, useState, useCallback } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// ── Tier config ────────────────────────────────────────────────────────────────
const TIER_CONFIG = {
  easy: {
    label: "Easy — Foundations",
    color: "#00c896",
    bg: "#e0fff7",
    border: "#a7f3d0",
    bar: "#00c896",
    icon: "🌱",
    desc: "Focused tasks with guided hints. Build confidence step by step.",
  },
  medium: {
    label: "Medium — Ownership",
    color: "#f59e0b",
    bg: "#fffbeb",
    border: "#fcd34d",
    bar: "#f59e0b",
    icon: "⚡",
    desc: "You own the implementation decisions. Hints available, not prescriptive.",
  },
  hard: {
    label: "Hard — Architecture",
    color: "#ef4444",
    bg: "#fff1f2",
    border: "#fca5a5",
    bar: "#ef4444",
    icon: "🔥",
    desc: "Full architectural ownership. No templates. Production-grade delivery expected.",
  },
};

const STATUS_CONFIG = {
  todo:        { label: "To Do",       color: "var(--ink-muted)", bg: "var(--surface-2)", dot: "#8888a0" },
  in_progress: { label: "In Progress", color: "#3b82f6",          bg: "#eff6ff",          dot: "#3b82f6" },
  review:      { label: "In Review",   color: "var(--amber)",     bg: "var(--amber-soft)", dot: "#f59e0b" },
  done:        { label: "Done",        color: "var(--green)",     bg: "var(--green-soft)", dot: "#00c896" },
};

const PRIORITY_CONFIG = {
  high:   { label: "High",   color: "var(--red)",      bg: "var(--red-soft)" },
  medium: { label: "Medium", color: "var(--amber)",    bg: "var(--amber-soft)" },
  low:    { label: "Low",    color: "var(--ink-muted)", bg: "var(--surface-2)" },
};

// ── Score ring (SVG) ───────────────────────────────────────────────────────────
function ScoreRing({ score, tier }) {
  const r    = 46;
  const circ = 2 * Math.PI * r;
  const dash = circ * (score / 100);
  const col  = TIER_CONFIG[tier]?.bar || "#5b4fff";
  return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="9" />
      <circle
        cx="60" cy="60" r={r} fill="none"
        stroke={col} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={circ / 4}
        style={{ transition: "stroke-dasharray 1.1s cubic-bezier(.4,0,.2,1)" }}
      />
      <text x="60" y="54" textAnchor="middle" fontSize="26" fontWeight="800" fill="var(--ink)" fontFamily="var(--font-display, sans-serif)">
        {Math.round(score)}
      </text>
      <text x="60" y="70" textAnchor="middle" fontSize="10" fill="var(--ink-muted)">/ 100</text>
    </svg>
  );
}

// ── Sprint 1 progress bar ─────────────────────────────────────────────────────
function SprintProgress({ done, total }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--ink-muted)", marginBottom: 6 }}>
        <span>{done} of {total} tasks done</span>
        <span style={{ fontWeight: 700, color: "var(--ink)" }}>{pct}%</span>
      </div>
      <div style={{ height: 8, background: "var(--surface-2)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: "linear-gradient(90deg, var(--accent) 0%, #a78bfa 100%)",
          borderRadius: 99,
          transition: "width 0.7s cubic-bezier(.4,0,.2,1)",
        }} />
      </div>
    </div>
  );
}

// ── Stat pill (score breakdown) ───────────────────────────────────────────────
function StatPill({ label, value, positive }) {
  const isNum = typeof value === "number";
  const sign  = isNum && value > 0 ? "+" : "";
  const color =
    !isNum               ? "var(--ink)"      :
    value > 0 && positive ? "var(--green)"   :
    value < 0             ? "var(--red)"     :
                            "var(--ink)";
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      background: "var(--surface-2)", borderRadius: 14, padding: "10px 16px",
      border: "1.5px solid var(--border)", minWidth: 86,
    }}>
      <span style={{ fontSize: 15, fontWeight: 800, color, letterSpacing: "-0.5px" }}>
        {sign}{isNum ? (Number.isInteger(value) ? value : value.toFixed(1)) : value}
      </span>
      <span style={{ fontSize: 10, color: "var(--ink-muted)", textAlign: "center", marginTop: 3, lineHeight: 1.3 }}>
        {label}
      </span>
    </div>
  );
}

// ── Task card ─────────────────────────────────────────────────────────────────
function TaskCard({ task, locked = false }) {
  const [open, setOpen] = useState(false);
  const s   = STATUS_CONFIG[task.status]   || STATUS_CONFIG.todo;
  const p   = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const due = task.due_date
    ? new Date(task.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : null;
  const isDone    = task.status === "done";
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !isDone;

  return (
    <div style={{
      position: "relative",
      background: "white",
      border: `1.5px solid ${isDone ? "#a7f3d0" : "var(--border)"}`,
      borderRadius: 18,
      padding: "18px 20px",
      transition: "all 0.18s",
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      opacity: locked ? 0.5 : 1,
      pointerEvents: locked ? "none" : "auto",
    }}
      onMouseEnter={e => !locked && (e.currentTarget.style.boxShadow = "0 4px 18px rgba(91,79,255,0.10)", e.currentTarget.style.borderColor = "var(--accent)", e.currentTarget.style.transform = "translateY(-2px)")}
      onMouseLeave={e => !locked && (e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)", e.currentTarget.style.borderColor = isDone ? "#a7f3d0" : "var(--border)", e.currentTarget.style.transform = "translateY(0)")}
    >
      {locked && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 18,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(255,255,255,0.65)", backdropFilter: "blur(2px)", zIndex: 10,
          fontSize: 22,
        }}>🔒</div>
      )}

      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        {/* Status dot / done check */}
        {isDone ? (
          <span style={{
            width: 20, height: 20, borderRadius: "50%",
            background: "var(--green-soft)", display: "flex", alignItems: "center",
            justifyContent: "center", flexShrink: 0, marginTop: 1,
            color: "var(--green)", fontSize: 11, fontWeight: 800,
          }}>✓</span>
        ) : (
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: s.dot, flexShrink: 0, marginTop: 6,
          }} />
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 5 }}>
            {/* Status badge */}
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "2px 9px",
              borderRadius: 99, color: s.color, background: s.bg,
            }}>{s.label}</span>

            {/* Priority badge */}
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "2px 9px",
              borderRadius: 99, color: p.color, background: p.bg,
            }}>{p.label}</span>

            {/* Due date */}
            {due && (
              <span style={{ fontSize: 11, color: isOverdue ? "var(--red)" : "var(--ink-muted)", fontWeight: isOverdue ? 700 : 400 }}>
                {isOverdue ? "⚠ " : ""}Due {due}
              </span>
            )}

            {/* Score */}
            {task.score != null && (
              <span style={{ fontSize: 11, color: "var(--ink-muted)", fontWeight: 600 }}>
                Score: {task.score}
              </span>
            )}
          </div>

          <h3 style={{
            fontSize: 14, fontWeight: 700, lineHeight: 1.35,
            color: isDone ? "var(--ink-muted)" : "var(--ink)",
            textDecoration: isDone ? "line-through" : "none",
          }}>{task.title}</h3>

          {task.description && (
            <p style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 5, lineHeight: 1.5,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {task.description}
            </p>
          )}

          {/* Task doc toggle */}
          {task.task_doc && !locked && (
            <button
              onClick={() => setOpen(!open)}
              style={{
                marginTop: 10, fontSize: 11, color: "var(--accent)", fontWeight: 600,
                background: "none", border: "none", padding: 0, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              {open ? "▲ Hide" : "▼ View"} task brief
            </button>
          )}
          {open && task.task_doc && (
            <div style={{
              marginTop: 10, background: "var(--surface-2)", borderRadius: 12,
              padding: "14px 16px", fontSize: 12, color: "var(--ink-soft)",
              fontFamily: "monospace", whiteSpace: "pre-wrap",
              border: "1px solid var(--border)", maxHeight: 280, overflowY: "auto",
            }}>
              {task.task_doc}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Locked adaptive placeholder ───────────────────────────────────────────────
function LockedAdaptiveSprint({ doneCount, total }) {
  const remaining = total - doneCount;
  return (
    <div style={{
      background: "white", border: "1.5px dashed var(--border)",
      borderRadius: 20, padding: "40px 32px", textAlign: "center",
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: "50%",
        background: "var(--surface-2)", display: "flex", alignItems: "center",
        justifyContent: "center", margin: "0 auto 16px", fontSize: 24,
      }}>🔒</div>

      <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
        Adaptive Sprint — Locked
      </h3>
      <p style={{ fontSize: 12, color: "var(--ink-muted)", maxWidth: 280, margin: "0 auto 20px", lineHeight: 1.6 }}>
        Complete all Sprint 1 tasks to unlock your adaptive sprint.{" "}
        <span style={{ fontWeight: 700, color: "var(--ink)" }}>
          {remaining} task{remaining !== 1 ? "s" : ""} remaining.
        </span>
      </p>

      {/* Dot indicators matching sprint 1 progress */}
      <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} style={{
            display: "inline-block", width: 11, height: 11, borderRadius: "50%",
            background: i < doneCount ? "var(--accent)" : "var(--border)",
            transition: "background 0.3s",
          }} />
        ))}
      </div>
    </div>
  );
}

// ── Stage breadcrumb ──────────────────────────────────────────────────────────
function StageBreadcrumb({ sprint1Done, adaptiveLocked }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {/* Sprint 1 pill */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 18px", borderRadius: "12px 0 0 12px",
        border: "1.5px solid",
        borderColor: !sprint1Done ? "var(--accent)" : "var(--border)",
        background: !sprint1Done ? "var(--accent)" : "white",
        color: !sprint1Done ? "white" : "var(--ink-muted)",
        fontSize: 13, fontWeight: 600, transition: "all 0.3s",
      }}>
        <span style={{
          width: 20, height: 20, borderRadius: "50%", display: "flex",
          alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800,
          background: !sprint1Done ? "rgba(255,255,255,0.25)" : "var(--green-soft)",
          color: !sprint1Done ? "white" : "var(--green)",
        }}>
          {sprint1Done ? "✓" : "1"}
        </span>
        Sprint 1
      </div>

      {/* Arrow connector */}
      <div style={{
        width: 28, height: 2,
        background: sprint1Done ? "var(--accent)" : "var(--border)",
        transition: "background 0.4s",
      }} />

      {/* Adaptive Sprint pill */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 18px", borderRadius: "0 12px 12px 0",
        border: "1.5px solid",
        borderColor: sprint1Done && !adaptiveLocked ? "var(--accent)" : "var(--border)",
        background: sprint1Done && !adaptiveLocked ? "var(--accent-soft)" : adaptiveLocked ? "var(--surface-2)" : "white",
        color: sprint1Done && !adaptiveLocked ? "var(--accent)" : "var(--ink-muted)",
        fontSize: 13, fontWeight: 600, transition: "all 0.3s",
      }}>
        <span style={{
          width: 20, height: 20, borderRadius: "50%", display: "flex",
          alignItems: "center", justifyContent: "center", fontSize: 11,
          background: adaptiveLocked ? "var(--border)" : "var(--accent-soft)",
          color: adaptiveLocked ? "var(--ink-muted)" : "var(--accent)",
        }}>
          {adaptiveLocked ? "🔒" : "2"}
        </span>
        Adaptive Sprint
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdaptiveSprintPage() {
  const supabase = createClientComponentClient();

  const [progress,  setProgress]  = useState(null);
  const [scoreData, setScoreData] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [computing, setComputing] = useState(false);
  const [error,     setError]     = useState(null);

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const getAuthHeader = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    return { Authorization: `Bearer ${session.access_token}` };
  }, [supabase]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeader();
      const [progressRes, scoreRes] = await Promise.all([
        fetch(`${API}/api/adaptive/progress`, { headers }),
        fetch(`${API}/api/adaptive/score`,    { headers }),
      ]);

      if (progressRes.ok) {
        setProgress(await progressRes.json());
      } else {
        const e = await progressRes.json();
        setError(e.detail || "Failed to load sprint progress.");
      }
      if (scoreRes.ok) setScoreData(await scoreRes.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [API, getAuthHeader]);

  const handleCompute = async () => {
    setComputing(true);
    setError(null);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API}/api/adaptive/compute`, {
        method: "POST", headers,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Compute failed.");
      }
      await fetchAll();
    } catch (e) {
      setError(e.message);
    } finally {
      setComputing(false);
    }
  };

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: "100vh", background: "var(--surface)", padding: "40px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }} className="animate-pulse">
        <div style={{ height: 28, width: 220, background: "var(--surface-2)", borderRadius: 10, marginBottom: 10 }} />
        <div style={{ height: 16, width: 360, background: "var(--surface-2)", borderRadius: 8, marginBottom: 28 }} />
        <div style={{ height: 60, background: "var(--surface-2)", borderRadius: 16, marginBottom: 20 }} />
        <div style={{ height: 180, background: "var(--surface-2)", borderRadius: 20, marginBottom: 16 }} />
        <div style={{ height: 140, background: "var(--surface-2)", borderRadius: 20 }} />
      </div>
    </div>
  );

  // ── Derived state ──────────────────────────────────────────────────────────
  const sprint1        = progress?.sprint1;
  const adaptive       = progress?.adaptive;
  const sprint1Done    = sprint1?.done ?? false;
  const adaptiveLocked = adaptive?.locked ?? true;
  const assignment     = adaptive?.assignment;
  const tier           = assignment?.difficulty_tier || "medium";
  const tc             = TIER_CONFIG[tier];
  const score          = scoreData?.performance_score ?? assignment?.performance_score ?? 0;
  const bk             = scoreData?.breakdown || {};

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)", paddingLeft: 72 }}>
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "40px 24px" }}>

        {/* ── Page header ────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <h1 className="font-display" style={{ fontSize: 26, fontWeight: 800, color: "var(--ink)", marginBottom: 6 }}>
            Sprint Dashboard
          </h1>
          <p style={{ fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.6 }}>
            Complete Sprint 1 to unlock your adaptive sprint — difficulty assigned based on your Sprint 1 performance.
          </p>
        </div>

        {/* ── Error banner ───────────────────────────────────────────────────── */}
        {error && (
          <div style={{
            background: "var(--red-soft)", border: "1.5px solid var(--red)", borderRadius: 14,
            padding: "12px 18px", fontSize: 13, color: "var(--red)", marginBottom: 22,
          }}>
            {error}
          </div>
        )}

        {/* ── Stage breadcrumb ───────────────────────────────────────────────── */}
        <div style={{ marginBottom: 32 }}>
          <StageBreadcrumb sprint1Done={sprint1Done} adaptiveLocked={adaptiveLocked} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

          {/* ════════════════════════════════════════════════════════════════
              SPRINT 1 SECTION
          ════════════════════════════════════════════════════════════════ */}
          <section>
            {/* Section header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <h2 className="font-display" style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
                  {sprint1?.title || "Sprint 1"}
                  {sprint1Done && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 99,
                      background: "var(--green-soft)", color: "var(--green)",
                      border: "1.5px solid #a7f3d0",
                    }}>✓ Complete</span>
                  )}
                </h2>
                {sprint1?.description && (
                  <p style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 3 }}>{sprint1.description}</p>
                )}
              </div>
              <span style={{ fontSize: 12, color: "var(--ink-muted)", fontWeight: 600 }}>
                {sprint1?.done_count ?? 0}/{sprint1?.total ?? 0} done
              </span>
            </div>

            {/* Progress bar */}
            {sprint1 && (
              <div style={{
                background: "white", border: "1.5px solid var(--border)",
                borderRadius: 16, padding: "16px 20px", marginBottom: 16,
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}>
                <SprintProgress done={sprint1.done_count ?? 0} total={sprint1.total ?? 0} />
              </div>
            )}

            {/* Sprint 1 tasks */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(sprint1?.tasks || []).map(task => (
                <TaskCard key={task.id} task={task} locked={false} />
              ))}
              {(!sprint1?.tasks || sprint1.tasks.length === 0) && (
                <div style={{
                  background: "white", border: "1.5px solid var(--border)", borderRadius: 18,
                  padding: "48px 32px", textAlign: "center", color: "var(--ink-muted)", fontSize: 13,
                }}>
                  No Sprint 1 tasks found.
                </div>
              )}
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════════════
              ADAPTIVE SPRINT SECTION
          ════════════════════════════════════════════════════════════════ */}
          <section>
            {/* Section header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 className="font-display" style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
                Adaptive Sprint
                {!adaptiveLocked && assignment && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 99,
                    background: tc.bg, color: tc.color,
                    border: `1.5px solid ${tc.border}`,
                  }}>{tc.icon} {tc.label}</span>
                )}
              </h2>
            </div>

            {/* LOCKED — Sprint 1 not done yet */}
            {adaptiveLocked && (
              <LockedAdaptiveSprint
                doneCount={sprint1?.done_count ?? 0}
                total={sprint1?.total ?? 0}
              />
            )}

            {/* Sprint 1 DONE, no assignment yet — show compute CTA */}
            {sprint1Done && !assignment && (
              <div style={{
                background: "white", border: "1.5px solid var(--accent)",
                borderRadius: 20, padding: "40px 32px", textAlign: "center",
                boxShadow: "0 4px 24px rgba(91,79,255,0.08)",
              }}>
                <p style={{ fontSize: 32, marginBottom: 12 }}>🎯</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
                  Sprint 1 complete!
                </p>
                <p style={{ fontSize: 13, color: "var(--ink-muted)", marginBottom: 24, lineHeight: 1.6, maxWidth: 320, margin: "0 auto 24px" }}>
                  Your performance is ready to be evaluated. Click below to compute your score and unlock your personalised adaptive sprint.
                </p>
                <button
                  onClick={handleCompute}
                  disabled={computing}
                  style={{
                    background: computing ? "var(--border)" : "var(--accent)",
                    color: "white", border: "none", borderRadius: 14,
                    padding: "12px 32px", fontSize: 14, fontWeight: 700,
                    cursor: computing ? "not-allowed" : "pointer",
                    transition: "all 0.18s",
                    boxShadow: computing ? "none" : "0 4px 18px rgba(91,79,255,0.25)",
                  }}
                >
                  {computing ? "Computing…" : "Assign my adaptive sprint →"}
                </button>
              </div>
            )}

            {/* UNLOCKED — score card + breakdown + adaptive tasks */}
            {!adaptiveLocked && assignment && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Score card */}
                <div style={{
                  background: "white", borderRadius: 20,
                  border: `1.5px solid ${tc.border}`,
                  boxShadow: `0 4px 24px ${tc.bg}`,
                  padding: 24,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
                    <ScoreRing score={score} tier={tier} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 22 }}>{tc.icon}</span>
                        <span style={{
                          fontSize: 12, fontWeight: 700, padding: "3px 12px", borderRadius: 99,
                          background: tc.bg, color: tc.color, border: `1.5px solid ${tc.border}`,
                        }}>{tc.label}</span>
                      </div>
                      <p style={{ fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.6, marginBottom: 12 }}>
                        {tc.desc}
                      </p>
                      <button
                        onClick={handleCompute}
                        disabled={computing}
                        style={{
                          fontSize: 11, color: "var(--ink-muted)", background: "none",
                          border: "none", padding: 0, cursor: "pointer", textDecoration: "underline",
                        }}
                      >
                        {computing ? "Recomputing…" : "Recompute from latest scores"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Score breakdown */}
                {scoreData && (
                  <div style={{
                    background: "white", borderRadius: 20,
                    border: "1.5px solid var(--border)",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.04)", padding: 20,
                  }}>
                    <h3 style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
                      Score Breakdown
                    </h3>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      <StatPill label="Avg task score"   value={bk.avg_task_score}   positive={true} />
                      <StatPill label="On-time bonus"    value={bk.on_time_bonus}    positive={true} />
                      <StatPill label="Resubmit penalty" value={bk.resubmit_penalty} positive={false} />
                      <StatPill label="Security penalty" value={bk.security_penalty} positive={false} />
                      <StatPill label="Trajectory bonus" value={bk.trajectory_bonus} positive={true} />
                      <StatPill label="On-time rate"     value={`${Math.round((bk.on_time_rate || 0) * 100)}%`} />
                    </div>

                    {/* Tier band visualiser */}
                    <div style={{ marginTop: 18 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--ink-muted)", marginBottom: 5, padding: "0 2px" }}>
                        <span>0</span><span>40</span><span>70</span><span>100</span>
                      </div>
                      <div style={{ position: "relative", height: 10, background: "var(--surface-2)", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ position: "absolute", inset: 0, display: "flex" }}>
                          <div style={{ height: "100%", width: "40%", background: "#a7f3d0" }} />
                          <div style={{ height: "100%", width: "30%", background: "#fcd34d" }} />
                          <div style={{ height: "100%", width: "30%", background: "#fca5a5" }} />
                        </div>
                        <div style={{
                          position: "absolute", top: 0, height: "100%",
                          width: `${score}%`, background: tc.bar,
                          borderRadius: 99, opacity: 0.85,
                          transition: "width 0.8s cubic-bezier(.4,0,.2,1)",
                        }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginTop: 5, padding: "0 2px" }}>
                        <span style={{ color: "#00c896" }}>Easy</span>
                        <span style={{ color: "#f59e0b" }}>Medium</span>
                        <span style={{ color: "#ef4444" }}>Hard</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Adaptive tasks */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
                      Adaptive Tasks
                      <span style={{ marginLeft: 6, fontSize: 12, color: "var(--ink-muted)", fontWeight: 400 }}>
                        ({adaptive?.tasks?.length || 0} tasks)
                      </span>
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {(adaptive?.tasks || []).map(task => (
                      <TaskCard key={task.id} task={task} locked={false} />
                    ))}
                    {(!adaptive?.tasks || adaptive.tasks.length === 0) && (
                      <div style={{
                        background: "white", border: "1.5px solid var(--border)", borderRadius: 18,
                        padding: "40px 32px", textAlign: "center", color: "var(--ink-muted)", fontSize: 13,
                      }}>
                        No tasks found for this adaptive sprint.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}