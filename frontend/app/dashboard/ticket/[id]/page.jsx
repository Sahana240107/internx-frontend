'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import api from '@/lib/api'

const PRIORITY_STYLE = {
  critical: { bg: '#fef2f2', border: '#dc2626', color: '#dc2626', badge: '#dc2626' },
  high:     { bg: '#fff7ed', border: '#ea580c', color: '#9a3412', badge: '#ea580c' },
  medium:   { bg: '#fefce8', border: '#ca8a04', color: '#854d0e', badge: '#ca8a04' },
  low:      { bg: '#f0fdf4', border: '#16a34a', color: '#166634', badge: '#16a34a' },
}

const STATUS_STYLE = {
  open:        { bg: '#eff6ff', color: '#1d4ed8', label: 'Open' },
  in_progress: { bg: '#fef9c3', color: '#854d0e', label: 'In Progress' },
  resolved:    { bg: '#f0fdf4', color: '#15803d', label: 'Resolved' },
  closed:      { bg: '#f3f4f6', color: '#6b7280', label: 'Closed' },
}

const ROLE_DISPLAY = {
  frontend: '🖥️ Frontend',
  backend:  '⚙️ Backend',
  ui_ux:    '🎨 UI/UX',
  tester:   '🧪 Tester',
}

function MarkdownBlock({ content }) {
  if (!content) return null
  // Simple markdown: ## headings, **bold**, newlines
  const lines = content.split('\n')
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        if (line.startsWith('## ')) {
          return (
            <p key={i} className="text-sm font-bold mt-4 first:mt-0"
              style={{ color: 'var(--ink)' }}>
              {line.replace('## ', '')}
            </p>
          )
        }
        if (line.startsWith('**') && line.endsWith('**')) {
          return (
            <p key={i} className="text-sm font-semibold"
              style={{ color: 'var(--ink)' }}>
              {line.replace(/\*\*/g, '')}
            </p>
          )
        }
        if (line.trim() === '') return <div key={i} className="h-1" />
        return (
          <p key={i} className="text-sm" style={{ color: 'var(--ink-soft)' }}>
            {line.replace(/\*\*(.*?)\*\*/g, '$1')}
          </p>
        )
      })}
    </div>
  )
}

export default function TicketDetailPage() {
  const { id } = useParams()
  const router  = useRouter()

  const [ticket,   setTicket]   = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    api.get(`/api/tickets/${id}`)
      .then(res => setTicket(res.data))
      .catch(() => setError('Ticket not found or you do not have access.'))
      .finally(() => setLoading(false))
  }, [id])

  const updateStatus = async (newStatus) => {
    setUpdating(true)
    try {
      await api.patch(`/api/tickets/${id}`, { status: newStatus })
      setTicket(t => ({ ...t, status: newStatus }))
    } catch {
      alert('Could not update status.')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Loading ticket…</p>
    </div>
  )

  if (error || !ticket) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-3">
      <p className="text-2xl">🎫</p>
      <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
        {error || 'Ticket not found'}
      </p>
      <button onClick={() => router.back()}
        className="text-xs underline" style={{ color: 'var(--accent)' }}>
        ← Go back
      </button>
    </div>
  )

  const ps = PRIORITY_STYLE[ticket.priority] || PRIORITY_STYLE.medium
  const ss = STATUS_STYLE[ticket.status]     || STATUS_STYLE.open

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5 pb-16">

      {/* Back */}
      <button onClick={() => router.back()}
        className="text-xs flex items-center gap-1 hover:underline"
        style={{ color: 'var(--ink-muted)' }}>
        ← Back
      </button>

      {/* Header card */}
      <div className="rounded-2xl p-5 space-y-4"
        style={{ background: ps.bg, border: `1.5px solid ${ps.border}` }}>

        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg">🐛</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: ps.badge, color: '#fff' }}>
              {(ticket.priority || 'medium').toUpperCase()}
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: ss.bg, color: ss.color }}>
              {ss.label}
            </span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: 'var(--surface)', color: 'var(--ink-muted)',
                       border: '1px solid var(--border)' }}>
              {ticket.type || 'bug'}
            </span>
          </div>
          <p className="text-[10px]" style={{ color: ps.color }}>
            {new Date(ticket.created_at).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit'
            })}
          </p>
        </div>

        <h1 className="text-lg font-black" style={{ color: ps.color }}>
          {ticket.title}
        </h1>

        {/* Status actions */}
        <div className="flex flex-wrap gap-2 pt-1">
          {['open', 'in_progress', 'resolved'].map(s => (
            <button key={s} disabled={ticket.status === s || updating}
              onClick={() => updateStatus(s)}
              className="text-xs px-3 py-1.5 rounded-xl font-semibold transition-all"
              style={{
                background: ticket.status === s ? 'var(--accent)' : 'var(--surface)',
                color:      ticket.status === s ? '#fff' : 'var(--ink-soft)',
                border:     `1px solid ${ticket.status === s ? 'var(--accent)' : 'var(--border)'}`,
                cursor:     ticket.status === s || updating ? 'not-allowed' : 'pointer',
                opacity:    ticket.status === s ? 1 : 0.8,
              }}>
              {STATUS_STYLE[s]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      {ticket.description && (
        <div className="rounded-2xl p-5"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: 'var(--ink-muted)' }}>
            📋 Description
          </p>
          <MarkdownBlock content={ticket.description} />
        </div>
      )}

      {/* Meta */}
      <div className="rounded-2xl p-5 space-y-3"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--ink-muted)' }}>
          ℹ️ Details
        </p>
        <div className="grid grid-cols-2 gap-3 text-xs">
          {[
            { label: 'Priority',    value: ticket.priority?.toUpperCase() },
            { label: 'Status',      value: ss.label },
            { label: 'Type',        value: ticket.type || 'bug' },
            { label: 'Assigned to', value: ticket.to_group_id ? 'Frontend team' : '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p style={{ color: 'var(--ink-muted)' }}>{label}</p>
              <p className="font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Resolution note if resolved */}
      {ticket.resolution_note && (
        <div className="rounded-2xl p-4 space-y-1"
          style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <p className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: '#15803d' }}>
            ✅ Resolution
          </p>
          <p className="text-sm" style={{ color: '#166534' }}>{ticket.resolution_note}</p>
        </div>
      )}

    </div>
  )
}