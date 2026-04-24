'use client'

// app/dashboard/tickets/page.jsx
// Cross-team communication via raise-a-ticket system.

import { useEffect, useState, useRef } from 'react'
import { useAuthStore } from '@/lib/store/authStore'
import api from '@/lib/api'

// ── Constants ─────────────────────────────────────────────────────────────────
const PRIORITY = {
  low:    { label: 'Low',    color: '#64748b', bg: '#64748b12' },
  medium: { label: 'Medium', color: '#f59e0b', bg: '#f59e0b12' },
  high:   { label: 'High',   color: '#ef4444', bg: '#ef444412' },
  urgent: { label: 'Urgent', color: '#dc2626', bg: '#dc262618' },
}
const STATUS = {
  open:        { label: 'Open',        color: '#3b82f6', bg: '#3b82f612', dot: '#3b82f6' },
  in_progress: { label: 'In Progress', color: '#f59e0b', bg: '#f59e0b12', dot: '#f59e0b' },
  resolved:    { label: 'Resolved',    color: '#00c896', bg: '#00c89612', dot: '#00c896' },
  closed:      { label: 'Closed',      color: '#94a3b8', bg: '#94a3b812', dot: '#94a3b8' },
}
const TICKET_TYPES = [
  { value: 'blocker',    label: 'Blocker',          icon: '🚧' },
  { value: 'api_issue',  label: 'API / Integration', icon: '🔌' },
  { value: 'design_req', label: 'Design Request',    icon: '🎨' },
  { value: 'bug_report', label: 'Bug Report',        icon: '🐛' },
  { value: 'review_req', label: 'Review Request',    icon: '👀' },
  { value: 'question',   label: 'Question',          icon: '❓' },
  { value: 'other',      label: 'Other',             icon: '📝' },
]

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 60000)    return 'just now'
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}
function getInitials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}
function teamColor(name) {
  const palette = ['#5b4fff','#3b82f6','#00c896','#f59e0b','#ec4899','#8b5cf6','#06b6d4','#10b981']
  return palette[(name?.charCodeAt(0) ?? 0) % palette.length]
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, src, size = 32, color }) {
  const bg = color ?? teamColor(name)
  if (src) return (
    <img src={src} alt={name} width={size} height={size}
      className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
  )
  return (
    <div className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.34 }}>
      {getInitials(name)}
    </div>
  )
}

// ── Badges ────────────────────────────────────────────────────────────────────
function PriorityBadge({ priority }) {
  const cfg = PRIORITY[priority] ?? PRIORITY.medium
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold tracking-wide uppercase"
      style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
  )
}
function StatusBadge({ status }) {
  const cfg = STATUS[status] ?? STATUS.open
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded-md font-bold tracking-wide uppercase"
      style={{ background: cfg.bg, color: cfg.color }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  )
}
function TypeChip({ type }) {
  const t = TICKET_TYPES.find(x => x.value === type)
  if (!t) return null
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-medium"
      style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)', border: '1px solid var(--border)' }}>
      {t.icon} {t.label}
    </span>
  )
}

