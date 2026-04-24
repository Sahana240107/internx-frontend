'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { taskApi } from '@/lib/taskApi'
import { toast } from 'sonner'
import Link from 'next/link'

const STATUS_CONFIG = {
  todo:        { label: 'To Do',       color: '#8888a0', bg: 'var(--surface-2)' },
  in_progress: { label: 'In Progress', color: '#3b82f6', bg: 'var(--blue-soft)' },
  review:      { label: 'In Review',   color: '#f59e0b', bg: 'var(--amber-soft)' },
  done:        { label: 'Done',        color: '#00c896', bg: 'var(--green-soft)' },
}

const PRIORITY_CONFIG = {
  low:    { label: 'Low',    color: '#8888a0', bg: 'var(--surface-2)' },
  medium: { label: 'Medium', color: '#f59e0b', bg: 'var(--amber-soft)' },
  high:   { label: 'High',   color: '#ef4444', bg: 'var(--red-soft)' },
  urgent: { label: 'Urgent', color: '#dc2626', bg: '#fff1f1' },
}

const BREAKDOWN_MAX = {
  task_completion:          40,
  correctness_reliability:  25,
  code_quality:             20,
  security_best_practices:  10,
  testing_signals:           5,
}

const BREAKDOWN_LABELS = {
  task_completion:          'Task Completion',
  correctness_reliability:  'Correctness & Reliability',
  code_quality:             'Code Quality',
  security_best_practices:  'Security & Best Practices',
  testing_signals:          'Testing Signals',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreRing({ score }) {
  const radius = 36
  const circ   = 2 * Math.PI * radius
  const offset = circ - (score / 100) * circ
  const color  = score >= 70 ? '#00c896' : score >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div className="relative w-24 h-24 flex items-center justify-center flex-shrink-0">
      <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle cx="48" cy="48" r={radius} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-xl font-black" style={{ color }}>{score}</span>
        <span className="text-[9px] font-semibold" style={{ color: 'var(--ink-muted)' }}>/ 100</span>
      </div>
    </div>
  )
}

function SeverityBadge({ severity }) {
  const map = {
    critical: { bg: '#fef2f2', color: '#dc2626', label: 'Critical' },
    high:     { bg: '#fff7ed', color: '#ea580c', label: 'High' },
    medium:   { bg: '#fefce8', color: '#ca8a04', label: 'Medium' },
    low:      { bg: '#f0fdf4', color: '#16a34a', label: 'Low' },
  }
  const s = map[severity] || map.low
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.color }}>{s.label}</span>
  )
}

