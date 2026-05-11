'use client'

// frontend/app/dashboard/review/page.jsx
// Role-aware review submission:
//   frontend  → PR URL + optional screenshot upload
//   backend   → PR URL (standard flow)
//   ui_ux     → Design deliverable form (Figma URL + image upload + handoff checklist + explanation)
//   tester    → QA submission form (bug report | test plan | automation PR)
//              test_plan: test cases submitted as an uploaded document (.txt / .md / .pdf)

import { useEffect, useState, useRef } from 'react'
import { useAuthStore } from '@/lib/store/authStore'
import api from '@/lib/api'

// ─── Role rubric config ───────────────────────────────────────────────────────
const ROLE_RUBRICS = {
  frontend: {
    task_completion:          { label: 'Task Completion',           max: 35 },
    correctness_reliability:  { label: 'Correctness & Reliability', max: 20 },
    code_quality:             { label: 'Code Quality',              max: 15 },
    security_best_practices:  { label: 'Security & Best Practices', max:  8 },
    testing_signals:          { label: 'Testing Signals',           max:  7 },
    performance_reliability:  { label: 'Performance',               max:  8 },
    maintainability:          { label: 'Maintainability',           max:  7 },
  },
  backend: {
    task_completion:          { label: 'Task Completion',           max: 30 },
    correctness_reliability:  { label: 'Correctness & Reliability', max: 25 },
    code_quality:             { label: 'Code Quality',              max: 15 },
    security_best_practices:  { label: 'Security & Best Practices', max: 15 },
    testing_signals:          { label: 'Testing Signals',           max:  8 },
    performance_reliability:  { label: 'Performance',               max:  7 },
  },
  ui_ux: {
    task_completion:          { label: 'Task Completion',           max: 40 },
    visual_design_quality:    { label: 'Visual Design Quality',     max: 20 },
    accessibility_compliance: { label: 'Accessibility',             max: 15 },
    handoff_completeness:     { label: 'Handoff Completeness',      max: 15 },
    responsiveness:           { label: 'Responsiveness',            max: 10 },
  },
  tester: {
    task_completion:          { label: 'Task Completion',           max: 25 },
    correctness_reliability:  { label: 'Correctness & Reliability', max: 20 },
    code_quality:             { label: 'Report / Plan Quality',     max: 15 },
    security_best_practices:  { label: 'Security Best Practices',   max: 10 },
    testing_signals:          { label: 'Testing Signals',           max: 30 },
  },
  default: {
    task_completion:          { label: 'Task Completion',           max: 40 },
    correctness_reliability:  { label: 'Correctness & Reliability', max: 25 },
    code_quality:             { label: 'Code Quality',              max: 20 },
    security_best_practices:  { label: 'Security & Best Practices', max: 10 },
    testing_signals:          { label: 'Testing Signals',           max:  5 },
  },
}

const ROLE_DISPLAY = {
  frontend: 'Frontend Developer',
  backend:  'Backend Developer',
  ui_ux:    'UI/UX Developer',
  tester:   'Tester / QA',
  default:  'Software Engineer',
}

const AUDIT_META = {
  security:        { label: 'Security & Breach',         icon: '🛡️',  description: 'Secrets, PII, unsafe transport' },
  governance:      { label: 'Enterprise Governance',     icon: '📋',  description: 'Naming, deps, boilerplate' },
  maintainability: { label: 'Maintainability',           icon: '🔧',  description: 'Complexity, dead code, docs' },
  performance:     { label: 'Performance & Reliability', icon: '⚡',  description: 'N+1, memory leaks, error handling' },
}