// ── Create Ticket Modal ───────────────────────────────────────────────────────
function CreateTicketModal({ onClose, onCreated, myGroup, projectGroups, myProfile }) {
  const [form, setForm] = useState({ title: '', description: '', type: 'blocker', priority: 'medium', to_group_id: '', to_group_obj: null })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // For virtual role-teams: exclude the current user's own role.
  // For real groups: exclude the user's own group.
  const otherGroups = (projectGroups ?? []).filter(g => {
    if (g.virtual) {
      // virtual team — exclude if it represents the current user's own role
      return g.role !== myProfile?.intern_role
    }
    return g.id !== myGroup?.id
  })

  const canSubmit = form.title.trim() && form.description.trim() && form.to_group_id

  const handleCreate = async () => {
    if (!canSubmit) return
    setSaving(true); setError(null)
    try {
      // For virtual role-teams, use real_group_id as the actual to_group_id in DB
      const resolvedToGroupId = form.to_group_obj?.real_group_id ?? form.to_group_id
      const { data } = await api.post('/api/tickets', {
        title: form.title.trim(), description: form.description.trim(),
        type: form.type, priority: form.priority, status: 'open',
        from_group_id: myGroup.id, to_group_id: resolvedToGroupId, project_id: myGroup.project_id,
      })
      onCreated(data); onClose()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to create ticket')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="relative w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
        style={{ background: 'white', border: '1px solid var(--border)', maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}>

        <div className="px-6 pt-6 pb-5 flex items-start justify-between gap-4"
          style={{ borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg, rgba(91,79,255,0.04) 0%, transparent 100%)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0"
              style={{ background: 'var(--accent)', boxShadow: '0 4px 12px rgba(91,79,255,0.3)' }}>🎫</div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] font-bold mb-0.5" style={{ color: 'var(--accent)' }}>Cross-Team</p>
              <h2 className="text-lg font-bold leading-none" style={{ color: 'var(--ink)' }}>Raise a Ticket</h2>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold hover:rotate-90 transition-all"
            style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>✕</button>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 'calc(92vh - 160px)' }}>
          <div className="px-6 py-5 space-y-5">

            {/* To */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] mb-2 block" style={{ color: 'var(--ink-muted)' }}>Addressed To *</label>
              {otherGroups.length === 0
                ? <p className="text-xs py-3 text-center rounded-xl"
                    style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)', border: '1px dashed var(--border)' }}>
                    No other teams in this project yet.
                  </p>
                : <div className="grid grid-cols-2 gap-2">
                    {otherGroups.map(g => (
                      <button key={g.id} onClick={() => setForm(f => ({ ...f, to_group_id: g.id, to_group_obj: g }))}
                        className="px-3 py-2.5 rounded-xl text-left transition-all text-sm font-medium"
                        style={{
                          background: form.to_group_id === g.id ? teamColor(g.name) + '18' : 'var(--surface-2)',
                          color: form.to_group_id === g.id ? teamColor(g.name) : 'var(--ink)',
                          border: `1.5px solid ${form.to_group_id === g.id ? teamColor(g.name) : 'var(--border)'}`,
                        }}>
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold text-white"
                            style={{ background: teamColor(g.name) }}>{getInitials(g.name)}</div>
                          <span className="truncate">{g.name}</span>
                        </div>
                        {g.cohort_label && (
                          <p className="text-[10px] mt-0.5 ml-7 truncate" style={{ color: 'var(--ink-muted)' }}>{g.cohort_label}</p>
                        )}
                      </button>
                    ))}
                  </div>
              }
            </div>

            {/* Type */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] mb-2 block" style={{ color: 'var(--ink-muted)' }}>Ticket Type</label>
              <div className="grid grid-cols-2 gap-1.5">
                {TICKET_TYPES.map(t => (
                  <button key={t.value} onClick={() => setForm(f => ({ ...f, type: t.value }))}
                    className="px-3 py-2 rounded-xl text-xs text-left transition-all"
                    style={{
                      background: form.type === t.value ? 'rgba(91,79,255,0.1)' : 'var(--surface-2)',
                      color: form.type === t.value ? 'var(--accent)' : 'var(--ink)',
                      border: `1.5px solid ${form.type === t.value ? 'var(--accent)' : 'var(--border)'}`,
                      fontWeight: form.type === t.value ? 600 : 400,
                    }}>
                    <span className="mr-1.5">{t.icon}</span>{t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] mb-2 block" style={{ color: 'var(--ink-muted)' }}>Priority</label>
              <div className="grid grid-cols-4 gap-1.5">
                {Object.entries(PRIORITY).map(([k, v]) => (
                  <button key={k} onClick={() => setForm(f => ({ ...f, priority: k }))}
                    className="py-2 rounded-xl text-xs font-bold transition-all"
                    style={{
                      background: form.priority === k ? v.bg : 'var(--surface-2)',
                      color: form.priority === k ? v.color : 'var(--ink-muted)',
                      border: `1.5px solid ${form.priority === k ? v.color + '50' : 'var(--border)'}`,
                    }}>{v.label}</button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] mb-2 block" style={{ color: 'var(--ink-muted)' }}>Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Brief summary of the issue…"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                style={{ background: 'var(--surface-2)', border: `1.5px solid ${form.title ? 'var(--accent)' : 'var(--border)'}`, color: 'var(--ink)' }} />
            </div>

            {/* Description */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] mb-2 block" style={{ color: 'var(--ink-muted)' }}>Description *</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Explain in detail. Include error messages, expected vs actual behavior, steps to reproduce…"
                rows={4} className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none transition-all"
                style={{ background: 'var(--surface-2)', border: `1.5px solid ${form.description ? 'var(--accent)' : 'var(--border)'}`, color: 'var(--ink)' }} />
            </div>

            {error && <p className="text-xs px-3 py-2 rounded-xl" style={{ background: '#fee2e2', color: '#dc2626' }}>{error}</p>}
          </div>
        </div>

        <div className="px-6 py-4 flex items-center justify-between gap-3"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <p className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
            From: <strong style={{ color: 'var(--ink)' }}>{myGroup?.name}</strong>
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:opacity-80"
              style={{ background: 'var(--surface-1)', color: 'var(--ink-muted)', border: '1px solid var(--border)' }}>Cancel</button>
            <button onClick={handleCreate} disabled={saving || !canSubmit}
              className="px-5 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-40"
              style={{ background: 'var(--accent)', boxShadow: canSubmit ? '0 4px 12px rgba(91,79,255,0.35)' : 'none' }}>
              {saving ? 'Sending…' : 'Raise Ticket →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Resolve Ticket Modal ──────────────────────────────────────────────────────
function ResolveTicketModal({ tickets, onClose, onUpdate, myGroup, myProfile }) {
  const [selected, setSelected] = useState(null)
  const [note, setNote] = useState('')
  const [resolving, setResolving] = useState(false)
  const [error, setError] = useState(null)

  // Only show tickets raised BY SOMEONE ELSE to our group — never tickets we created ourselves
  const actionable = tickets.filter(t =>
    String(t.to_group_id) === String(myGroup?.id) &&
    t.created_by !== myProfile?.id &&
    (t.status === 'open' || t.status === 'in_progress')
  )

  const handleResolve = async () => {
    if (!selected || resolving) return
    setResolving(true); setError(null)
    try {
      const { data } = await api.patch(`/api/tickets/${selected.id}`, {
        status: 'resolved',
        ...(note.trim() ? { resolution_note: note.trim() } : {}),
      })
      onUpdate(data); onClose()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to resolve ticket')
      setResolving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="relative w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', maxHeight: '88vh' }}
        onClick={e => e.stopPropagation()}>

        <div className="px-6 pt-6 pb-5 flex items-start justify-between gap-4"
          style={{ borderBottom: '1px solid var(--ink)', background: 'white' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0"
              style={{ background: '#00c896', boxShadow: '0 4px 12px rgba(0,200,150,0.3)' }}>✓</div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] font-bold mb-0.5" style={{ color: '#00c896' }}>Action Required</p>
              <h2 className="text-lg font-bold leading-none" style={{ color: 'var(--ink)' }}>Resolve a Ticket</h2>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background: 'white'}}>✕</button>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 'calc(88vh - 160px)',background: 'white' }}>
          <div className="px-6 py-5 space-y-4">
            {actionable.length === 0 ? (
              <div className="py-10 text-center" style={{ background: 'white'}}>
                <p className="text-3xl mb-3" >🎉</p>
                <p className="font-semibold text-sm mb-1" style={{ color: 'var(--ink)',background: 'white' }}>All clear!</p>
                <p className="text-xs" style={{ color: 'var(--ink-muted)' ,background: 'white'}}>No pending tickets assigned to your team.</p>
              </div>
            ) : (
              <>
                <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>Select a ticket your team has addressed to mark it resolved.</p>
                <div className="space-y-2">
                  {actionable.map(t => (
                    <button key={t.id} onClick={() => setSelected(t)}
                      className="w-full text-left rounded-2xl p-4 transition-all"
                      style={{ background: selected?.id === t.id ? '#00c89610' : 'var(--surface-2)', border: `1.5px solid ${selected?.id === t.id ? '#00c896' : 'var(--border)'}` }}>
                      <div className="flex items-start gap-3">
                        <div className="w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center"
                          style={{ borderColor: selected?.id === t.id ? '#00c896' : 'var(--border)', background: selected?.id === t.id ? '#00c896' : 'transparent' }}>
                          {selected?.id === t.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-[10px] font-mono" style={{ color: 'var(--ink-muted)' }}>#{t.id.slice(-6).toUpperCase()}</span>
                            <StatusBadge status={t.status} />
                            <PriorityBadge priority={t.priority} />
                          </div>
                          <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{t.title}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                            From: <strong>{t.from_group?.name ?? 'Unknown'}</strong> · {timeAgo(t.created_at)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {selected && (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.15em] mb-2 block" style={{ color: 'var(--ink-muted)' }}>Resolution Note (optional)</label>
                    <textarea value={note} onChange={e => setNote(e.target.value)}
                      placeholder="Describe how this was resolved…" rows={3}
                      className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
                      style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border)', color: 'var(--ink)' }} />
                  </div>
                )}
                {error && <p className="text-xs px-3 py-2 rounded-xl" style={{ background: '#fee2e2', color: '#dc2626' }}>{error}</p>}
              </>
            )}
          </div>
        </div>

        <div className="px-6 py-4 flex items-center justify-between gap-3"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <p className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{actionable.length} ticket{actionable.length !== 1 ? 's' : ''} pending</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:opacity-80"
              style={{ background: 'var(--surface-1)', color: 'var(--ink-muted)', border: '1px solid var(--border)' }}>Cancel</button>
            <button onClick={handleResolve} disabled={!selected || resolving}
              className="px-5 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-40"
              style={{ background: '#00c896', boxShadow: selected ? '0 4px 12px rgba(0,200,150,0.35)' : 'none' }}>
              {resolving ? 'Resolving…' : 'Mark Resolved ✓'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Ticket Detail Modal ───────────────────────────────────────────────────────
function TicketDetailModal({ ticket, onClose, onUpdate, myGroup, myProfile }) {
  const [reply, setReply] = useState('')
  const [comments, setComments] = useState([])
  const [loadingComments, setLoadingComments] = useState(true)
  const [sending, setSending] = useState(false)
  const commentsEndRef = useRef(null)
  const isOwner    = ticket.from_group_id === myGroup?.id
  const isAssigned = ticket.to_group_id   === myGroup?.id

  useEffect(() => {
    api.get(`/api/tickets/${ticket.id}/comments`)
      .then(r => setComments(r.data ?? []))
      .catch(() => setComments([]))
      .finally(() => setLoadingComments(false))
  }, [ticket.id])

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  const sendReply = async () => {
    if (!reply.trim() || sending) return
    setSending(true)
    try {
      const { data } = await api.post(`/api/tickets/${ticket.id}/comments`, { content: reply.trim() })
      if (data) setComments(prev => [...prev, data])
      setReply('')
    } catch { /* non-fatal */ }
    finally { setSending(false) }
  }

  const updateStatus = async (newStatus) => {
    try {
      const { data } = await api.patch(`/api/tickets/${ticket.id}`, { status: newStatus })
      if (data) onUpdate(data)
    } catch { /* non-fatal */ }
  }

  const typeEntry = TICKET_TYPES.find(t => t.value === ticket.type)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(8,8,24,0.7)', backdropFilter: 'blur(20px)' }} onClick={onClose}>
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}>

        <div className="h-1 w-full" style={{ background: STATUS[ticket.status]?.dot ?? '#6b7280' }} />

        {/* Header */}
        <div className="px-6 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md font-bold"
                  style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>
                  #{ticket.id.slice(-6).toUpperCase()}
                </span>
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
                {typeEntry && <span className="text-[10px]" style={{ color: 'var(--ink-muted)' }}>{typeEntry.icon} {typeEntry.label}</span>}
              </div>
              <h2 className="text-base font-bold leading-snug" style={{ color: 'var(--ink)' }}>{ticket.title}</h2>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                    style={{ background: teamColor(ticket.from_group?.name) }}>{getInitials(ticket.from_group?.name)}</div>
                  <span className="text-xs font-medium" style={{ color: 'var(--ink)' }}>{ticket.from_group?.name ?? 'Your team'}</span>
                </div>
                <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                    style={{ background: teamColor(ticket.to_group?.name) }}>{getInitials(ticket.to_group?.name)}</div>
                  <span className="text-xs font-medium" style={{ color: 'var(--ink)' }}>{ticket.to_group?.name ?? 'Other team'}</span>
                </div>
                <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>· {timeAgo(ticket.created_at)}</span>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0 hover:rotate-90 transition-all"
              style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="rounded-2xl p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--ink-muted)' }}>Description</p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--ink-soft)' }}>{ticket.description}</p>
          </div>

          {/* Actions — assigned team */}
          {isAssigned && ticket.status !== 'closed' && ticket.status !== 'resolved' && (
            <div className="rounded-2xl p-4 flex items-center gap-3 flex-wrap"
              style={{ background: '#f59e0b08', border: '1px solid #f59e0b20' }}>
              <div className="flex items-center gap-2 flex-1">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                  style={{ background: '#f59e0b20', color: '#f59e0b' }}>⚡</div>
                <p className="text-xs font-semibold" style={{ color: '#f59e0b' }}>Your team needs to action this</p>
              </div>
              <div className="flex gap-2">
                {ticket.status === 'open' && (
                  <button onClick={() => updateStatus('in_progress')}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-white hover:opacity-90"
                    style={{ background: '#f59e0b' }}>Start Working</button>
                )}
                <button onClick={() => updateStatus('resolved')}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-white hover:opacity-90"
                  style={{ background: '#00c896' }}>Mark Resolved</button>
                <button onClick={() => updateStatus('closed')}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold hover:opacity-80"
                  style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)', border: '1px solid var(--border)' }}>Close</button>
              </div>
            </div>
          )}

          {/* Close confirmation — owner */}
          {isOwner && ticket.status === 'resolved' && (
            <div className="rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap"
              style={{ background: '#00c89608', border: '1px solid #00c89625' }}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                  style={{ background: '#00c89620', color: '#00c896' }}>✓</div>
                <p className="text-xs font-semibold" style={{ color: '#00c896' }}>Resolved by the other team. Close if satisfied.</p>
              </div>
              <button onClick={() => updateStatus('closed')}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-white"
                style={{ background: '#00c896' }}>Close Ticket</button>
            </div>
          )}

          {/* Discussion */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] mb-3" style={{ color: 'var(--ink-muted)' }}>
              Discussion · {comments.length}
            </p>
            {loadingComments ? (
              <div className="flex items-center gap-2 py-4">
                <div className="w-4 h-4 rounded-full border-2 animate-spin"
                  style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>Loading…</p>
              </div>
            ) : comments.length === 0 ? (
              <div className="rounded-2xl p-5 text-center"
                style={{ background: 'var(--surface-2)', border: '1px dashed var(--border)' }}>
                <p className="text-xs italic" style={{ color: 'var(--ink-muted)' }}>No comments yet — start the conversation.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {comments.map(c => {
                  const isMe = c.author_id === myProfile?.id
                  const authorName = c.profiles?.name ?? c.author_name ?? 'Unknown'
                  return (
                    <div key={c.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <Avatar name={authorName} src={c.profiles?.avatar_url} size={28} />
                      <div className={`flex-1 min-w-0 flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className={`flex items-center gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                          <p className="text-[11px] font-semibold" style={{ color: 'var(--ink)' }}>{authorName}</p>
                          <p className="text-[10px]" style={{ color: 'var(--ink-muted)' }}>{timeAgo(c.created_at)}</p>
                        </div>
                        <div className="rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap max-w-[85%]"
                          style={{
                            background: isMe ? 'var(--accent)' : 'var(--surface-2)',
                            color: isMe ? 'white' : 'var(--ink-soft)',
                            border: isMe ? 'none' : '1px solid var(--border)',
                            borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                          }}>
                          {c.content}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={commentsEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Reply */}
        {ticket.status !== 'closed' && (
          <div className="px-5 py-4 flex gap-3 items-end"
            style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <Avatar name={myProfile?.name} src={myProfile?.avatar_url} size={28} />
            <div className="flex-1 relative">
              <textarea value={reply} onChange={e => setReply(e.target.value)}
                placeholder="Add a comment… (Ctrl+Enter to send)"
                rows={1} className="w-full resize-none rounded-2xl px-4 py-2.5 text-sm outline-none pr-12"
                style={{
                  background: 'var(--surface-1)',
                  border: `1.5px solid ${reply ? 'var(--accent)' : 'var(--border)'}`,
                  color: 'var(--ink)', minHeight: 42, maxHeight: 100,
                }}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply() }}
                onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px' }} />
              <button onClick={sendReply} disabled={!reply.trim() || sending}
                className="absolute right-2 bottom-2 w-7 h-7 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
                style={{ background: reply.trim() ? 'var(--accent)' : 'var(--surface-2)' }}>
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="white" strokeWidth={2.5}>
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Ticket Row ────────────────────────────────────────────────────────────────
function TicketRow({ ticket, onClick, isIncoming }) {
  const typeEntry = TICKET_TYPES.find(t => t.value === ticket.type)
  const statusCfg = STATUS[ticket.status] ?? STATUS.open
  return (
    <button onClick={() => onClick(ticket)}
      className="w-full text-left rounded-2xl transition-all hover:shadow-md group"
      style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}>
      <div className="h-0.5 w-full rounded-t-2xl" style={{ background: statusCfg.dot, opacity: ticket.status === 'closed' ? 0.3 : 1 }} />
      <div className="p-4 flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          <Avatar name={isIncoming ? ticket.from_group?.name : ticket.to_group?.name} size={36}
            color={teamColor(isIncoming ? ticket.from_group?.name : ticket.to_group?.name)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-mono font-bold" style={{ color: 'var(--ink-muted)' }}>#{ticket.id.slice(-6).toUpperCase()}</span>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </div>
            <span className="text-[10px] shrink-0 font-medium" style={{ color: 'var(--ink-muted)' }}>{timeAgo(ticket.created_at)}</span>
          </div>
          <p className="font-semibold text-sm mb-1 leading-snug" style={{ color: 'var(--ink)' }}>{ticket.title}</p>
          <p className="text-xs line-clamp-1 mb-2" style={{ color: 'var(--ink-muted)' }}>{ticket.description}</p>
          <div className="flex items-center gap-3 flex-wrap">
            {typeEntry && <TypeChip type={ticket.type} />}
            <span className="text-[10px] font-medium" style={{ color: 'var(--ink-muted)' }}>
              {isIncoming
                ? <span>From: <strong style={{ color: 'var(--ink)' }}>{ticket.from_group?.name ?? '—'}</strong></span>
                : <span>To: <strong style={{ color: 'var(--ink)' }}>{ticket.to_group?.name ?? '—'}</strong></span>
              }
            </span>
          </div>
        </div>
        <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
          fill="none" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--ink-muted)' }}>
          <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </button>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TicketsPage() {
  const { user } = useAuthStore()

  const [loading,        setLoading]        = useState(true)
  const [myGroup,        setMyGroup]        = useState(null)
  const [projectGroups,  setProjectGroups]  = useState([])
  const [myProfile,      setMyProfile]      = useState(null)
  const [tickets,        setTickets]        = useState([])
  const [activeTab,      setActiveTab]      = useState('incoming')
  const [showCreate,     setShowCreate]     = useState(false)
  const [showResolve,    setShowResolve]    = useState(false)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [pageError,      setPageError]      = useState(null)
  const [showResolved,   setShowResolved]   = useState(false)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        // 1. Fetch current user profile
        const { data: me } = await api.get('/api/auth/me')
        setMyProfile(me)

        if (!me?.project_id) { setLoading(false); return }

        // 2. Fetch ALL project_groups for this project
        //    Route: GET /api/projects/{project_id}/groups
        const { data: allGroups } = await api.get(`/api/projects/${me.project_id}/groups`)
        const groupsList = allGroups ?? []
        setProjectGroups(groupsList)

        // 3. Determine the current user's group.
        //    Best source: me.group_id matched against the groups list.
        //    Fallback: team endpoint — each member row includes group_id.
        let foundGroup = null

        if (me.group_id) {
          const matched = groupsList.find(g => g.id === me.group_id)
          foundGroup = matched
            ? { id: matched.id, name: matched.name, cohort_label: matched.cohort_label ?? null, project_id: me.project_id }
            : { id: me.group_id, name: me.group_name ?? me.intern_role ?? 'My Team', cohort_label: me.cohort_label ?? null, project_id: me.project_id }
        }

        if (!foundGroup) {
          try {
            const { data: teamData } = await api.get(`/api/projects/${me.project_id}/team`)
            // team[] entries each carry group_id (set in _get_team_for_group)
            const mine = (teamData?.team ?? []).find(m => m.user_id === me.id)
            if (mine?.group_id) {
              const matched = groupsList.find(g => g.id === mine.group_id)
              foundGroup = matched
                ? { id: matched.id, name: matched.name, cohort_label: matched.cohort_label ?? null, project_id: me.project_id }
                : { id: mine.group_id, name: mine.group_name ?? mine.intern_role ?? 'My Team', cohort_label: null, project_id: me.project_id }
            }
          } catch {
            // non-fatal fallback
          }
        }

        if (foundGroup) setMyGroup(foundGroup)

        // 4. Load tickets for this group (both incoming + outgoing)
        const groupId = foundGroup?.id
        if (groupId) {
          const { data: ticketData } = await api.get('/api/tickets', { params: { group_id: groupId } })
          setTickets(ticketData ?? [])
        }
      } catch (err) {
        console.error('Tickets load error:', err)
        setPageError(err?.response?.data?.detail || 'Failed to load. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  const handleTicketCreated = (ticket) => setTickets(prev => [ticket, ...prev])
  const handleTicketUpdated = (updated) => {
    // Merge carefully: keep all original fields (esp. created_by) and only
    // overwrite fields that are explicitly present in the response.
    setTickets(prev => prev.map(t => {
      if (t.id !== updated.id) return t
      const merged = { ...t }
      Object.keys(updated).forEach(k => {
        if (updated[k] !== null && updated[k] !== undefined) merged[k] = updated[k]
      })
      return merged
    }))
    if (selectedTicket?.id === updated.id)
      setSelectedTicket(t => {
        const merged = { ...t }
        Object.keys(updated).forEach(k => {
          if (updated[k] !== null && updated[k] !== undefined) merged[k] = updated[k]
        })
        return merged
      })
  }

  // In single-group projects from_group_id === to_group_id for every ticket,
  // so we use created_by to tell outgoing (I raised it) from incoming (someone else raised it).
  const singleGroup = tickets.length > 0 && tickets.every(
    t => String(t.from_group_id) === String(t.to_group_id)
  )
  const incoming = singleGroup
    ? tickets.filter(t => t.created_by !== myProfile?.id && String(t.to_group_id) === String(myGroup?.id))
    : tickets.filter(t => String(t.to_group_id) === String(myGroup?.id))
  const outgoing = singleGroup
    ? tickets.filter(t => t.created_by === myProfile?.id)
    : tickets.filter(t => String(t.from_group_id) === String(myGroup?.id))
  const activeStatuses   = ['open', 'in_progress']
  const resolvedStatuses = ['resolved', 'closed']

  const activeList   = (activeTab === 'incoming' ? incoming : outgoing).filter(t => activeStatuses.includes(t.status))
  const resolvedList = (activeTab === 'incoming' ? incoming : outgoing).filter(t => resolvedStatuses.includes(t.status))

  const openIncoming  = incoming.filter(t => t.status === 'open').length
  const pendingForUs  = incoming.filter(t => activeStatuses.includes(t.status)).length
  const resolvedTotal = tickets.filter(t => resolvedStatuses.includes(t.status)).length

  // ── Loading ──
  if (loading) return (
    <div className="flex items-center justify-center py-24 gap-3" style={{ color: 'var(--ink-muted)' }}>
      <div className="w-6 h-6 rounded-full border-2 animate-spin"
        style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      <span className="text-sm">Loading tickets…</span>
    </div>
  )

  // ── Error ──
  if (pageError) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <p className="text-4xl">⚠️</p>
      <p className="font-semibold" style={{ color: 'var(--ink)' }}>Something went wrong</p>
      <p className="text-sm text-center max-w-xs" style={{ color: 'var(--ink-muted)' }}>{pageError}</p>
      <button onClick={() => window.location.reload()}
        className="mt-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
        style={{ background: 'var(--accent)' }}>Retry</button>
    </div>
  )

  // ── No group ──
  if (!myGroup) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <p className="text-4xl">🎫</p>
      <p className="font-semibold" style={{ color: 'var(--ink)' }}>No group assigned</p>
      <p className="text-sm max-w-xs text-center" style={{ color: 'var(--ink-muted)' }}>
        You need to be in a project group to use tickets. Join a project first from the{' '}
        <a href="/internship/project" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>project page</a>.
      </p>
    </div>
  )

  // ── Main UI ──
  return (
    <div className="space-y-5 animate-fade-up">

      {showCreate && (
        <CreateTicketModal
          onClose={() => setShowCreate(false)}
          onCreated={handleTicketCreated}
          myGroup={myGroup}
          projectGroups={projectGroups}
          myProfile={myProfile}
        />
      )}
      {showResolve && (
        <ResolveTicketModal
          tickets={tickets}
          onClose={() => setShowResolve(false)}
          onUpdate={handleTicketUpdated}
          myGroup={myGroup}
          myProfile={myProfile}
        />
      )}
      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdate={handleTicketUpdated}
          myGroup={myGroup}
          myProfile={myProfile}
        />
      )}

      {/* Header */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold mb-1" style={{ color: 'var(--accent)' }}>
          {myGroup.name} · {myGroup.cohort_label ?? 'Team'}
        </p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>Cross-Team Tickets</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--ink-muted)' }}>
          Raise blockers, requests and issues to other teams. Track resolution in one place.
        </p>
      </div>

      {/* Action cards */}
      <div className="grid sm:grid-cols-2 gap-3">
        <button onClick={() => setShowCreate(true)}
          className="group relative rounded-2xl p-5 text-left overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg, var(--accent) 0%, #7c6fff 100%)', boxShadow: '0 4px 20px rgba(91,79,255,0.25)' }}>
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full pointer-events-none" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3" style={{ background: 'rgba(255,255,255,0.18)' }}>🎫</div>
            <p className="font-bold text-white text-base mb-0.5">Raise a Ticket</p>
            <p className="text-xs text-white/70 leading-relaxed">Flag a blocker, request help, or report an issue to another team.</p>
            <div className="flex items-center gap-1.5 mt-3 text-xs font-semibold text-white/80 group-hover:text-white transition-colors">
              <span>New ticket</span>
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </button>

        <button onClick={() => setShowResolve(true)}
          className="group relative rounded-2xl p-5 text-left overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5"
          style={{
            background: pendingForUs > 0 ? 'linear-gradient(135deg, #00c896 0%, #00a87e 100%)' : 'var(--surface-2)',
            border: pendingForUs > 0 ? 'none' : '1px solid var(--border)',
            boxShadow: pendingForUs > 0 ? '0 4px 20px rgba(0,200,150,0.25)' : 'none',
          }}>
          <div className="relative">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3"
              style={{ background: pendingForUs > 0 ? 'rgba(255,255,255,0.18)' : 'var(--surface-1)', border: pendingForUs > 0 ? 'none' : '1px solid var(--border)' }}>✓</div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-base mb-0.5" style={{ color: pendingForUs > 0 ? 'white' : 'var(--ink)' }}>Resolve a Ticket</p>
                <p className="text-xs leading-relaxed" style={{ color: pendingForUs > 0 ? 'rgba(255,255,255,0.7)' : 'var(--ink-muted)' }}>
                  {pendingForUs > 0
                    ? `${pendingForUs} ticket${pendingForUs !== 1 ? 's' : ''} waiting for your team's action.`
                    : 'No pending tickets from other teams right now.'}
                </p>
              </div>
              {pendingForUs > 0 && (
                <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>{pendingForUs}</div>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-3 text-xs font-semibold transition-all"
              style={{ color: pendingForUs > 0 ? 'rgba(255,255,255,0.8)' : 'var(--ink-muted)' }}>
              <span>{pendingForUs > 0 ? 'View & resolve' : 'Check inbox'}</span>
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Incoming', value: incoming.length,  color: 'var(--ink)', icon: '📥' },
          { label: 'Raised',   value: outgoing.length,  color: 'var(--ink)', icon: '📤' },
          { label: 'Open',     value: openIncoming,     color: '#ef4444',    icon: '🔴' },
          { label: 'Resolved', value: resolvedTotal,    color: '#00c896',    icon: '✅' },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="rounded-xl px-4 py-3 flex items-center gap-3"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <span className="text-lg">{icon}</span>
            <div>
              <p className="text-[10px] uppercase tracking-wide font-medium" style={{ color: 'var(--ink-muted)' }}>{label}</p>
              <p className="text-xl font-bold leading-none mt-0.5" style={{ color }}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="rounded-xl p-1 flex gap-0.5 w-fit" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        {[
          { id: 'incoming', label: 'Incoming',     count: incoming.filter(t => ['open','in_progress'].includes(t.status)).length, icon: '📥' },
          { id: 'outgoing', label: 'Raised by us', count: outgoing.filter(t => ['open','in_progress'].includes(t.status)).length, icon: '📤' },
        ].map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id); setShowResolved(false) }}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
            style={activeTab === t.id
              ? { background: 'var(--surface-1)', color: 'var(--ink)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
              : { color: 'var(--ink-muted)' }}>
            <span>{t.icon}</span><span>{t.label}</span>
            {t.count > 0 && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                style={{ background: activeTab === t.id ? '#ef444420' : 'transparent', color: '#ef4444' }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Active ticket list */}
      {activeList.length === 0 ? (
        <div className="rounded-2xl p-12 flex flex-col items-center gap-3 text-center"
          style={{ background: 'var(--surface-2)', border: '1px dashed var(--border)' }}>
          <p className="text-4xl">🎫</p>
          <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>
            {activeTab === 'incoming' ? 'No active incoming tickets' : 'No active raised tickets'}
          </p>
          <p className="text-xs max-w-xs" style={{ color: 'var(--ink-muted)' }}>
            {activeTab === 'incoming'
              ? "No open tickets from other teams right now."
              : "You haven't raised any open tickets yet."}
          </p>
          {activeTab === 'outgoing' && (
            <button onClick={() => setShowCreate(true)}
              className="mt-1 px-5 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background: 'var(--accent)' }}>Raise Your First Ticket</button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {activeList.map(ticket => (
            <TicketRow key={ticket.id} ticket={ticket} onClick={setSelectedTicket} isIncoming={activeTab === 'incoming'} />
          ))}
        </div>
      )}

      {/* Resolved / closed — collapsible */}
      {resolvedList.length > 0 && (
        <div>
          <button
            onClick={() => setShowResolved(v => !v)}
            className="flex items-center gap-2 w-full px-1 py-2 rounded-xl transition-all hover:opacity-80"
            style={{ color: 'var(--ink-muted)' }}>
            <span className="text-xs font-semibold uppercase tracking-[0.12em]">
              Resolved &amp; Closed
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold"
              style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)', border: '1px solid var(--border)' }}>
              {resolvedList.length}
            </span>
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 ml-auto transition-transform"
              style={{ transform: showResolved ? 'rotate(180deg)' : 'rotate(0deg)' }}
              fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {showResolved && (
            <div className="flex flex-col gap-2 mt-2">
              {resolvedList.map(ticket => (
                <TicketRow key={ticket.id} ticket={ticket} onClick={setSelectedTicket} isIncoming={activeTab === 'incoming'} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Teams reference */}
      {projectGroups.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] mb-3" style={{ color: 'var(--ink-muted)' }}>Teams in this project</p>
          <div className="flex flex-wrap gap-2">
            {projectGroups.map(g => (
              <div key={g.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                style={{
                  background: g.id === myGroup.id ? 'var(--accent)' : 'var(--surface-1)',
                  border: `1px solid ${g.id === myGroup.id ? 'var(--accent)' : 'var(--border)'}`,
                }}>
                <div className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                  style={{ background: g.id === myGroup.id ? 'rgba(255,255,255,0.3)' : teamColor(g.name) }}>
                  {getInitials(g.name)}
                </div>
                <span className="text-xs font-medium" style={{ color: g.id === myGroup.id ? 'white' : 'var(--ink)' }}>
                  {g.name}{g.id === myGroup.id ? ' (you)' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}