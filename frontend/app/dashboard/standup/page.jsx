'use client'

/**
 * /app/dashboard/standup/page.jsx
 * InternX — AI Standup System (White Theme)
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuthStore } from '@/lib/store/authStore'
import api from '@/lib/api'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(ts) {
  if (!ts) return ''
  const d = Date.now() - new Date(ts).getTime()
  if (d < 60000) return 'just now'
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`
  return `${Math.floor(d / 86400000)}d ago`
}

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '??'
}

const ROLE_COLORS = {
  frontend:  '#3b82f6',
  backend:   '#8b5cf6',
  devops:    '#f59e0b',
  design:    '#ec4899',
  fullstack: '#10b981',
  tester:    '#06b6d4',
  ui_ux:     '#f97316',
  default:   '#64748b',
}

function roleColor(role) {
  return ROLE_COLORS[role] || ROLE_COLORS.default
}

function nameColor(name = '') {
  const palette = ['#5b4fff', '#3b82f6', '#00c896', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#10b981']
  return palette[(name.charCodeAt(0) || 0) % palette.length]
}

// ─── Small Components ─────────────────────────────────────────────────────────

function Avatar({ name, src, size = 36, color }) {
  const bg = color ?? nameColor(name)
  if (src) return (
    <img src={src} alt={name} width={size} height={size}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  )
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, color: '#fff', fontSize: size * 0.34, flexShrink: 0,
    }}>
      {getInitials(name)}
    </div>
  )
}

function RolePill({ role }) {
  if (!role) return null
  return (
    <span style={{
      background: roleColor(role) + '18',
      color: roleColor(role),
      fontSize: 10,
      fontWeight: 700,
      padding: '2px 8px',
      borderRadius: 99,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }}>{role}</span>
  )
}

const RISK_CONFIG = {
  low:      { color: '#10b981', bg: '#10b98112', label: 'LOW RISK',    emoji: '🟢' },
  medium:   { color: '#f59e0b', bg: '#f59e0b12', label: 'MEDIUM RISK', emoji: '🟡' },
  high:     { color: '#ef4444', bg: '#ef444412', label: 'HIGH RISK',   emoji: '🔴' },
  critical: { color: '#dc2626', bg: '#dc262612', label: 'CRITICAL',    emoji: '🚨' },
}

function RiskBadge({ risk }) {
  const cfg = RISK_CONFIG[risk] || RISK_CONFIG.medium
  return (
    <span style={{
      background: cfg.bg, color: cfg.color,
      fontSize: 11, fontWeight: 800, padding: '4px 12px',
      borderRadius: 99, letterSpacing: '0.08em',
      border: `1px solid ${cfg.color}35`,
    }}>
      {cfg.emoji} {cfg.label}
    </span>
  )
}

// ─── Countdown Clock ──────────────────────────────────────────────────────────

function CountdownClock({ opensAt, closesAt, status }) {
  const [remaining, setRemaining] = useState('')

  useEffect(() => {
    function tick() {
      const now = Date.now()
      if (status === 'upcoming') {
        const diff = new Date(opensAt).getTime() - now
        if (diff <= 0) { setRemaining('Opening...'); return }
        const h = Math.floor(diff / 3600000)
        const m = Math.floor((diff % 3600000) / 60000)
        const s = Math.floor((diff % 60000) / 1000)
        setRemaining(h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`)
      } else if (status === 'open') {
        const diff = new Date(closesAt).getTime() - now
        if (diff <= 0) { setRemaining('Closed'); return }
        const m = Math.floor(diff / 60000)
        const s = Math.floor((diff % 60000) / 1000)
        setRemaining(`${m}m ${s}s left`)
      } else {
        setRemaining('Closed for today')
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [opensAt, closesAt, status])

  const color = status === 'open' ? '#10b981' : status === 'upcoming' ? '#f59e0b' : '#94a3b8'
  return (
    <span style={{ fontFamily: 'monospace', fontWeight: 700, color, fontSize: 13 }}>
      {remaining}
    </span>
  )
}

// ─── Standup Form ─────────────────────────────────────────────────────────────

function StandupForm({ onSubmit, loading }) {
  const [form, setForm] = useState({ yesterday: '', today: '', blockers: '', eta_hours: '' })
  const [charWarnings, setCharWarnings] = useState({})

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }))
    const vague = ['worked on stuff', 'did some coding', 'was busy', 'worked on it', 'made progress', 'worked on things']
    const isVague = vague.some(v => val.toLowerCase().includes(v))
    setCharWarnings(w => ({ ...w, [field]: isVague ? '⚠️ Be more specific! Mention exact features or components.' : null }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({
      ...form,
      eta_hours: form.eta_hours ? parseFloat(form.eta_hours) : null,
    })
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    background: '#f8fafc', border: '1.5px solid #e2e8f0',
    color: '#1e293b', fontSize: 13, fontFamily: 'inherit',
    resize: 'vertical', outline: 'none', transition: 'border-color 0.15s',
    boxSizing: 'border-box',
  }

  const labelStyle = {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: '#64748b', letterSpacing: '0.07em',
    textTransform: 'uppercase', marginBottom: 6,
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <label style={labelStyle}>✅ Yesterday — What did you complete?</label>
        <textarea
          value={form.yesterday}
          onChange={e => set('yesterday', e.target.value)}
          placeholder="e.g. Completed the OTP verification UI component, added form validation, wrote unit tests for the login flow"
          rows={3}
          style={inputStyle}
          required
        />
        {charWarnings.yesterday && (
          <p style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>{charWarnings.yesterday}</p>
        )}
        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
          Be specific — mention component names, endpoints, PRs, or features completed.
        </p>
      </div>

      <div>
        <label style={labelStyle}>🎯 Today — What will you work on?</label>
        <textarea
          value={form.today}
          onChange={e => set('today', e.target.value)}
          placeholder="e.g. Implement the /api/auth/refresh endpoint, add JWT expiry handling, write integration tests"
          rows={3}
          style={inputStyle}
          required
        />
        {charWarnings.today && (
          <p style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>{charWarnings.today}</p>
        )}
      </div>

      <div>
        <label style={labelStyle}>🚨 Blockers — Anything blocking you? (optional)</label>
        <textarea
          value={form.blockers}
          onChange={e => set('blockers', e.target.value)}
          placeholder="e.g. Waiting for /api/products endpoint from backend team. Design mockup for dashboard not ready yet."
          rows={2}
          style={{ ...inputStyle, borderColor: form.blockers ? '#ef444440' : undefined }}
        />
        {form.blockers && (
          <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>
            🚨 Blockers will be auto-escalated to the responsible team member.
          </p>
        )}
      </div>

      <div>
        <label style={labelStyle}>⏱ ETA (hours) — How long will today's task take? (optional)</label>
        <input
          type="number"
          min={0.5} max={12} step={0.5}
          value={form.eta_hours}
          onChange={e => set('eta_hours', e.target.value)}
          placeholder="e.g. 4"
          style={{ ...inputStyle, resize: 'none' }}
        />
      </div>

      <button
        type="submit"
        disabled={loading || !form.yesterday.trim() || !form.today.trim()}
        style={{
          padding: '12px 24px', borderRadius: 8,
          background: loading ? '#e2e8f0' : 'linear-gradient(135deg, #5b4fff, #3b82f6)',
          color: loading ? '#94a3b8' : '#fff',
          border: 'none', fontWeight: 700, fontSize: 14,
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: (!form.yesterday.trim() || !form.today.trim()) ? 0.5 : 1,
          transition: 'opacity 0.15s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        {loading ? (
          <>
            <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⚙️</span>
            Analyzing with AI...
          </>
        ) : '🚀 Submit Standup'}
      </button>
    </form>
  )
}

// ─── Analysis Result Card ─────────────────────────────────────────────────────

function AnalysisCard({ analysis }) {
  if (!analysis) return null
  const { vague_score = 0, vague_reason, consistency_ok, consistency_note, ai_followup } = analysis

  const vagueBg    = vague_score > 70 ? '#ef444412' : vague_score > 40 ? '#f59e0b12' : '#10b98112'
  const vagueColor = vague_score > 70 ? '#ef4444'   : vague_score > 40 ? '#f59e0b'   : '#10b981'
  const vagueLabel = vague_score > 70 ? 'Too Vague'  : vague_score > 40 ? 'Somewhat Vague' : 'Good Update'

  return (
    <div style={{
      background: '#f8fafc', border: '1.5px solid #e2e8f0',
      borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#475569' }}>
        🤖 AI Analysis
      </h3>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            width: `${vague_score}%`, height: '100%',
            background: vagueColor, borderRadius: 99, transition: 'width 0.5s ease',
          }} />
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 99,
          background: vagueBg, color: vagueColor,
        }}>{vagueLabel}</span>
      </div>
      {vague_reason && <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{vague_reason}</p>}

      {consistency_note && (
        <div style={{
          padding: '10px 14px', borderRadius: 8,
          background: consistency_ok ? '#10b98110' : '#ef444410',
          border: `1px solid ${consistency_ok ? '#10b98130' : '#ef444430'}`,
        }}>
          <p style={{ margin: 0, fontSize: 12, color: consistency_ok ? '#10b981' : '#ef4444' }}>
            {consistency_ok ? '✅' : '⚠️'} <strong>Consistency Check:</strong> {consistency_note}
          </p>
        </div>
      )}

      {ai_followup && (
        <div style={{
          padding: '12px 16px', borderRadius: 8,
          background: '#5b4fff0a', border: '1px solid #5b4fff25',
        }}>
          <p style={{ margin: 0, fontSize: 12, color: '#5b4fff' }}>
            💬 <strong>Manager asks:</strong> {ai_followup}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Threaded Reply Box ────────────────────────────────────────────────────────
// Full AI conversation: intern replies → AI manager responds back

function AiManagerBubble({ text, loading }) {
  return (
    <div style={{
      background: '#f5f3ff', border: '1px solid #ddd6fe',
      borderRadius: '8px 8px 8px 2px', padding: '10px 14px',
      display: 'flex', alignItems: 'flex-start', gap: 8,
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%', background: '#ede9fe',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, flexShrink: 0, marginTop: 1,
      }}>🤖</div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          AI Manager
        </p>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ animation: 'pulse 1s infinite', display: 'inline-block', fontSize: 11, color: '#a78bfa' }}>●</span>
            <span style={{ animation: 'pulse 1s 0.2s infinite', display: 'inline-block', fontSize: 11, color: '#a78bfa' }}>●</span>
            <span style={{ animation: 'pulse 1s 0.4s infinite', display: 'inline-block', fontSize: 11, color: '#a78bfa' }}>●</span>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 12, color: '#4c1d95', lineHeight: 1.5 }}>{text}</p>
        )}
      </div>
    </div>
  )
}

function InternBubble({ name, text }) {
  return (
    <div style={{
      background: '#fafafa', border: '1px solid #e2e8f0',
      borderRadius: '2px 8px 8px 8px', padding: '8px 12px',
      display: 'flex', alignItems: 'flex-start', gap: 8,
    }}>
      <Avatar name={name || 'You'} size={22} />
      <div style={{ flex: 1 }}>
        <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 700, color: '#64748b' }}>
          {name || 'You'}
        </p>
        <p style={{ margin: 0, fontSize: 12, color: '#334155', lineHeight: 1.5 }}>{text}</p>
      </div>
    </div>
  )
}

function ThreadedReply({ standupId, standup, currentUser }) {
  // thread = array of { role: 'manager'|'intern', text: string }
  // Seed with the initial AI follow-up question + any saved history
  const [thread, setThread] = useState(() => {
    const t = []
    if (standup.ai_followup) t.push({ role: 'manager', text: standup.ai_followup })
    // hydrate saved turns if backend returns them
    if (standup.thread_history) {
      try {
        const saved = typeof standup.thread_history === 'string'
          ? JSON.parse(standup.thread_history)
          : standup.thread_history
        if (Array.isArray(saved)) saved.forEach(m => t.push(m))
      } catch {}
    }
    return t
  })

  const [open, setOpen]       = useState(false)
  const [reply, setReply]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  // Is the last message from the manager? Then we can reply.
  const lastIsManager = thread.length > 0 && thread[thread.length - 1].role === 'manager'

  async function handleSend() {
    if (!reply.trim() || loading) return
    const internText = reply.trim()
    setReply('')
    setOpen(false)
    setLoading(true)
    setError(null)

    // Optimistically add intern bubble
    const newThread = [...thread, { role: 'intern', text: internText }]
    setThread(newThread)

    try {
      const res = await api.post('/api/standup/reply-to-manager', {
        standup_id:     standupId,
        reply:          internText,
        thread_history: thread, // send full context to backend
      })
      // Append AI manager's response
      setThread(t => [...t, { role: 'manager', text: res.data.ai_response }])
    } catch (e) {
      setError(e?.response?.data?.detail || 'AI Manager failed to respond. Try again.')
      // Remove the optimistic intern bubble on error
      setThread(thread)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginTop: 6 }}>
      {/* Thread bubbles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {thread.map((msg, i) => (
          <div key={i} style={i > 0 ? { paddingLeft: 20 } : {}}>
            {i > 0 && (
              <div style={{ borderLeft: '2px solid #ddd6fe', paddingLeft: 12 }}>
                {msg.role === 'manager'
                  ? <AiManagerBubble text={msg.text} />
                  : <InternBubble name={currentUser?.name} text={msg.text} />
                }
              </div>
            )}
            {i === 0 && <AiManagerBubble text={msg.text} />}
          </div>
        ))}

        {/* Typing indicator while AI responds */}
        {loading && (
          <div style={{ paddingLeft: 20 }}>
            <div style={{ borderLeft: '2px solid #ddd6fe', paddingLeft: 12 }}>
              <AiManagerBubble loading />
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <p style={{ margin: '6px 0 0 20px', fontSize: 11, color: '#ef4444' }}>{error}</p>
      )}

      {/* Reply input — only show when last message is from manager and not loading */}
      {lastIsManager && !loading && (
        <div style={{ paddingLeft: 20, marginTop: 4 }}>
          <div style={{ borderLeft: '2px solid #ddd6fe', paddingLeft: 12 }}>
            {!open ? (
              <button
                onClick={() => setOpen(true)}
                style={{
                  background: 'none', border: '1px dashed #c4b5fd',
                  borderRadius: 6, padding: '5px 12px',
                  fontSize: 11, color: '#7c3aed', cursor: 'pointer',
                  fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                ↩ Reply to Manager
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <textarea
                  autoFocus
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  placeholder="Type your reply... (Cmd+Enter to send)"
                  rows={2}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 6,
                    border: '1.5px solid #c4b5fd', background: '#faf5ff',
                    fontSize: 12, color: '#1e293b', fontFamily: 'inherit',
                    resize: 'none', outline: 'none', boxSizing: 'border-box',
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend()
                    if (e.key === 'Escape') { setOpen(false); setReply('') }
                  }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={handleSend}
                    disabled={!reply.trim()}
                    style={{
                      padding: '5px 14px', borderRadius: 6,
                      background: !reply.trim() ? '#e2e8f0' : '#7c3aed',
                      color: !reply.trim() ? '#94a3b8' : '#fff',
                      border: 'none', fontSize: 11, fontWeight: 700,
                      cursor: !reply.trim() ? 'not-allowed' : 'pointer',
                    }}
                  >↩ Send Reply</button>
                  <button
                    onClick={() => { setOpen(false); setReply('') }}
                    style={{
                      padding: '5px 10px', borderRadius: 6,
                      background: 'none', color: '#94a3b8',
                      border: '1px solid #e2e8f0', fontSize: 11, cursor: 'pointer',
                    }}
                  >Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Standup Card (feed item) ─────────────────────────────────────────────────

function StandupCard({ standup, currentUser }) {
  const profile     = standup.profiles || {}
  const hasBlockers = standup.blockers?.trim()
  const blockerList = standup.blocker_list || []

  return (
    <div style={{
      background: '#ffffff', border: '1.5px solid #e2e8f0',
      borderRadius: 12, padding: 18,
      borderLeft: hasBlockers ? '3px solid #ef4444' : '3px solid #e2e8f0',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      {/* ── Header row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <Avatar name={profile.name} src={profile.avatar_url} size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: '#1e293b', fontSize: 14 }}>{profile.name || 'Unknown'}</span>
            <RolePill role={profile.intern_role} />
            {standup.is_late && (
              <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', background: '#f59e0b12', padding: '2px 7px', borderRadius: 99 }}>LATE</span>
            )}
          </div>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{timeAgo(standup.submitted_at)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {standup.vague_score > 50 && (
            <span title="Vague update detected" style={{ fontSize: 15, cursor: 'help' }}>⚠️</span>
          )}
          {standup.eta_hours && (
            <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>⏱ {standup.eta_hours}h ETA</span>
          )}
        </div>
      </div>

      {/* ── Yesterday + Today side by side ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
          <p style={{ margin: '0 0 5px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>✅ Yesterday</p>
          <p style={{ margin: 0, fontSize: 13, color: '#334155', lineHeight: 1.5 }}>{standup.yesterday}</p>
        </div>
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
          <p style={{ margin: '0 0 5px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>🎯 Today</p>
          <p style={{ margin: 0, fontSize: 13, color: '#334155', lineHeight: 1.5 }}>{standup.today}</p>
        </div>
      </div>

      {/* ── Blocker ── */}
      {hasBlockers && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
          <p style={{ margin: '0 0 5px', fontSize: 10, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.06em' }}>🚨 Blocker</p>
          <p style={{ margin: 0, fontSize: 13, color: '#dc2626', lineHeight: 1.5 }}>{standup.blockers}</p>
          {blockerList.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {blockerList.map(b => b.tagged_role && (
                <span key={b.id} style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 99, fontWeight: 700,
                  background: roleColor(b.tagged_role) + '18', color: roleColor(b.tagged_role),
                }}>→ {b.tagged_role} team</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Threaded Manager Follow-up ── */}
      {standup.ai_followup && (
        <ThreadedReply
          standupId={standup.id}
          standup={standup}
          currentUser={currentUser}
        />
      )}
    </div>
  )
}

// ─── Missing Members ──────────────────────────────────────────────────────────

function MissingMembersPanel({ missing }) {
  if (!missing || missing.length === 0) return null
  return (
    <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12, padding: 16 }}>
      <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: '#d97706' }}>
        ⏳ Not yet submitted ({missing.length})
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {missing.map(m => {
          const profile = m.profile || {}
          return (
            <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar name={profile.name} src={profile.avatar_url} size={28} />
              <span style={{ fontSize: 13, color: '#475569' }}>{profile.name || 'Unknown'}</span>
              <RolePill role={m.role || profile.intern_role} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Scrum Summary Panel ──────────────────────────────────────────────────────

function ScrumSummary({ summary, onGenerate, generating }) {
  if (!summary) {
    return (
      <div style={{
        background: '#f8fafc', border: '1.5px dashed #cbd5e1',
        borderRadius: 12, padding: 24, textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      }}>
        <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>📋 No AI summary generated yet.</p>
        <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
          Summary is auto-generated after the standup window closes, or you can trigger it manually.
        </p>
        <button
          onClick={onGenerate}
          disabled={generating}
          style={{
            padding: '8px 20px', borderRadius: 8,
            background: generating ? '#e2e8f0' : '#5b4fff',
            color: generating ? '#94a3b8' : '#fff',
            border: 'none', fontWeight: 700, fontSize: 12,
            cursor: generating ? 'not-allowed' : 'pointer',
          }}
        >
          {generating ? '⚙️ Generating...' : '🤖 Generate AI Summary'}
        </button>
      </div>
    )
  }

  const risk    = summary.sprint_risk || 'medium'
  const riskCfg = RISK_CONFIG[risk] || RISK_CONFIG.medium
  const managerNotes = summary.manager_notes || []

  return (
    <div style={{
      background: '#ffffff', border: `1.5px solid ${riskCfg.color}35`,
      borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      {/* Risk header */}
      <div style={{
        background: riskCfg.bg, padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${riskCfg.color}20`,
      }}>
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: riskCfg.color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            🤖 AI Scrum Master Summary
          </p>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
            {new Date(summary.generated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} IST
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <RiskBadge risk={risk} />
          <button
            onClick={onGenerate}
            disabled={generating}
            title="Re-generate summary"
            style={{
              padding: '4px 10px', borderRadius: 6, background: '#ffffff',
              color: '#64748b', border: '1.5px solid #e2e8f0', fontSize: 11,
              cursor: generating ? 'not-allowed' : 'pointer', fontWeight: 600,
            }}
          >
            {generating ? '⚙️' : '↺ Refresh'}
          </button>
        </div>
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Stats row */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Submitted', value: summary.submission_count, color: '#10b981' },
            { label: 'Late',      value: summary.late_count,       color: '#f59e0b' },
            { label: 'Missed',    value: summary.missed_count,     color: '#ef4444' },
            { label: 'Blockers',  value: summary.blocker_count,    color: '#ef4444' },
          ].map(stat => (
            <div key={stat.label} style={{
              background: '#f8fafc', border: '1.5px solid #e2e8f0',
              borderRadius: 8, padding: '8px 16px', textAlign: 'center', flex: '1 1 70px',
            }}>
              <p style={{ margin: '0 0 2px', fontSize: 20, fontWeight: 800, color: stat.color }}>{stat.value}</p>
              <p style={{ margin: 0, fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Summary text */}
        <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '14px 16px' }}>
          <p style={{ margin: 0, fontSize: 13, color: '#334155', lineHeight: 1.7 }}>{summary.summary_text}</p>
        </div>

        {/* Manager notes */}
        {managerNotes.length > 0 && (
          <div>
            <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#5b4fff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              🤖 AI Manager Follow-ups
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {managerNotes.map((note, i) => (
                <div key={i} style={{
                  background: '#f5f3ff', border: '1px solid #ddd6fe',
                  borderRadius: 8, padding: '10px 14px',
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: '#ede9fe', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 14, flexShrink: 0,
                  }}>🤖</div>
                  <div>
                    {note.to && (
                      <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 700, color: '#5b4fff' }}>→ {note.to}</p>
                    )}
                    <p style={{ margin: 0, fontSize: 12, color: '#4c1d95', lineHeight: 1.5 }}>{note.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function StandupPage() {
  const { user } = useAuthStore()

  const [status,            setStatus]            = useState(null)
  const [feed,              setFeed]              = useState(null)
  const [loading,           setLoading]           = useState(true)
  const [submitting,        setSubmitting]        = useState(false)
  const [submitResult,      setSubmitResult]      = useState(null)
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [activeTab,         setActiveTab]         = useState('feed')
  const [history,           setHistory]           = useState([])
  const [historyLoading,    setHistoryLoading]    = useState(false)
  const [historyError,      setHistoryError]      = useState(null)
  const [error,             setError]             = useState(null)

  const loadData = useCallback(async () => {
    try {
      const [statusRes, feedRes] = await Promise.all([
        api.get('/api/standup/status'),
        api.get('/api/standup/feed'),
      ])
      setStatus(statusRes.data)
      setFeed(feedRes.data)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to load standup data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (status && !status.submitted_today && status.status === 'open') {
      setActiveTab('form')
    }
  }, [status])

  async function handleSubmit(formData) {
    setSubmitting(true)
    setError(null)
    try {
      const res = await api.post('/api/standup/submit', formData)
      setSubmitResult(res.data)
      setActiveTab('feed')
      await loadData()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to submit standup')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGenerateSummary() {
    setGeneratingSummary(true)
    try {
      await api.post('/api/standup/trigger-summary')
      await loadData()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to generate summary')
    } finally {
      setGeneratingSummary(false)
    }
  }

  async function loadHistory() {
    if (!user) return
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const res = await api.get('/api/standup/my-history')
      setHistory(res.data || [])
    } catch (e) {
      setHistoryError(e?.response?.data?.detail || 'Failed to load history')
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'history' && user && history.length === 0) loadHistory()
  }, [activeTab, user])

  const winStatus = status?.status || 'upcoming'
  const winColor  = winStatus === 'open' ? '#10b981' : winStatus === 'upcoming' ? '#f59e0b' : '#94a3b8'
  const winLabel  = winStatus === 'open' ? 'STANDUP OPEN' : winStatus === 'upcoming' ? 'UPCOMING' : 'CLOSED'

  const tabs = [
    { id: 'feed',    label: '📋 Team Feed',  count: feed?.submitted_count },
    { id: 'form',    label: '✍️ Submit',      badge: status?.submitted_today ? '✓' : winStatus === 'open' ? '!' : null },
    { id: 'history', label: '📅 My History' },
  ]

  if (loading) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f8fafc', color: '#64748b', fontFamily: 'system-ui',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12, animation: 'pulse 1.5s infinite' }}>🤖</div>
        <p>Loading standup system...</p>
      </div>
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh', background: '#f8fafc',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: '#1e293b',
    }}>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes pulse   { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        @keyframes fadeIn  { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing: border-box; }
        textarea:focus, input:focus { border-color: #5b4fff !important; box-shadow: 0 0 0 3px #5b4fff18; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
      `}</style>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                Daily Standup
              </h1>
              <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                Share your progress, flag blockers, and stay in sync with your team.
              </p>
            </div>

            {/* Window status badge */}
            <div style={{
              background: winColor + '12', border: `1.5px solid ${winColor}35`,
              borderRadius: 10, padding: '8px 16px', textAlign: 'right', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', background: winColor,
                  boxShadow: winStatus === 'open' ? `0 0 8px ${winColor}` : 'none',
                  animation: winStatus === 'open' ? 'pulse 2s infinite' : 'none',
                }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: winColor, letterSpacing: '0.07em' }}>
                  {winLabel}
                </span>
              </div>
              <div style={{ marginTop: 4 }}>
                {status && (
                  <CountdownClock opensAt={status.opens_at} closesAt={status.closes_at} status={status.status} />
                )}
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 10, color: '#94a3b8' }}>
                Window: 9:00 AM – 11:00 AM IST
              </p>
            </div>
          </div>

          {/* Progress bar */}
          {feed && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#64748b' }}>
                  Team participation: {feed.submitted_count}/{feed.total_members}
                </span>
                {feed.missing?.length > 0 && (
                  <span style={{ fontSize: 11, color: '#f59e0b' }}>{feed.missing.length} haven't submitted</span>
                )}
              </div>
              <div style={{ height: 4, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 99,
                  background: feed.submitted_count === feed.total_members ? '#10b981' : '#5b4fff',
                  width: feed.total_members > 0 ? `${(feed.submitted_count / feed.total_members) * 100}%` : '0%',
                  transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#fef2f2', border: '1.5px solid #fecaca',
            borderRadius: 8, padding: '10px 16px', marginBottom: 16,
            display: 'flex', justifyContent: 'space-between',
          }}>
            <p style={{ margin: 0, fontSize: 13, color: '#dc2626' }}>⚠️ {error}</p>
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16, padding: 0 }}>×</button>
          </div>
        )}

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 4, marginBottom: 20,
          background: '#f1f5f9', borderRadius: 10, padding: 4,
          border: '1.5px solid #e2e8f0',
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 7,
                background: activeTab === tab.id ? '#ffffff' : 'transparent',
                color: activeTab === tab.id ? '#1e293b' : '#64748b',
                border: activeTab === tab.id ? '1.5px solid #e2e8f0' : '1.5px solid transparent',
                cursor: 'pointer', fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'all 0.15s',
                boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              {tab.label}
              {tab.count != null && (
                <span style={{ background: '#5b4fff18', color: '#5b4fff', fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 99 }}>
                  {tab.count}
                </span>
              )}
              {tab.badge && (
                <span style={{
                  background: tab.badge === '✓' ? '#10b98120' : '#ef444420',
                  color: tab.badge === '✓' ? '#10b981' : '#ef4444',
                  fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 99,
                }}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab: Submit Form */}
        {activeTab === 'form' && (
          <div style={{ animation: 'fadeIn 0.2s ease' }}>
            {status?.submitted_today ? (
              <div style={{
                background: '#f0fdf4', border: '1.5px solid #bbf7d0',
                borderRadius: 12, padding: 24, textAlign: 'center',
              }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <h3 style={{ margin: '0 0 8px', color: '#15803d', fontSize: 16 }}>Standup Submitted!</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                  You've already submitted your standup for today.
                  {status.is_late && ' (Submitted late)'}
                </p>
                {submitResult?.analysis && (
                  <div style={{ marginTop: 20, textAlign: 'left' }}>
                    <AnalysisCard analysis={submitResult.analysis} />
                  </div>
                )}
                <button
                  onClick={() => setActiveTab('feed')}
                  style={{
                    marginTop: 16, padding: '8px 20px', borderRadius: 8,
                    background: '#ffffff', color: '#475569',
                    border: '1.5px solid #e2e8f0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >View Team Feed →</button>
              </div>
            ) : (
              <div style={{
                background: '#ffffff', border: '1.5px solid #e2e8f0',
                borderRadius: 12, padding: 24,
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              }}>
                {winStatus === 'closed' && (
                  <div style={{
                    background: '#fffbeb', border: '1.5px solid #fde68a',
                    borderRadius: 8, padding: '10px 14px', marginBottom: 20,
                  }}>
                    <p style={{ margin: 0, fontSize: 12, color: '#d97706' }}>
                      ⏰ The standup window (9–11 AM IST) has closed. You can still submit, but it will be marked as <strong>late</strong>.
                    </p>
                  </div>
                )}
                {winStatus === 'upcoming' && (
                  <div style={{
                    background: '#f5f3ff', border: '1.5px solid #ddd6fe',
                    borderRadius: 8, padding: '10px 14px', marginBottom: 20,
                  }}>
                    <p style={{ margin: 0, fontSize: 12, color: '#7c3aed' }}>
                      ⏳ Standup window opens at <strong>9:00 AM IST</strong>. You can submit early — it won't be marked late.
                    </p>
                  </div>
                )}

                <StandupForm onSubmit={handleSubmit} loading={submitting} />

                {submitResult && (
                  <div style={{ marginTop: 20 }}>
                    <AnalysisCard analysis={submitResult.analysis} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab: Team Feed */}
        {activeTab === 'feed' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn 0.2s ease' }}>
            <ScrumSummary summary={feed?.summary} onGenerate={handleGenerateSummary} generating={generatingSummary} />

            {feed?.missing?.length > 0 && <MissingMembersPanel missing={feed.missing} />}

            {feed?.standups?.length > 0 ? (
              feed.standups.map(s => <StandupCard key={s.id} standup={s} currentUser={user} />)
            ) : (
              <div style={{
                background: '#ffffff', border: '1.5px solid #e2e8f0',
                borderRadius: 12, padding: 40, textAlign: 'center',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>No standups submitted yet today.</p>
                <button
                  onClick={() => setActiveTab('form')}
                  style={{
                    marginTop: 12, padding: '8px 18px', borderRadius: 8,
                    background: '#5b4fff', color: '#fff', border: 'none',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >Submit Yours →</button>
              </div>
            )}
          </div>
        )}

        {/* Tab: My History */}
        {activeTab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeIn 0.2s ease' }}>
            {historyLoading ? (
              <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>Loading history...</p>
            ) : historyError ? (
              <div style={{
                background: '#fef2f2', border: '1.5px solid #fecaca',
                borderRadius: 12, padding: 24, textAlign: 'center',
              }}>
                <p style={{ margin: '0 0 12px', color: '#dc2626', fontSize: 13 }}>⚠️ {historyError}</p>
                <button
                  onClick={() => { setHistory([]); setHistoryError(null); loadHistory() }}
                  style={{
                    padding: '7px 18px', borderRadius: 8, background: '#5b4fff',
                    color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >Retry</button>
              </div>
            ) : history.length === 0 ? (
              <div style={{
                background: '#ffffff', border: '1.5px solid #e2e8f0',
                borderRadius: 12, padding: 40, textAlign: 'center',
              }}>
                <p style={{ margin: 0, color: '#94a3b8' }}>No standup history yet.</p>
              </div>
            ) : (
              history.map(s => (
                <div key={s.id} style={{
                  background: '#ffffff', border: '1.5px solid #e2e8f0',
                  borderRadius: 12, padding: 16,
                  borderLeft: `3px solid ${s.is_late ? '#f59e0b' : s.blockers ? '#ef4444' : '#5b4fff'}`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontWeight: 700, color: '#1e293b', fontSize: 13 }}>
                      {new Date(s.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {s.is_late && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', background: '#fef3c7', padding: '2px 7px', borderRadius: 99 }}>LATE</span>
                      )}
                      {!s.consistency_ok && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', background: '#fef2f2', padding: '2px 7px', borderRadius: 99 }}>INCONSISTENCY</span>
                      )}
                      {s.vague_score > 50 && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', background: '#fffbeb', padding: '2px 7px', borderRadius: 99 }}>VAGUE</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Yesterday</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.5 }}>{s.yesterday}</p>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Today</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.5 }}>{s.today}</p>
                    </div>
                  </div>
                  {s.blockers && (
                    <p style={{ margin: '10px 0 0', fontSize: 12, color: '#dc2626' }}>🚨 {s.blockers}</p>
                  )}
                  {s.ai_followup && (
                    <p style={{ margin: '8px 0 0', fontSize: 12, color: '#7c3aed', fontStyle: 'italic' }}>
                      💬 &ldquo;{s.ai_followup}&rdquo;
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}