function BreakdownBar({ label, score, max }) {
  const pct   = Math.round((score / max) * 100)
  const color = pct >= 70 ? '#00c896' : pct >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs" style={{ color: 'var(--ink-soft)' }}>
        <span>{label}</span>
        <span className="font-semibold">{score}<span className="font-normal opacity-60">/{max}</span></span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

// ─── Structured Review Panel ──────────────────────────────────────────────────
// Renders the parsed review_json in a clean, sectioned layout.
function ReviewPanel({ review, score }) {
  if (!review) return null

  const passed       = score >= 70
  const verdictColor = passed ? '#00c896' : '#ef4444'
  const verdictBg    = passed ? '#f0fdf4' : '#fff5f5'
  const bd           = review.breakdown || {}

  return (
    <div className="space-y-4">

      {/* Verdict banner */}
      <div className="rounded-2xl p-5 flex items-center gap-5"
        style={{ background: verdictBg, border: `1.5px solid ${verdictColor}40` }}>
        <ScoreRing score={score} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-lg font-black" style={{ color: verdictColor }}>
              {passed ? '✅ Passed' : '🔁 Needs Work'}
            </span>
            {review.confidence != null && (
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'white', color: 'var(--ink-muted)' }}>
                {Math.round(review.confidence * 100)}% confidence
              </span>
            )}
          </div>
          {review.review_summary && (
            <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>{review.review_summary}</p>
          )}
        </div>
      </div>

      {/* Score breakdown */}
      <div className="rounded-2xl p-5 space-y-3"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Score Breakdown</p>
        {Object.entries(BREAKDOWN_MAX).map(([key, max]) => (
          <BreakdownBar key={key} label={BREAKDOWN_LABELS[key]} score={bd[key] || 0} max={max} />
        ))}
      </div>

      {/* Strengths */}
      {review.strengths?.length > 0 && (
        <div className="rounded-2xl p-5 space-y-2"
          style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <p className="text-sm font-semibold" style={{ color: '#15803d' }}>✅ What you did well</p>
          <ul className="space-y-1.5">
            {review.strengths.map((s, i) => (
              <li key={i} className="text-sm flex gap-2" style={{ color: '#166534' }}>
                <span>•</span><span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Blocking issues */}
      {review.blocking_issues?.length > 0 && (
        <div className="rounded-2xl p-5 space-y-3"
          style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
          <p className="text-sm font-semibold" style={{ color: '#dc2626' }}>🚧 Blocking Issues</p>
          {review.blocking_issues.map((b, i) => (
            <div key={i} className="rounded-xl p-3 space-y-1.5"
              style={{ background: '#fff', border: '1px solid #fecaca' }}>
              <div className="flex items-center gap-2 flex-wrap">
                <SeverityBadge severity={b.severity} />
                {b.file && (
                  <code className="text-xs px-1.5 py-0.5 rounded"
                    style={{ background: '#f1f5f9', color: '#475569' }}>
                    {b.file}{b.line ? `:${b.line}` : ''}
                  </code>
                )}
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{b.issue}</p>
              {b.why_it_matters && (
                <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
                  <span className="font-semibold">Why it matters: </span>{b.why_it_matters}
                </p>
              )}
              {b.fix && (
                <p className="text-xs px-2 py-1.5 rounded-lg"
                  style={{ background: '#f0fdf4', color: '#166534' }}>
                  <span className="font-semibold">Fix: </span>{b.fix}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Missing requirements */}
      {review.missing_requirements?.length > 0 && (
        <div className="rounded-2xl p-5 space-y-2"
          style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
          <p className="text-sm font-semibold" style={{ color: '#c2410c' }}>📋 Missing Requirements</p>
          <ul className="space-y-1">
            {review.missing_requirements.map((m, i) => (
              <li key={i} className="text-sm flex gap-2" style={{ color: '#9a3412' }}>
                <span>✕</span><span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Improvements */}
      {review.improvements?.length > 0 && (
        <div className="rounded-2xl p-5 space-y-2"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>💡 Suggested Improvements</p>
          <ul className="space-y-2">
            {review.improvements.map((im, i) => (
              <li key={i} className="text-sm" style={{ color: 'var(--ink-soft)' }}>
                {im.priority && (
                  <span className="font-semibold text-xs uppercase mr-1"
                    style={{ color: im.priority === 'high' ? '#ea580c' : '#ca8a04' }}>
                    [{im.priority}]
                  </span>
                )}
                {im.item || im}
                {im.expected_outcome && (
                  <span className="block text-xs mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                    → {im.expected_outcome}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next steps */}
      {review.next_steps?.length > 0 && (
        <div className="rounded-2xl p-5 space-y-2"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>🎯 Next Steps</p>
          <ol className="space-y-1.5 list-none">
            {review.next_steps.map((s, i) => (
              <li key={i} className="text-sm flex gap-2 items-start" style={{ color: 'var(--ink-soft)' }}>
                <span className="w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5"
                  style={{ background: 'var(--accent)', color: '#fff' }}>{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function TaskDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [task,          setTask]          = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [prUrl,         setPrUrl]         = useState('')
  const [showPrInput,   setShowPrInput]   = useState(false)

  useEffect(() => {
    if (id) {
      localStorage.setItem("current_task_id", id)
      loadTask()
    }
  }, [id])

  // Auto-refresh every 5 seconds if task is in review
  useEffect(() => {
    if (task?.status !== 'review') return
    const interval = setInterval(() => { loadTask() }, 5000)
    return () => clearInterval(interval)
  }, [task?.status])

  const loadTask = async () => {
    try {
      const res = await taskApi.getTask(id)
      setTask(res.data)
      if (res.data.github_pr_url) setPrUrl(res.data.github_pr_url)
    } catch {
      toast.error('Task not found')
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (newStatus) => {
    setActionLoading(true)
    try {
      const res = await taskApi.updateStatus(task.id, newStatus)
      setTask(res.data)
      toast.success(`Task moved to ${STATUS_CONFIG[newStatus]?.label}`)
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to update status')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSubmitPR = async () => {
    if (!prUrl.trim()) return
    setActionLoading(true)
    try {
      await taskApi.submitPR(task.id, prUrl.trim())
      await taskApi.updateStatus(task.id, 'review')

      // Trigger AI review automatically
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
        const token = localStorage.getItem('token') || sessionStorage.getItem('token') || ''
        let userId = localStorage.getItem('user_id') || ''
        try {
          const meRes = await fetch(`${backendUrl}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          if (meRes.ok) {
            const me = await meRes.json()
            userId = me.id || me.user_id || userId
          }
        } catch {}

        if (!userId) {
          toast.error('Could not identify user. Please log in again.')
          setActionLoading(false)
          return
        }

        await fetch(`${backendUrl}/api/mentor/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task_id: task.id, pr_url: prUrl.trim(), user_id: userId }),
        })
        toast.success('PR submitted! AI review started 🤖')
      } catch {
        toast.success('PR submitted for review! 🚀')
      }

      const res = await taskApi.getTask(task.id)
      setTask(res.data)
      setShowPrInput(false)
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to submit PR')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface)' }}>
      <div className="w-7 h-7 rounded-full border-2 animate-spin"
        style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
    </div>
  )

  if (!task) return null

  const status   = STATUS_CONFIG[task.status]    || STATUS_CONFIG.todo
  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'
  const dueDate   = task.due_date
    ? new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null
  const resources = task.resources ? task.resources.split('\n').filter(Boolean) : []
  const hasScore  = task.score !== null && task.score !== undefined
  const passed    = hasScore && task.score >= 70

  // Parse latest_review — stored as JSON string inside task.feedback
  let latestReview = null
  if (task.feedback) {
    try {
      const feedbackObj = typeof task.feedback === 'string'
        ? JSON.parse(task.feedback)
        : task.feedback
      // feedback is { latest_review: {...}, verdict, score, updated_at }
      latestReview = feedbackObj.latest_review || feedbackObj
    } catch {
      // feedback might be plain text (old format) — ignore parse error
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--surface)' }}>
      {/* Navbar */}
      <header className="sticky top-0 z-40 px-6 h-16 flex items-center gap-4"
        style={{ background: 'rgba(248,248,252,0.8)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/dashboard" className="btn-ghost py-2 flex items-center gap-2"
          style={{ color: 'var(--ink-soft)' }}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Dashboard
        </Link>
        <div className="w-px h-4" style={{ background: 'var(--border)' }} />
        <span className="text-sm font-medium truncate" style={{ color: 'var(--ink-muted)' }}>{task.title}</span>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="animate-fade-up space-y-5">

          {/* Main card */}
          <div className="card p-8">
            <div className="flex items-start justify-between gap-4 mb-4">
              <h1 className="text-2xl font-display" style={{ color: 'var(--ink)' }}>{task.title}</h1>
              <span className="badge shrink-0" style={{ color: status.color, background: status.bg }}>
                <span className="w-2 h-2 rounded-full inline-block mr-1.5" style={{ background: status.color }} />
                {status.label}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-6">
              <span className="badge" style={{ color: priority.color, background: priority.bg }}>{priority.label}</span>
              <span className="badge" style={{ color: 'var(--ink-soft)', background: 'var(--surface-2)' }}>
                {task.intern_role?.charAt(0).toUpperCase() + task.intern_role?.slice(1)}
              </span>
              {dueDate && (
                <span className="badge"
                  style={{ color: isOverdue ? 'var(--red)' : 'var(--ink-muted)', background: isOverdue ? 'var(--red-soft)' : 'var(--surface-2)' }}>
                  {isOverdue ? '⚠ Overdue · ' : '📅 '}Due: {dueDate}
                </span>
              )}
            </div>

            {task.description && (
              <>
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--ink-muted)' }}>Description</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{task.description}</p>
              </>
            )}
          </div>

          {/* Resources */}
          {resources.length > 0 && (
            <div className="card p-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: 'var(--ink-muted)' }}>Resources</h3>
              <div className="flex flex-col gap-2">
                {resources.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--accent)' }}>
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    {url}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* ── AI Review Result ── */}
          {hasScore && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold font-display" style={{ color: 'var(--ink)' }}>
                  AI Review Result
                </h3>
                {!passed && (
                  <span className="text-xs px-2 py-1 rounded-full font-semibold"
                    style={{ background: '#fee2e2', color: '#991b1b' }}>
                    Score below 70 — resubmit required
                  </span>
                )}
              </div>

              {/* If we have a full structured review, show it. Otherwise fallback to simple score */}
              {latestReview && (latestReview.breakdown || latestReview.blocking_issues) ? (
                <ReviewPanel review={latestReview} score={task.score} />
              ) : (
                /* Fallback: simple score banner when review_json isn't available */
                <div className="rounded-2xl p-5 flex items-center gap-5"
                  style={{ background: passed ? '#f0fdf4' : '#fff5f5', border: `1.5px solid ${passed ? '#00c896' : '#ef4444'}40` }}>
                  <ScoreRing score={task.score} />
                  <div>
                    <p className="text-lg font-black" style={{ color: passed ? '#00c896' : '#ef4444' }}>
                      {passed ? '✅ Passed' : '🔁 Needs Work'}
                    </p>
                    {task.feedback && typeof task.feedback === 'string' && !task.feedback.startsWith('{') && (
                      <p className="text-sm mt-1 leading-relaxed" style={{ color: passed ? '#065f46' : '#991b1b' }}>
                        {task.feedback}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {!passed && (
                <div className="mt-4 p-3 rounded-xl"
                  style={{ background: '#fff5f5', border: '1px solid #fecaca' }}>
                  <p className="text-sm font-medium" style={{ color: '#991b1b' }}>
                    Fix the issues above and run{' '}
                    <code style={{ background: '#fee2e2', padding: '1px 6px', borderRadius: 4 }}>internx pr</code>
                    {' '}again to resubmit.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* PR submitted — in review */}
          {task.github_pr_url && task.status === 'review' && (
            <div className="card p-6" style={{ border: '1.5px solid #dbeafe', background: 'var(--blue-soft)' }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: '#1e40af' }}>PR Submitted</h3>
              <a href={task.github_pr_url} target="_blank" rel="noopener noreferrer"
                className="text-sm font-medium break-all" style={{ color: 'var(--blue)' }}>
                {task.github_pr_url}
              </a>
            </div>
          )}

          {/* Actions */}
          <div className="card p-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-4"
              style={{ color: 'var(--ink-muted)' }}>Actions</h3>

            {/* Ask AI Mentor — always visible */}
            <Link href={`/mentor?task_id=${task.id}`}
              className="w-full flex items-center justify-center gap-2 py-3 mb-3"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                borderRadius: 12, textDecoration: 'none', color: 'white',
                fontWeight: 600, fontSize: 14,
                boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
              }}>
              🤖 Ask AI Mentor
            </Link>

            {task.status === 'todo' && (
              <button onClick={() => handleStatusChange('in_progress')} disabled={actionLoading}
                className="btn-primary w-full justify-center py-3.5">
                {actionLoading ? 'Starting...' : '▶ Start Task'}
              </button>
            )}

            {task.status === 'in_progress' && (
              showPrInput ? (
                <div className="flex flex-col gap-3">
                  <input type="url" value={prUrl} onChange={e => setPrUrl(e.target.value)}
                    placeholder="https://github.com/org/repo/pull/1"
                    className="input-field"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1.5px solid var(--border)', fontSize: '14px', outline: 'none' }}
                  />
                  <div className="flex gap-2">
                    <button onClick={handleSubmitPR} disabled={actionLoading || !prUrl.trim()}
                      className="btn-primary flex-1 justify-center py-3">
                      {actionLoading ? 'Submitting...' : 'Submit PR for Review'}
                    </button>
                    <button onClick={() => setShowPrInput(false)} className="btn-ghost px-5">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowPrInput(true)} disabled={actionLoading}
                  className="btn-primary w-full justify-center py-3.5"
                  style={{ background: 'var(--amber)', boxShadow: '0 2px 8px rgba(245,158,11,0.25)' }}>
                  Submit for Review →
                </button>
              )
            )}

            {task.status === 'review' && (task.score === null || task.score === undefined) && (
              <div className="flex items-center gap-3 p-4 rounded-xl"
                style={{ background: 'var(--amber-soft)', border: '1.5px solid #fde68a' }}>
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--amber)' }} />
                <span className="text-sm font-medium" style={{ color: '#92400e' }}>
                  Waiting for mentor review...
                </span>
              </div>
            )}

            {task.status === 'done' && (
              <div className="text-center py-4">
                <div className="text-3xl mb-2">🎉</div>
                <p className="text-sm font-semibold font-display" style={{ color: 'var(--green)' }}>Task complete!</p>
                <Link href="/dashboard"
                  className="mt-3 inline-flex items-center gap-2 text-sm font-medium"
                  style={{ color: 'var(--accent)' }}>
                  ← Back to Dashboard
                </Link>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}