const AUDIT_STATUS_META = {
  block: { emoji: '🔴', label: 'BLOCK', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  warn:  { emoji: '🟡', label: 'WARN',  bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
  pass:  { emoji: '🟢', label: 'PASS',  bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
}

const HANDOFF_CHECKLIST_ITEMS = [
  { key: 'spacing',       label: 'Spacing & layout documented' },
  { key: 'colors',        label: 'Color tokens / palette defined' },
  { key: 'typography',    label: 'Typography scale specified' },
  { key: 'components',    label: 'Component states covered (hover, active, disabled)' },
  { key: 'assets',        label: 'Assets exported at correct resolutions' },
  { key: 'accessibility', label: 'Accessibility annotations present' },
  { key: 'responsive',    label: 'Responsive breakpoints defined' },
  { key: 'interactions',  label: 'Interactions / animations specified' },
]

const QA_SUBMISSION_TYPES = [
  { key: 'bug_report',    label: '🐛 Bug Report',       desc: 'Document a bug found during testing' },
  { key: 'test_plan',     label: '📋 Test Plan',         desc: 'Structured test plan with test cases — upload a doc' },
  { key: 'automation_pr', label: '🤖 Automation PR',    desc: 'Automated test code via GitHub PR' },
]

// ─── Shared sub-components ────────────────────────────────────────────────────

function ScoreRing({ score }) {
  const radius = 36, circ = 2 * Math.PI * radius
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

function RoleBadge({ role }) {
  return (
    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
      style={{ background: 'var(--accent)', color: '#fff', opacity: 0.9 }}>
      {ROLE_DISPLAY[role] || role}
    </span>
  )
}

function BreakdownBar({ label, score, max }) {
  const pct   = max > 0 ? Math.round((score / max) * 100) : 0
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

function AuditTable({ auditReport }) {
  const [expanded, setExpanded] = useState({})
  if (!auditReport) return null
  const toggle = (cat) => setExpanded(p => ({ ...p, [cat]: !p[cat] }))
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <div className="px-4 py-3 flex items-center justify-between"
        style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
        <p className="text-sm font-bold" style={{ color: 'var(--ink)' }}>🏢 Enterprise Audit Report</p>
        <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>4 review layers</p>
      </div>
      {Object.entries(AUDIT_META).map(([cat, meta]) => {
        const data = auditReport[cat] || {}
        const sm = AUDIT_STATUS_META[data.status || 'pass'] || AUDIT_STATUS_META.pass
        const findings = data.findings || []
        const isOpen = expanded[cat]
        return (
          <div key={cat} style={{ borderBottom: '1px solid var(--border)' }}>
            <button onClick={() => findings.length > 0 && toggle(cat)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all"
              style={{ cursor: findings.length > 0 ? 'pointer' : 'default', background: isOpen ? 'var(--surface-2)' : 'transparent' }}>
              <span className="flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full min-w-[56px] text-center"
                style={{ background: sm.bg, color: sm.color, border: `1px solid ${sm.border}` }}>
                {sm.emoji} {sm.label}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{meta.icon} {meta.label}</p>
                <p className="text-xs truncate" style={{ color: 'var(--ink-muted)' }}>{data.summary || meta.description}</p>
              </div>
              {findings.length > 0 && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--border)', color: 'var(--ink-muted)' }}>
                    {findings.length} finding{findings.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>{isOpen ? '▲' : '▼'}</span>
                </div>
              )}
            </button>
            {isOpen && findings.length > 0 && (
              <div className="px-4 pb-4 space-y-3"
                style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--border)' }}>
                {findings.map((f, i) => (
                  <div key={i} className="rounded-xl p-3 space-y-2 mt-3"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <SeverityBadge severity={f.severity} />
                      {f.cwe && <code className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                        style={{ background: '#f1f5f9', color: '#475569' }}>{f.cwe}</code>}
                    </div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{f.title}</p>
                    {f.detail && <p className="text-xs font-mono px-2 py-1.5 rounded-lg whitespace-pre-wrap break-words"
                      style={{ background: '#f8fafc', color: '#334155', border: '1px solid #e2e8f0' }}>{f.detail}</p>}
                    {f.fix && <p className="text-xs px-2 py-1.5 rounded-lg" style={{ background: '#f0fdf4', color: '#166534' }}>
                      <span className="font-semibold">Fix: </span>{f.fix}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SecurityIncidentBanner({ blockingIssues }) {
  const secBlocks = (blockingIssues || []).filter(
    b => b.severity === 'critical' && (b.category === 'security' || b.issue?.includes('SECURITY'))
  )
  if (!secBlocks.length) return null
  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: '#fef2f2', border: '2px solid #dc2626' }}>
      <div className="flex items-center gap-2">
        <span className="text-lg">🚨</span>
        <div>
          <p className="text-sm font-black" style={{ color: '#dc2626' }}>SECURITY INCIDENT — Merge Blocked</p>
          <p className="text-xs mt-0.5" style={{ color: '#7f1d1d' }}>Critical secret(s) detected. Fix before continuing.</p>
        </div>
      </div>
      {secBlocks.map((b, i) => (
        <div key={i} className="rounded-xl p-3 space-y-1.5" style={{ background: '#fff', border: '1px solid #fecaca' }}>
          <p className="text-sm font-semibold" style={{ color: '#dc2626' }}>{b.issue}</p>
          {b.file && <code className="text-xs px-1.5 py-0.5 rounded block"
            style={{ background: '#f1f5f9', color: '#475569' }}>{b.file}{b.line ? `:${b.line}` : ''}</code>}
          {b.fix && <p className="text-xs px-2 py-1.5 rounded-lg" style={{ background: '#f0fdf4', color: '#166534' }}>
            <span className="font-semibold">Fix: </span>{b.fix}</p>}
        </div>
      ))}
    </div>
  )
}

const ROLE_DISPLAY_SHORT = {
  frontend: '🖥️ Frontend',
  backend:  '⚙️ Backend',
  ui_ux:    '🎨 UI/UX',
  tester:   '🧪 Tester',
}

const PRIORITY_STYLE = {
  critical: { bg: '#fef2f2', border: '#dc2626', color: '#dc2626', badge: '#dc2626' },
  high:     { bg: '#fff7ed', border: '#ea580c', color: '#9a3412', badge: '#ea580c' },
  medium:   { bg: '#fefce8', border: '#ca8a04', color: '#854d0e', badge: '#ca8a04' },
  low:      { bg: '#f0fdf4', border: '#16a34a', color: '#166534', badge: '#16a34a' },
}

function TicketRaisedBanner({ ticket }) {
  // ticket = review_json.ticket_raised
  // null / undefined  → bug not ticketable → show "not ticketed" note
  // { ticket_id, notified_users, affected_roles, ticket_priority, ticket_title, error }

  // Bug was scored but not ticketable
  if (!ticket) return null

  if (!ticket.ticket_id) {
    // Ticketable intent but creation failed (or not credible enough)
    const failed = ticket.error
    return (
      <div className="rounded-2xl p-4 space-y-1"
        style={{ background: '#fefce8', border: '1px solid #fde68a' }}>
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#854d0e' }}>
          🎫 Ticket Not Raised
        </p>
        <p className="text-sm" style={{ color: '#92400e' }}>
          {failed
            ? `The ticket could not be created: ${failed}`
            : 'The AI determined this bug is not credible enough to raise a formal ticket yet. Improve the report and resubmit.'}
        </p>
      </div>
    )
  }

  const ps = PRIORITY_STYLE[ticket.ticket_priority] || PRIORITY_STYLE.medium
  const rolesLabel = (ticket.affected_roles || [])
    .map(r => ROLE_DISPLAY_SHORT[r] || r)
    .join(', ')

  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{ background: ps.bg, border: `1.5px solid ${ps.border}` }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-lg">🎫</span>
        <p className="text-sm font-black" style={{ color: ps.color }}>
          Ticket Raised Automatically
        </p>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: ps.badge, color: '#fff' }}
        >
          {(ticket.ticket_priority || 'medium').toUpperCase()}
        </span>
      </div>

      {/* Ticket title */}
      {ticket.ticket_title && (
        <p className="text-sm font-semibold" style={{ color: ps.color }}>
          {ticket.ticket_title}
        </p>
      )}

      {/* Meta row */}
      <div className="flex flex-wrap gap-3 text-xs" style={{ color: ps.color }}>
        {rolesLabel && (
          <span>
            <span className="font-semibold">Assigned to: </span>{rolesLabel}
          </span>
        )}
        {ticket.notified_count > 0 && (
          <span>
            <span className="font-semibold">Notified: </span>
            {ticket.notified_count} team member{ticket.notified_count !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Link */}
      {ticket.ticket_id && (
        <a
          href={`/dashboard/ticket/${ticket.ticket_id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold underline"
          style={{ color: ps.color }}
        >
          View ticket →
        </a>
      )}
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// UPDATED: ReviewBody — add TicketRaisedBanner at the top
// ─────────────────────────────────────────────────────────────────────────────

function ReviewBody({ r }) {
  const bd     = r.breakdown || {}
  const role   = r.intern_role || 'default'
  const rubric = r.rubric_maxes
    ? Object.fromEntries(
        Object.entries(r.rubric_maxes).map(([k, v]) => [
          k,
          { label: ROLE_RUBRICS[role]?.[k]?.label || k, max: v },
        ])
      )
    : ROLE_RUBRICS[role] || ROLE_RUBRICS.default

  return (
    <div className="space-y-4">
      {/* ── NEW: ticket banner (bug_report only) ── */}
      {r.submission_type === 'bug_report' && r.ticket_raised !== undefined && (
        <TicketRaisedBanner ticket={r.ticket_raised} />
      )}

      {/* ── existing: security incident banner ── */}
      <SecurityIncidentBanner blockingIssues={r.blocking_issues} />

      {/* Score breakdown */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-muted)' }}>Score Breakdown</p>
          <RoleBadge role={role} />
        </div>
        {Object.entries(rubric).map(([key, cfg]) => (
          <BreakdownBar key={key} label={cfg.label} score={bd[key] || 0} max={cfg.max} />
        ))}
      </div>

      {r.audit_report && <AuditTable auditReport={r.audit_report} />}

      {r.strengths?.length > 0 && (
        <div className="rounded-2xl p-4 space-y-2" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#15803d' }}>✅ What you did well</p>
          <ul className="space-y-1.5">
            {r.strengths.map((s, i) => (
              <li key={i} className="text-sm flex gap-2" style={{ color: '#166534' }}><span>•</span><span>{s}</span></li>
            ))}
          </ul>
        </div>
      )}

      {r.blocking_issues?.filter(b => !(b.severity === 'critical' && b.issue?.includes('SECURITY'))).length > 0 && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#dc2626' }}>🚧 Blocking Issues</p>
          {r.blocking_issues.filter(b => !(b.severity === 'critical' && b.issue?.includes('SECURITY'))).map((b, i) => (
            <div key={i} className="rounded-xl p-3 space-y-1.5" style={{ background: '#fff', border: '1px solid #fecaca' }}>
              <div className="flex items-center gap-2 flex-wrap">
                <SeverityBadge severity={b.severity} />
                {b.file && <code className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#f1f5f9', color: '#475569' }}>{b.file}{b.line ? `:${b.line}` : ''}</code>}
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{b.issue}</p>
              {b.why_it_matters && <p className="text-xs" style={{ color: 'var(--ink-muted)' }}><span className="font-semibold">Why it matters: </span>{b.why_it_matters}</p>}
              {b.fix && <p className="text-xs px-2 py-1.5 rounded-lg" style={{ background: '#f0fdf4', color: '#166534' }}><span className="font-semibold">Fix: </span>{b.fix}</p>}
            </div>
          ))}
        </div>
      )}

      {r.missing_requirements?.length > 0 && (
        <div className="rounded-2xl p-4 space-y-2" style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#c2410c' }}>📋 Missing Requirements</p>
          <ul className="space-y-1">
            {r.missing_requirements.map((m, i) => (
              <li key={i} className="text-sm flex gap-2" style={{ color: '#9a3412' }}><span>✕</span><span>{m}</span></li>
            ))}
          </ul>
        </div>
      )}

      {r.improvements?.length > 0 && (
        <div className="rounded-2xl p-4 space-y-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-muted)' }}>💡 Suggested Improvements</p>
          <ul className="space-y-2">
            {r.improvements.map((im, i) => (
              <li key={i} className="text-sm" style={{ color: 'var(--ink-soft)' }}>
                {im.priority && <span className="font-semibold text-xs uppercase mr-1" style={{ color: im.priority === 'high' ? '#ea580c' : '#ca8a04' }}>[{im.priority}]</span>}
                {im.item || im}
                {im.expected_outcome && <span className="block text-xs mt-0.5" style={{ color: 'var(--ink-muted)' }}>→ {im.expected_outcome}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {r.next_steps?.length > 0 && (
        <div className="rounded-2xl p-4 space-y-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
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

function AttemptCard({ attempt, index }) {
  const [open, setOpen] = useState(false)
  const r     = attempt.review_json || {}
  const score = attempt.score
  const color = attempt.verdict === 'pass' ? '#00c896' : '#ef4444'
  const role  = r.intern_role || 'default'

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: attempt.verdict === 'pass' ? '#e0fff7' : '#fef2f2', color }}>
            {attempt.verdict === 'pass' ? 'PASS' : 'RESUBMIT'}
          </span>
          <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Attempt #{index}</span>
          {r.submission_type && r.submission_type !== 'pr' && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)', border: '1px solid var(--border)' }}>
              {r.submission_type.replace('_', ' ')}
            </span>
          )}
          {/* ── NEW: ticket raised chip ── */}
          {r.ticket_raised?.ticket_id && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: '#fef9c3', color: '#854d0e', border: '1px solid #fde68a' }}>
              🎫 Ticket raised
            </span>
          )}
          <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
            {new Date(attempt.created_at).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
            })}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {score != null
            ? <span className="text-sm font-black" style={{ color }}>{score}/100</span>
            : <span className="text-xs px-2 py-0.5 rounded-full animate-pulse" style={{ background: '#e0e7ff', color: '#3730a3' }}>Reviewing…</span>}
          {r.audit_report && (
            <div className="hidden sm:flex gap-1">
              {Object.entries(r.audit_report).map(([cat, data]) => {
                const sm = AUDIT_STATUS_META[data?.status] || AUDIT_STATUS_META.pass
                return (
                  <span key={cat} title={AUDIT_META[cat]?.label}
                    className="text-[10px] w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: sm.bg }}>
                    {sm.emoji}
                  </span>
                )
              })}
            </div>
          )}
          <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--border)' }}>
          {(r.review_summary || score != null) && (
            <div className="flex items-center gap-4 pt-4 pb-3">
              {score != null && <ScoreRing score={score} />}
              <div className="flex-1 min-w-0">
                {r.review_summary && <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>{r.review_summary}</p>}
                {r.confidence != null && (
                  <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
                    {Math.round(r.confidence * 100)}% confidence
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── NEW: ticket banner in history card ── */}
          {r.submission_type === 'bug_report' && r.ticket_raised !== undefined && (
            <div className="mb-4">
              <TicketRaisedBanner ticket={r.ticket_raised} />
            </div>
          )}

          {(r.breakdown || r.blocking_issues || r.strengths || r.audit_report) && (
            <ReviewBody r={r} />
          )}

          {attempt.pr_url && !attempt.pr_url.startsWith('(') && (
            <a href={attempt.pr_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs mt-3 hover:underline"
              style={{ color: 'var(--accent)' }}>
              View on GitHub →
            </a>
          )}
        </div>
      )}
    </div>
  )
}
// ─── Role-specific form components ───────────────────────────────────────────

const fieldBase = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  color: 'var(--ink)',
  outline: 'none',
}

function Label({ children }) {
  return <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--ink-soft)' }}>{children}</p>
}

function ErrorBox({ message }) {
  return (
    <p className="text-xs font-medium px-3 py-2 rounded-xl"
      style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
      {message}
    </p>
  )
}

// ─── Document upload helper (used by test plan + future forms) ────────────────

/**
 * Reads a .txt or .md file as plain text, or a .pdf as a text extraction stub.
 * Returns { text, name, size } or throws.
 */
async function readDocumentFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  // Find this in readDocumentFile:
  if (ext === 'pdf') {
    return { text: `[PDF document uploaded: ${file.name}]`, name: file.name, size: file.size }
  }

// Change to — extract text properly, or warn user:
  if (ext === 'pdf') {
    // PDFs need server-side extraction. Warn user to use .txt or .md instead.
    alert('PDF content cannot be read directly. Please convert to .txt or .md for best results. Your filename will be noted but content will not be reviewed.')
    return { text: `[PDF uploaded: ${file.name} — content not extractable client-side. User should resubmit as .txt or .md]`, name: file.name, size: file.size }
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve({ text: e.target.result, name: file.name, size: file.size })
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsText(file)
  })
}

function DocUploadZone({ doc, onUpload, onRemove, accept = '.txt,.md,.pdf', label }) {
  const ref = useRef()
  return (
    <div>
      {label && <Label>{label}</Label>}
      <div
        onClick={() => ref.current?.click()}
        className="rounded-xl p-4 text-center cursor-pointer transition-all"
        style={{
          border: '2px dashed var(--border)',
          background: doc ? '#f0fdf4' : 'var(--surface)',
        }}
      >
        {doc ? (
          <div className="space-y-1">
            <p className="text-sm font-semibold" style={{ color: '#16a34a' }}>
              📄 {doc.name}
              <span className="font-normal text-xs ml-2 opacity-70">
                ({Math.round(doc.size / 1024)} KB)
              </span>
            </p>
            <button
              onClick={e => { e.stopPropagation(); onRemove() }}
              className="text-xs underline"
              style={{ color: '#dc2626' }}
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-2xl">📄</p>
            <p className="text-sm font-medium" style={{ color: 'var(--ink-muted)' }}>
              Click to upload your document
            </p>
            <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
              .txt · .md · .pdf — max 2 MB
            </p>
          </div>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={async e => {
          const file = e.target.files?.[0]
          if (!file) return
          if (file.size > 2 * 1024 * 1024) { alert('File too large — max 2 MB'); return }
          try {
            const result = await readDocumentFile(file)
            onUpload(result)
          } catch {
            alert('Could not read file. Try a .txt or .md file.')
          }
        }}
      />
    </div>
  )
}

// Frontend: PR URL + optional screenshot
function FrontendForm({ prUrl, setPrUrl, screenshot, setScreenshot, error }) {
  const fileRef = useRef()
  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setScreenshot({ base64: ev.target.result.split(',')[1], mime: file.type, name: file.name })
    reader.readAsDataURL(file)
  }
  return (
    <div className="space-y-4">
      <div>
        <Label>GitHub Pull Request URL *</Label>
        <div className="rounded-xl px-3 py-2 text-xs font-mono mb-2"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink-muted)' }}>
          Example: <span style={{ color: 'var(--accent)' }}>https://github.com/owner/repo/pull/42</span>
        </div>
        <input type="url" value={prUrl} onChange={e => setPrUrl(e.target.value)}
          placeholder="https://github.com/owner/repo/pull/42"
          className="w-full px-3 py-3 rounded-xl text-sm" style={fieldBase} />
      </div>
      <div>
        <Label>Screenshot / Preview <span className="font-normal opacity-60">(optional — helps the reviewer see your UI)</span></Label>
        <div onClick={() => fileRef.current?.click()}
          className="rounded-xl p-4 text-center cursor-pointer transition-all"
          style={{ border: '2px dashed var(--border)', background: screenshot ? '#f0fdf4' : 'var(--surface)' }}>
          {screenshot ? (
            <div className="space-y-1">
              <p className="text-sm font-semibold" style={{ color: '#16a34a' }}>✅ {screenshot.name}</p>
              <button onClick={e => { e.stopPropagation(); setScreenshot(null) }} className="text-xs underline" style={{ color: '#dc2626' }}>Remove</button>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-2xl">📸</p>
              <p className="text-sm font-medium" style={{ color: 'var(--ink-muted)' }}>Click to upload a screenshot</p>
              <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>PNG, JPG, WEBP — max 5MB</p>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
      {error && <ErrorBox message={error} />}
    </div>
  )
}

// Backend: PR only
function BackendForm({ prUrl, setPrUrl, error }) {
  return (
    <div className="space-y-4">
      <div>
        <Label>GitHub Pull Request URL *</Label>
        <div className="rounded-xl px-3 py-2 text-xs font-mono mb-2"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink-muted)' }}>
          Example: <span style={{ color: 'var(--accent)' }}>https://github.com/owner/repo/pull/42</span>
        </div>
        <input type="url" value={prUrl} onChange={e => setPrUrl(e.target.value)}
          placeholder="https://github.com/owner/repo/pull/42"
          className="w-full px-3 py-3 rounded-xl text-sm" style={fieldBase} />
        <p className="text-xs mt-2" style={{ color: 'var(--ink-muted)' }}>
          The AI will fetch your diff and run a 4-layer enterprise audit — Security · Governance · Maintainability · Performance.
        </p>
      </div>
      {error && <ErrorBox message={error} />}
    </div>
  )
}

// UI/UX: Design form
function DesignForm({ fields, setFields, error }) {
  const fileRef = useRef()
  const set = (key, val) => setFields(f => ({ ...f, [key]: val }))
  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => set('image', { base64: ev.target.result.split(',')[1], mime: file.type, name: file.name })
    reader.readAsDataURL(file)
  }
  const toggleCheck = (key) => setFields(f => ({ ...f, checklist: { ...f.checklist, [key]: !f.checklist?.[key] } }))
  const checked      = fields.checklist || {}
  const checkedCount = Object.values(checked).filter(Boolean).length

  return (
    <div className="space-y-5">
      <div className="rounded-xl px-4 py-3 text-xs space-y-1"
        style={{ background: '#f5f3ff', border: '1px solid #e9d5ff', color: '#6b21a8' }}>
        <p className="font-bold">🎨 UI/UX Design Submission</p>
        <p>No PR needed. Share your Figma link, upload screenshots, complete the handoff checklist, and explain your decisions.</p>
      </div>

      <div>
        <Label>Figma File / Prototype URL</Label>
        <input type="url" value={fields.figmaUrl || ''} onChange={e => set('figmaUrl', e.target.value)}
          placeholder="https://www.figma.com/file/..."
          className="w-full px-3 py-3 rounded-xl text-sm" style={fieldBase} />
      </div>

      <div>
        <Label>Design Screenshot / Export <span className="font-normal opacity-60">(PNG, JPG, WEBP)</span></Label>
        <div onClick={() => fileRef.current?.click()}
          className="rounded-xl p-4 text-center cursor-pointer transition-all"
          style={{ border: '2px dashed var(--border)', background: fields.image ? '#f0fdf4' : 'var(--surface)' }}>
          {fields.image ? (
            <div className="space-y-1">
              <p className="text-sm font-semibold" style={{ color: '#16a34a' }}>✅ {fields.image.name}</p>
              <button onClick={e => { e.stopPropagation(); set('image', null) }} className="text-xs underline" style={{ color: '#dc2626' }}>Remove</button>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-2xl">🖼️</p>
              <p className="text-sm font-medium" style={{ color: 'var(--ink-muted)' }}>Upload design export</p>
              <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>Max 5MB</p>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Handoff Checklist</Label>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: checkedCount === HANDOFF_CHECKLIST_ITEMS.length ? '#f0fdf4' : 'var(--surface-2)',
              color: checkedCount === HANDOFF_CHECKLIST_ITEMS.length ? '#16a34a' : 'var(--ink-muted)',
              border: '1px solid var(--border)'
            }}>
            {checkedCount}/{HANDOFF_CHECKLIST_ITEMS.length} items
          </span>
        </div>
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {HANDOFF_CHECKLIST_ITEMS.map((item, i) => (
            <button key={item.key} onClick={() => toggleCheck(item.key)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all"
              style={{
                borderBottom: i < HANDOFF_CHECKLIST_ITEMS.length - 1 ? '1px solid var(--border)' : 'none',
                background: checked[item.key] ? '#f0fdf4' : 'var(--surface)',
              }}>
              <span className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-xs font-bold"
                style={{ background: checked[item.key] ? '#16a34a' : 'var(--border)', color: '#fff' }}>
                {checked[item.key] ? '✓' : ''}
              </span>
              <span className="text-sm" style={{ color: checked[item.key] ? '#166534' : 'var(--ink-soft)' }}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Explain your design decisions *</Label>
        <textarea value={fields.explanation || ''} onChange={e => set('explanation', e.target.value)}
          placeholder="Walk the reviewer through your key design decisions. What did you prioritise? What trade-offs did you make? How did you approach accessibility and responsiveness?"
          rows={5} className="w-full px-3 py-3 rounded-xl text-sm resize-none" style={fieldBase} />
      </div>

      {error && <ErrorBox message={error} />}
    </div>
  )
}

// ─── Tester form ─────────────────────────────────────────────────────────────
// test_plan section now uses document upload instead of a raw textarea.

function TesterForm({ qaType, setQaType, fields, setFields, error }) {
  const set = (key, val) => setFields(f => ({ ...f, [key]: val }))

  return (
    <div className="space-y-5">
      <div className="rounded-xl px-4 py-3 text-xs space-y-1"
        style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e' }}>
        <p className="font-bold">🧪 QA Submission</p>
        <p>Choose your submission type. Each uses a tester-specific rubric that weights testing quality heavily.</p>
      </div>

      <div>
        <Label>Submission Type *</Label>
        <div className="grid grid-cols-1 gap-2">
          {QA_SUBMISSION_TYPES.map(t => (
            <button key={t.key} onClick={() => setQaType(t.key)}
              className="text-left px-4 py-3 rounded-xl transition-all"
              style={{
                background: qaType === t.key ? 'var(--accent)' : 'var(--surface)',
                color: qaType === t.key ? '#fff' : 'var(--ink)',
                border: `1.5px solid ${qaType === t.key ? 'var(--accent)' : 'var(--border)'}`,
              }}>
              <p className="text-sm font-bold">{t.label}</p>
              <p className="text-xs mt-0.5 opacity-70">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Bug Report ── */}
      {qaType === 'bug_report' && (
        <div className="space-y-4 rounded-2xl p-4"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--ink-muted)' }}>🐛 Bug Report Details</p>
          <div>
            <Label>Bug Title *</Label>
            <input type="text" value={fields.bugTitle || ''} onChange={e => set('bugTitle', e.target.value)}
              placeholder="Short, descriptive title (e.g. 'Login button unresponsive on mobile Safari')"
              className="w-full px-3 py-2.5 rounded-xl text-sm" style={fieldBase} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Severity</Label>
              <select value={fields.bugSeverity || ''} onChange={e => set('bugSeverity', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm" style={fieldBase}>
                <option value="">Select…</option>
                <option value="critical">🔴 Critical — app broken</option>
                <option value="high">🟠 High — major feature broken</option>
                <option value="medium">🟡 Medium — partial functionality</option>
                <option value="low">🟢 Low — cosmetic / minor</option>
              </select>
            </div>
            <div>
              <Label>Environment</Label>
              <input type="text" value={fields.bugEnvironment || ''} onChange={e => set('bugEnvironment', e.target.value)}
                placeholder="e.g. Chrome 124, macOS" className="w-full px-3 py-2.5 rounded-xl text-sm" style={fieldBase} />
            </div>
          </div>
          <div>
            <Label>Steps to Reproduce *</Label>
            <textarea value={fields.bugSteps || ''} onChange={e => set('bugSteps', e.target.value)}
              placeholder={"1. Go to /login\n2. Enter valid email + wrong password\n3. Click 'Login'\n4. Observe…"}
              rows={5} className="w-full px-3 py-3 rounded-xl text-sm resize-none" style={fieldBase} />
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label>Expected Behaviour</Label>
              <input type="text" value={fields.bugExpected || ''} onChange={e => set('bugExpected', e.target.value)}
                placeholder="What should happen?" className="w-full px-3 py-2.5 rounded-xl text-sm" style={fieldBase} />
            </div>
            <div>
              <Label>Actual Behaviour</Label>
              <input type="text" value={fields.bugActual || ''} onChange={e => set('bugActual', e.target.value)}
                placeholder="What actually happens?" className="w-full px-3 py-2.5 rounded-xl text-sm" style={fieldBase} />
            </div>
          </div>
        </div>
      )}

      {/* ── Test Plan — document upload ── */}
      {qaType === 'test_plan' && (
        <div className="space-y-4 rounded-2xl p-4"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--ink-muted)' }}>📋 Test Plan Details</p>

          <div>
            <Label>Scope *</Label>
            <input type="text" value={fields.testScope || ''} onChange={e => set('testScope', e.target.value)}
              placeholder="e.g. User authentication module — login, registration, password reset"
              className="w-full px-3 py-2.5 rounded-xl text-sm" style={fieldBase} />
          </div>

          <div>
            <Label>Coverage Areas</Label>
            <input type="text" value={fields.testCoverage || ''} onChange={e => set('testCoverage', e.target.value)}
              placeholder="e.g. Happy paths, edge cases, error states, security, performance"
              className="w-full px-3 py-2.5 rounded-xl text-sm" style={fieldBase} />
          </div>

          {/* ── Document upload replaces the test cases textarea ── */}
          <DocUploadZone
            doc={fields.testCasesDoc || null}
            onUpload={doc => set('testCasesDoc', doc)}
            onRemove={() => set('testCasesDoc', null)}
            label="Test Cases Document * (.txt · .md · .pdf)"
            accept=".txt,.md,.pdf"
          />

          {/* Hint shown after upload */}
          {fields.testCasesDoc && (
            <div className="rounded-xl px-3 py-2 text-xs space-y-0.5"
              style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }}>
              <p className="font-semibold">✅ Document ready for review</p>
              <p className="opacity-70">
                The AI will read your test cases from <span className="font-mono">{fields.testCasesDoc.name}</span> and score them against the task requirements.
              </p>
            </div>
          )}

          {/* Tip for document format */}
          {!fields.testCasesDoc && (
            <div className="rounded-xl px-3 py-2 text-xs"
              style={{ background: '#fefce8', border: '1px solid #fde68a', color: '#854d0e' }}>
              <p className="font-semibold mb-1">💡 Recommended format (given / when / then)</p>
              <pre className="whitespace-pre-wrap font-mono text-[10px] opacity-80">{`1. Given a new user
   When they submit valid credentials
   Then they are redirected to /dashboard

2. Given an existing user
   When they submit an incorrect password
   Then a clear error message appears`}</pre>
            </div>
          )}
        </div>
      )}

      {/* ── Automation PR ── */}
      {qaType === 'automation_pr' && (
        <div className="space-y-4 rounded-2xl p-4"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--ink-muted)' }}>🤖 Automation PR Details</p>
          <div>
            <Label>GitHub PR URL *</Label>
            <div className="rounded-xl px-3 py-2 text-xs font-mono mb-2"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink-muted)' }}>
              Example: <span style={{ color: 'var(--accent)' }}>https://github.com/owner/repo/pull/42</span>
            </div>
            <input type="url" value={fields.prUrl || ''} onChange={e => set('prUrl', e.target.value)}
              placeholder="https://github.com/owner/repo/pull/42"
              className="w-full px-3 py-3 rounded-xl text-sm" style={fieldBase} />
          </div>
          <div>
            <Label>Test Framework</Label>
            <select value={fields.framework || ''} onChange={e => set('framework', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm" style={fieldBase}>
              <option value="">Select framework…</option>
              <option value="pytest">pytest (Python)</option>
              <option value="jest">Jest (JavaScript)</option>
              <option value="cypress">Cypress (E2E)</option>
              <option value="playwright">Playwright (E2E)</option>
              <option value="vitest">Vitest</option>
              <option value="other">Other</option>
            </select>
          </div>
          <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
            Your PR will be reviewed using the Tester rubric — test coverage, naming, isolation, and edge cases are weighted heavily (30/100 points).
          </p>
        </div>
      )}

      {error && <ErrorBox message={error} />}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReviewPage() {
  const { user } = useAuthStore()

  const [tasks,          setTasks]          = useState([])
  const [selectedTask,   setSelected]       = useState(null)
  const [submitting,     setSubmitting]     = useState(false)
  const [polling,        setPolling]        = useState(false)
  const [review,         setReview]         = useState(null)
  const [history,        setHistory]        = useState([])
  const [loadingTasks,   setLoadingTasks]   = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [error,          setError]          = useState('')
  const [fetchMsg,       setFetchMsg]       = useState('')

  // PR forms state
  const [prUrl,      setPrUrl]      = useState('')
  const [screenshot, setScreenshot] = useState(null)

  // Design form state
  const [designFields, setDesignFields] = useState({ figmaUrl: '', explanation: '', checklist: {}, image: null })

  // QA form state
  const [qaType,   setQaType]   = useState('bug_report')
  const [qaFields, setQaFields] = useState({})

  const effectiveRole = selectedTask?.intern_role || 'default'

  useEffect(() => {
    if (!user) return
    setLoadingTasks(true)
    api.get('/api/tasks/my-tasks')
      .then(res => setTasks((res.data || []).filter(t => t.status === 'in_progress')))
      .catch(() => setError('Could not load tasks. Make sure you are logged in.'))
      .finally(() => setLoadingTasks(false))
  }, [user])

  useEffect(() => {
    if (!selectedTask) return
    setReview(null); setHistory([])
    setPrUrl(''); setScreenshot(null)
    setDesignFields({ figmaUrl: '', explanation: '', checklist: {}, image: null })
    setQaFields({}); setQaType('bug_report')
    setError(''); setFetchMsg('')
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

  const validateSubmission = () => {
    const role = effectiveRole
    if (role === 'ui_ux') {
      if (!designFields.figmaUrl?.trim() && !designFields.image && !designFields.explanation?.trim())
        return 'Please provide at least a Figma URL, screenshot, or explanation.'
      if (!designFields.explanation?.trim()) return 'Please explain your design decisions.'
    } else if (role === 'tester') {
      if (qaType === 'bug_report') {
        if (!qaFields.bugTitle?.trim()) return 'Please add a bug title.'
        if (!qaFields.bugSteps?.trim()) return 'Please add steps to reproduce.'
      } else if (qaType === 'test_plan') {
        if (!qaFields.testScope?.trim()) return 'Please define the test scope.'
        if (!qaFields.testCasesDoc) return 'Please upload your test cases document (.txt, .md, or .pdf).'
      } else if (qaType === 'automation_pr') {
        if (!qaFields.prUrl?.trim() || !qaFields.prUrl.includes('github.com') || !qaFields.prUrl.includes('/pull/'))
          return 'Please provide a valid GitHub PR URL (https://github.com/owner/repo/pull/42)'
      }
    } else {
      if (!prUrl.trim()) return 'Please paste your GitHub PR link.'
      if (!prUrl.includes('github.com') || !prUrl.includes('/pull/'))
        return "That doesn't look like a GitHub PR link (https://github.com/owner/repo/pull/42)"
    }
    return null
  }

  const handleSubmit = async () => {
    if (!selectedTask) { setError('Please select a task first.'); return }
    const ve = validateSubmission()
    if (ve) { setError(ve); return }

    setError(''); setSubmitting(true)
    const role = effectiveRole

    try {
      let res
      if (role === 'ui_ux') {
        setFetchMsg('Submitting design for AI review…')
        res = await api.post('/api/mentor/review/design', {
          task_id:           selectedTask.id,
          user_id:           user?.id || '',
          figma_url:         designFields.figmaUrl?.trim() || null,
          explanation:       designFields.explanation?.trim() || '',
          handoff_checklist: designFields.checklist || {},
          image_base64:      designFields.image?.base64 || null,
          image_mime:        designFields.image?.mime || 'image/png',
        })
      } else if (role === 'tester') {
        setFetchMsg('Submitting QA work for review…')
        const payload = { task_id: selectedTask.id, user_id: user?.id || '', submission_type: qaType }
        if (qaType === 'bug_report') Object.assign(payload, {
          bug_title: qaFields.bugTitle || '', bug_steps: qaFields.bugSteps || '',
          bug_expected: qaFields.bugExpected || '', bug_actual: qaFields.bugActual || '',
          bug_severity: qaFields.bugSeverity || '', bug_environment: qaFields.bugEnvironment || '',
        })
        else if (qaType === 'test_plan') Object.assign(payload, {
          test_plan_scope: qaFields.testScope || '',
          // test_cases is the text content read from the uploaded document
          test_cases: qaFields.testCasesDoc?.text || '',
          test_coverage_areas: qaFields.testCoverage || '',
        })
        else Object.assign(payload, { pr_url: qaFields.prUrl?.trim() || '', automation_framework: qaFields.framework || '' })
        res = await api.post('/api/mentor/review/qa', payload)
      } else {
        setFetchMsg('Fetching your PR from GitHub…')
        res = await api.post('/api/mentor/review', {
          task_id: selectedTask.id, pr_url: prUrl.trim(), user_id: user?.id || '',
        })
      }

      if (res.data?.status === 'error') { setError(res.data.message || 'Submission failed.'); setFetchMsg(''); return }

      setFetchMsg(
        role === 'ui_ux' || role === 'tester'
          ? 'Submission received — AI review running…'
          : 'PR fetched ✓ — AI review running (4 audit layers)…'
      )

      setPolling(true)
      let attempts = 0
      const poll = setInterval(async () => {
        attempts++
        try {
          const taskRes = await api.get(`/api/tasks/${selectedTask.id}`)
          const t = taskRes.data
          if (t.status !== 'review' || attempts > 20) {
            clearInterval(poll); setPolling(false); setFetchMsg('')
            const histRes = await api.get(`/api/mentor/review/history/${selectedTask.id}`)
            const newAttempts = histRes.data?.attempts || []
            setHistory(newAttempts)
            if (newAttempts.length > 0 && newAttempts[0].review_json) {
              const rj = newAttempts[0].review_json
              setReview(typeof rj === 'string' ? JSON.parse(rj) : rj)
            }
            setTasks(prev => prev.map(tk => tk.id === t.id ? { ...tk, status: t.status } : tk))
            if (t.id === selectedTask.id) setSelected({ ...selectedTask, status: t.status })
            if (newAttempts.length > 0 && !newAttempts[0].review_json)
              setError('Review completed but no result returned. Check server logs (GROQ_API_KEY may be missing).')
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

  const submitLabel = () => {
    if (submitting) return effectiveRole === 'ui_ux' ? 'Uploading…' : effectiveRole === 'tester' ? 'Submitting QA…' : 'Fetching PR…'
    if (polling)    return '⏳ Running AI review…'
    if (effectiveRole === 'ui_ux')   return '🎨 Submit Design for Review'
    if (effectiveRole === 'tester')  return '🧪 Submit for QA Review'
    return '🔍 Submit for Review'
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16 px-2">

      <div>
        <h1 className="text-2xl font-black" style={{ color: 'var(--ink)' }}>AI Code Review</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>
          Select a task and submit your work — the form adapts to your role.
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
            No tasks currently in progress. Start a task first, then come back here.
          </div>
        )}
        {!loadingTasks && tasks.length > 0 && (
          <div className="grid gap-2">
            {tasks.map(t => {
              const taskRole = t.intern_role || 'default'
              const isSel = selectedTask?.id === t.id
              return (
                <button key={t.id} onClick={() => setSelected(t)}
                  className="text-left px-4 py-3 rounded-xl transition-all"
                  style={{
                    background: isSel ? 'var(--accent)' : 'var(--surface)',
                    color: isSel ? '#fff' : 'var(--ink)',
                    border: `1px solid ${isSel ? 'var(--accent)' : 'var(--border)'}`,
                  }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold">{t.title}</p>
                    {taskRole !== 'default' && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                        style={{
                          background: isSel ? 'rgba(255,255,255,0.25)' : 'var(--surface-2)',
                          color: isSel ? '#fff' : 'var(--ink-muted)',
                          border: `1px solid ${isSel ? 'rgba(255,255,255,0.3)' : 'var(--border)'}`,
                        }}>
                        {ROLE_DISPLAY[taskRole] || taskRole}
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5 opacity-60 line-clamp-1">{t.description?.slice(0, 100)}</p>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Step 2 — Role-specific form */}
      {selectedTask && (
        <div className="rounded-2xl p-5 space-y-4"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>2. Submit your work</p>
            <RoleBadge role={effectiveRole} />
          </div>

          {effectiveRole === 'frontend' && (
            <FrontendForm prUrl={prUrl} setPrUrl={setPrUrl} screenshot={screenshot} setScreenshot={setScreenshot} error={error} />
          )}
          {(effectiveRole === 'backend' || effectiveRole === 'default') && (
            <BackendForm prUrl={prUrl} setPrUrl={setPrUrl} error={error} />
          )}
          {effectiveRole === 'ui_ux' && (
            <DesignForm fields={designFields} setFields={setDesignFields} error={error} />
          )}
          {effectiveRole === 'tester' && (
            <TesterForm qaType={qaType} setQaType={setQaType} fields={qaFields} setFields={setQaFields} error={error} />
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
            {submitLabel()}
          </button>
        </div>
      )}

      {/* Review result */}
      {review && (
        <div className="space-y-4">
          <div className="rounded-2xl p-5 flex items-center gap-5"
            style={{
              background: review.security_block ? '#fef2f2' : verdictBg,
              border: `1.5px solid ${review.security_block ? '#dc2626' : verdictColor}40`,
            }}>
            <ScoreRing score={review.score} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-lg font-black"
                  style={{ color: review.security_block ? '#dc2626' : verdictColor }}>
                  {review.security_block ? '🚨 Security Block' : review.verdict === 'pass' ? '✅ Passed' : '🔁 Needs Work'}
                </span>
                {review.confidence != null && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'white', color: 'var(--ink-muted)' }}>
                    {Math.round(review.confidence * 100)}% confidence
                  </span>
                )}
                <RoleBadge role={review.intern_role || effectiveRole} />
              </div>
              {review.review_summary && (
                <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>{review.review_summary}</p>
              )}
            </div>
          </div>
          <ReviewBody r={review} />
        </div>
      )}

      {/* History */}
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