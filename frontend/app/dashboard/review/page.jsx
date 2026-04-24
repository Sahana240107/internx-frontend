'use client'

// frontend/app/dashboard/review/page.jsx
// - Only shows tasks with status 'in_progress'
// - Student pastes GitHub PR link — no manual diff needed
// - Backend auto-fetches the diff from GitHub

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/store/authStore'
import api from '@/lib/api'

// ─── Rubric config (must match backend) ───────────────────────────────────────
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

// ─── Shared sub-components ────────────────────────────────────────────────────

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

// ─── Full structured review body ──────────────────────────────────────────────
// Used both in the live result and inside AttemptCard history.
function ReviewBody({ r }) {
  const bd = r.breakdown || {}
  return (
    <div className="space-y-4">

      {/* Score breakdown */}
      <div className="rounded-2xl p-4 space-y-3"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-muted)' }}>Score Breakdown</p>
        {Object.entries(BREAKDOWN_MAX).map(([key, max]) => (
          <BreakdownBar key={key} label={BREAKDOWN_LABELS[key]} score={bd[key] || 0} max={max} />
        ))}
      </div>

      {/* Strengths */}
      {r.strengths?.length > 0 && (
        <div className="rounded-2xl p-4 space-y-2"
          style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#15803d' }}>✅ What you did well</p>
          <ul className="space-y-1.5">
            {r.strengths.map((s, i) => (
              <li key={i} className="text-sm flex gap-2" style={{ color: '#166534' }}>
                <span>•</span><span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Blocking issues */}
      {r.blocking_issues?.length > 0 && (
        <div className="rounded-2xl p-4 space-y-3"
          style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#dc2626' }}>🚧 Blocking Issues</p>
          {r.blocking_issues.map((b, i) => (
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
      {r.missing_requirements?.length > 0 && (
        <div className="rounded-2xl p-4 space-y-2"
          style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#c2410c' }}>📋 Missing Requirements</p>
          <ul className="space-y-1">
            {r.missing_requirements.map((m, i) => (
              <li key={i} className="text-sm flex gap-2" style={{ color: '#9a3412' }}>
                <span>✕</span><span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Improvements */}
      {r.improvements?.length > 0 && (
        <div className="rounded-2xl p-4 space-y-2"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-muted)' }}>💡 Suggested Improvements</p>
          <ul className="space-y-2">
            {r.improvements.map((im, i) => (
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
      {r.next_steps?.length > 0 && (
        <div className="rounded-2xl p-4 space-y-2"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-muted)' }}>🎯 Next Steps</p>
          <ol className="space-y-1.5 list-none">
            {r.next_steps.map((s, i) => (
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

// ─── Attempt history card ─────────────────────────────────────────────────────
function AttemptCard({ attempt, index }) {
  const [open, setOpen] = useState(false)
  const r     = attempt.review_json || {}
  const score = attempt.score
  const color = attempt.verdict === 'pass' ? '#00c896' : '#ef4444'

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>

      {/* Header row — always visible */}
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: attempt.verdict === 'pass' ? '#e0fff7' : '#fef2f2', color }}>
            {attempt.verdict === 'pass' ? 'PASS' : 'RESUBMIT'}
          </span>
          <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Attempt #{index}</span>
          <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
            {new Date(attempt.created_at).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
            })}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {score != null
            ? <span className="text-sm font-black" style={{ color }}>{score}/100</span>
            : <span className="text-xs px-2 py-0.5 rounded-full animate-pulse"
                style={{ background: '#e0e7ff', color: '#3730a3' }}>Reviewing…</span>
          }
          <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--border)' }}>

          {/* Verdict summary bar */}
          {(r.review_summary || score != null) && (
            <div className="flex items-center gap-4 pt-4 pb-3">
              {score != null && <ScoreRing score={score} />}
              <div className="flex-1 min-w-0">
                {r.review_summary && (
                  <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>{r.review_summary}</p>
                )}
                {r.confidence != null && (
                  <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
                    {Math.round(r.confidence * 100)}% confidence
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Full structured review body */}
          {(r.breakdown || r.blocking_issues || r.strengths) ? (
            <ReviewBody r={r} />
          ) : r.review_summary ? null : (
            <p className="text-xs pt-2" style={{ color: 'var(--ink-muted)' }}>
              No detailed breakdown available for this attempt.
            </p>
          )}

          {/* PR link */}
          {attempt.pr_url && (
            <a href={attempt.pr_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs mt-3 hover:underline"
              style={{ color: 'var(--accent)' }}>
              View PR on GitHub →
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReviewPage() {
  const { user } = useAuthStore()

  const [tasks,          setTasks]          = useState([])
  const [selectedTask,   setSelected]       = useState(null)
  const [prUrl,          setPrUrl]          = useState('')
  const [submitting,     setSubmitting]     = useState(false)
  const [polling,        setPolling]        = useState(false)
  const [review,         setReview]         = useState(null)
  const [history,        setHistory]        = useState([])
  const [loadingTasks,   setLoadingTasks]   = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [error,          setError]          = useState('')
  const [fetchMsg,       setFetchMsg]       = useState('')

  // ── Load only in_progress tasks ────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    setLoadingTasks(true)
    api.get('/api/tasks/my-tasks')
      .then(res => {
        const inProgress = (res.data || []).filter(t => t.status === 'in_progress')
        setTasks(inProgress)
      })
      .catch(err => {
        console.error(err)
        setError('Could not load your tasks. Make sure you are logged in.')
      })
      .finally(() => setLoadingTasks(false))
  }, [user])

  // ── Load history when task selected ───────────────────────────────────────
  useEffect(() => {
    if (!selectedTask) return
    setReview(null)
    setHistory([])
    setPrUrl('')
    setError('')
    setFetchMsg('')
    setLoadingHistory(true)
    api.get(`/api/mentor/review/history/${selectedTask.id}`)
      .then(res => {
        const attempts = res.data?.attempts || []
        setHistory(attempts)
        if (attempts.length > 0 && attempts[0].review_json) {
          const rj = attempts[0].review_json
          setReview(typeof rj === 'string' ? JSON.parse(rj) : rj)
        }
      })
      .catch(console.error)
      .finally(() => setLoadingHistory(false))
  }, [selectedTask])

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedTask) { setError('Please select a task first.'); return }
    if (!prUrl.trim())  { setError('Please paste your GitHub PR link.'); return }
    if (!prUrl.includes('github.com') || !prUrl.includes('/pull/')) {
      setError("That doesn't look like a GitHub PR link. It should look like: https://github.com/owner/repo/pull/42")
      return
    }

    setError('')
    setFetchMsg('Fetching your PR from GitHub…')
    setSubmitting(true)

    try {
      const res = await api.post('/api/mentor/review', {
        task_id: selectedTask.id,
        pr_url:  prUrl.trim(),
        user_id: user?.id || '',
      })

      if (res.data?.status === 'error') {
        setError(res.data.message || 'GitHub fetch failed.')
        setFetchMsg('')
        return
      }

      setFetchMsg('PR fetched ✓ — AI review running…')

      // Poll task every 3s until status leaves 'review'
      setPolling(true)
      let attempts = 0
      const poll = setInterval(async () => {
        attempts++
        try {
          const taskRes = await api.get(`/api/tasks/${selectedTask.id}`)
          const t = taskRes.data
          if (t.status !== 'review' || attempts > 20) {
            clearInterval(poll)
            setPolling(false)
            setFetchMsg('')
            const histRes = await api.get(`/api/mentor/review/history/${selectedTask.id}`)
            const newAttempts = histRes.data?.attempts || []
            setHistory(newAttempts)
            if (newAttempts.length > 0 && newAttempts[0].review_json) {
              const rj = newAttempts[0].review_json
              setReview(typeof rj === 'string' ? JSON.parse(rj) : rj)
            }
            setTasks(prev => prev.map(tk => tk.id === t.id ? { ...tk, status: t.status } : tk))
            if (t.id === selectedTask.id) setSelected({ ...selectedTask, status: t.status })
            if (newAttempts.length > 0 && !newAttempts[0].review_json) {
              setError('Review completed but no result was returned. Check server logs (GROQ_API_KEY may be missing).')
            }
          }
        } catch { clearInterval(poll); setPolling(false); setFetchMsg('') }
      }, 3000)

    } catch (err) {
      setError(err?.response?.data?.detail || err?.response?.data?.message || 'Submission failed. Try again.')
      setFetchMsg('')
    } finally {
      setSubmitting(false)
    }
  }

  const verdictColor = review?.verdict === 'pass' ? '#00c896' : '#ef4444'
  const verdictBg    = review?.verdict === 'pass' ? '#e0fff7' : '#fef2f2'

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16 px-2">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black" style={{ color: 'var(--ink)' }}>AI Code Review</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>
          Select a task, paste your GitHub PR link, and get a structured review in ~15 seconds.
        </p>
      </div>

      {/* Step 1 — Task selector */}
      <div className="rounded-2xl p-5 space-y-4"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>1. Select your task</p>

        {loadingTasks && <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Loading tasks…</p>}

        {!loadingTasks && tasks.length === 0 && (
          <div className="rounded-xl px-4 py-3 text-sm"
            style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412' }}>
            No tasks currently in progress. Start a task first, then come back here to submit for review.
          </div>
        )}

        {!loadingTasks && tasks.length > 0 && (
          <div className="grid gap-2">
            {tasks.map(t => (
              <button key={t.id} onClick={() => setSelected(t)}
                className="text-left px-4 py-3 rounded-xl transition-all"
                style={{
                  background: selectedTask?.id === t.id ? 'var(--accent)' : 'var(--surface)',
                  color: selectedTask?.id === t.id ? '#fff' : 'var(--ink)',
                  border: `1px solid ${selectedTask?.id === t.id ? 'var(--accent)' : 'var(--border)'}`,
                }}>
                <p className="text-sm font-semibold">{t.title}</p>
                <p className="text-xs mt-0.5 opacity-60 line-clamp-1">{t.description?.slice(0, 100)}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Step 2 — PR URL input */}
      {selectedTask && (
        <div className="rounded-2xl p-5 space-y-4"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>2. Paste your GitHub Pull Request link</p>
            <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
              Go to your repo on GitHub → Pull Requests → open your PR → copy the URL from the browser.
            </p>
          </div>

          <div className="rounded-xl px-3 py-2 text-xs font-mono"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink-muted)' }}>
            Example: <span style={{ color: 'var(--accent)' }}>https://github.com/your-org/repo-name/pull/5</span>
          </div>

          <input
            type="url"
            value={prUrl}
            onChange={e => { setPrUrl(e.target.value); setError('') }}
            placeholder="https://github.com/owner/repo/pull/42"
            className="w-full px-3 py-3 rounded-xl text-sm"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)', outline: 'none' }}
          />

          {error && (
            <p className="text-xs font-medium px-3 py-2 rounded-xl"
              style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
              {error}
            </p>
          )}

          {fetchMsg && (
            <p className="text-xs font-medium px-3 py-2 rounded-xl flex items-center gap-2"
              style={{ background: '#e0fff7', color: '#065f46', border: '1px solid #a7f3d0' }}>
              <span className="animate-spin inline-block w-3 h-3 rounded-full border-2"
                style={{ borderColor: '#065f46', borderTopColor: 'transparent' }} />
              {fetchMsg}
            </p>
          )}

          <button onClick={handleSubmit} disabled={submitting || polling}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all"
            style={{
              background: submitting || polling ? 'var(--border)' : 'var(--accent)',
              color: submitting || polling ? 'var(--ink-muted)' : '#fff',
              cursor: submitting || polling ? 'not-allowed' : 'pointer',
            }}>
            {submitting ? 'Fetching PR…' : polling ? '⏳ AI is reviewing your code…' : '🔍 Submit for Review'}
          </button>
        </div>
      )}

      {/* ── Review result ── */}
      {review && (
        <div className="space-y-4">

          {/* Verdict banner */}
          <div className="rounded-2xl p-5 flex items-center gap-5"
            style={{ background: verdictBg, border: `1.5px solid ${verdictColor}40` }}>
            <ScoreRing score={review.score} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-lg font-black" style={{ color: verdictColor }}>
                  {review.verdict === 'pass' ? '✅ Passed' : '🔁 Needs Work'}
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

          {/* Full structured body */}
          <ReviewBody r={review} />
        </div>
      )}

      {/* ── Attempt history ── */}
      {selectedTask && (
        <div className="space-y-2">
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            Review History
            {history.length > 0 && (
              <span className="ml-1 font-normal" style={{ color: 'var(--ink-muted)' }}>
                ({history.length} attempt{history.length !== 1 ? 's' : ''})
              </span>
            )}
          </p>
          {loadingHistory && <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>Loading…</p>}
          {!loadingHistory && history.length === 0 && (
            <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>No review attempts yet for this task.</p>
          )}
          {history.map((attempt, i) => (
            <AttemptCard key={attempt.id} attempt={attempt} index={history.length - i} />
          ))}
        </div>
      )}
    </div>
  )
}