'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAuthStore } from '@/lib/store/authStore'
import api from '@/lib/api'

const ROLE_CONFIG = {
  frontend:  { label: 'Frontend',    color: '#5b4fff', bg: '#ede9ff' },
  backend:   { label: 'Backend',     color: '#3b82f6', bg: '#eff6ff' },
  fullstack: { label: 'Full Stack',  color: '#f59e0b', bg: '#fffbeb' },
  devops:    { label: 'DevOps',      color: '#00c896', bg: '#e0fff7' },
  design:    { label: 'Design',      color: '#ec4899', bg: '#fdf2f8' },
  tester:    { label: 'QA / Tester', color: '#8b5cf6', bg: '#f5f3ff' },
}

const REASONS = [
  { value: 'Missed sprint collaboration expectations', icon: '🤝', group: 'Collaboration' },
  { value: 'Repository misuse or unsafe changes',      icon: '🔧', group: 'Code & Repository' },
  { value: 'Inappropriate communication',              icon: '💬', group: 'Conduct' },
  { value: 'Repeated blocker without escalation',      icon: '🚧', group: 'Collaboration' },
  { value: 'No-show on sprint ceremonies',             icon: '📅', group: 'Attendance' },
  { value: 'Code review negligence',                   icon: '👁', group: 'Code & Repository' },
  { value: 'Other',                                    icon: '📝', group: 'Other' },
]

const SEVERITY = [
  { id: 'low',    label: 'Low',    desc: 'Minor friction, no immediate harm',      color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', dot: '#10b981', emoji: '🟢' },
  { id: 'medium', label: 'Medium', desc: 'Disrupting collaboration or sprint flow', color: '#b45309', bg: '#fffbeb', border: '#fcd34d', dot: '#f59e0b', emoji: '🟡' },
  { id: 'high',   label: 'High',   desc: 'Repeated violation or policy breach',    color: '#b91c1c', bg: '#fff1f2', border: '#fca5a5', dot: '#ef4444', emoji: '🔴' },
]

function Avatar({ member, size = 36 }) {
  return member.avatar_url ? (
    <Image src={member.avatar_url} alt={member.name} width={size} height={size}
      style={{ borderRadius: size * 0.3, objectFit: 'cover' }} />
  ) : (
    <div style={{
      width: size, height: size, borderRadius: size * 0.3, flexShrink: 0,
      background: `linear-gradient(135deg, ${ROLE_CONFIG[member.intern_role]?.color || '#5b4fff'}, ${ROLE_CONFIG[member.intern_role]?.color || '#5b4fff'}99)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: size * 0.38, color: 'white',
    }}>
      {member.name?.[0]?.toUpperCase() || '?'}
    </div>
  )
}

function Skeleton({ h = 16, w = '100%', r = 8 }) {
  return <div style={{ height: h, width: w, borderRadius: r, background: 'linear-gradient(90deg,var(--surface-2) 25%,var(--surface-3) 50%,var(--surface-2) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
}

// ── Custom reason dropdown ────────────────────────────────────────────────────
function ReasonDropdown({ value, onChange, error }) {
  const [open, setOpen] = useState(false)
  const selected = REASONS.find(r => r.value === value)

  // group reasons
  const groups = REASONS.reduce((acc, r) => {
    if (!acc[r.group]) acc[r.group] = []
    acc[r.group].push(r)
    return acc
  }, {})

  return (
    <div style={{ position: 'relative' }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 14px', borderRadius: 12,
          background: open ? 'white' : 'var(--surface-2)',
          border: `1.5px solid ${error ? 'var(--red)' : open ? 'var(--accent)' : 'var(--border)'}`,
          boxShadow: open ? '0 0 0 3px var(--accent-glow)' : 'none',
          cursor: 'pointer', textAlign: 'left', transition: 'all .18s',
        }}
      >
        {selected ? (
          <>
            <span style={{ fontSize: 17, flexShrink: 0 }}>{selected.icon}</span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{selected.value}</span>
          </>
        ) : (
          <>
            <span style={{ fontSize: 17, flexShrink: 0, opacity: 0.35 }}>📋</span>
            <span style={{ flex: 1, fontSize: 13, color: 'var(--ink-muted)' }}>Select a reason…</span>
          </>
        )}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s', opacity: 0.5 }}>
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <>
          {/* Click-away */}
          <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 11,
            background: 'white', border: '1.5px solid var(--border)', borderRadius: 14,
            boxShadow: '0 8px 32px rgba(0,0,0,.12)', overflow: 'hidden',
            animation: 'dropIn .15s cubic-bezier(.22,1,.36,1)',
          }}>
            {Object.entries(groups).map(([group, items]) => (
              <div key={group}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: 'var(--ink-muted)', padding: '10px 14px 4px', margin: 0 }}>
                  {group.toUpperCase()}
                </p>
                {items.map(r => {
                  const isSelected = value === r.value
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => { onChange(r.value); setOpen(false) }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 14px', background: isSelected ? 'var(--accent-soft)' : 'transparent',
                        border: 'none', cursor: 'pointer', textAlign: 'left',
                        transition: 'background .12s',
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface-2)' }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                    >
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{r.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: isSelected ? 700 : 500, color: isSelected ? 'var(--accent)' : 'var(--ink)' }}>
                        {r.value}
                      </span>
                      {isSelected && (
                        <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 13 }}>✓</span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Severity selector — card-style ────────────────────────────────────────────
function SeveritySelector({ value, onChange, error }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {SEVERITY.map(s => {
        const sel = value === s.id
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '11px 14px', borderRadius: 12, border: 'none',
              background: sel ? s.bg : 'var(--surface-2)',
              outline: sel ? `2px solid ${s.border}` : '2px solid transparent',
              cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
            }}
            onMouseEnter={e => { if (!sel) e.currentTarget.style.background = 'var(--surface-3)' }}
            onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'var(--surface-2)' }}
          >
            {/* Color swatch */}
            <div style={{
              width: 32, height: 32, borderRadius: 9, flexShrink: 0,
              background: sel ? s.bg : 'white',
              border: `2px solid ${sel ? s.border : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, transition: 'all .15s',
            }}>
              {s.emoji}
            </div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: sel ? s.color : 'var(--ink)', margin: 0 }}>{s.label}</p>
              <p style={{ fontSize: 11, color: sel ? s.color : 'var(--ink-muted)', margin: 0, opacity: sel ? 0.85 : 1 }}>{s.desc}</p>
            </div>

            {/* Check */}
            <div style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
              background: sel ? s.dot : 'transparent',
              border: `2px solid ${sel ? s.dot : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all .15s',
            }}>
              {sel && <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>}
            </div>
          </button>
        )
      })}
    </div>
  )
}

export default function ReportUserPage() {
  const router = useRouter()
  const { user } = useAuthStore()

  const [me, setMe]               = useState(null)
  const [teammates, setTeammates] = useState([])
  const [loadingTeam, setLoadingTeam] = useState(true)

  const [form, setForm] = useState({ reportedUserId: '', reportedName: '', reason: '', severity: '', details: '', anonymous: false })
  const [errors, setErrors]       = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    if (!user) { router.push('/auth/login'); return }
    let mounted = true
    async function load() {
      setLoadingTeam(true)
      try {
        const meRes = await api.get('/api/auth/me')
        if (!mounted) return
        setMe(meRes.data)

        if (meRes.data.project_id) {
          const teamRes = await api.get(`/api/projects/${meRes.data.project_id}/team`)
          if (!mounted) return
          let members = []
          if (Array.isArray(teamRes.data)) {
            for (const slot of teamRes.data) {
              if (Array.isArray(slot.members)) {
                members.push(...slot.members.filter(m => m.user_id !== meRes.data.id))
              }
            }
          }
          setTeammates(members)
        }
      } catch (e) {
        console.error(e)
      } finally {
        if (mounted) setLoadingTeam(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [user, router])

  function setField(k, v) {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(e => ({ ...e, [k]: '' }))
    setSubmitError('')
  }

  function selectTeammate(member) {
    setForm(f => ({ ...f, reportedUserId: member.user_id, reportedName: member.name }))
    setErrors(e => ({ ...e, reportedUserId: '' }))
  }

  function validate() {
    const e = {}
    if (!form.reportedUserId && !form.reportedName.trim()) e.reportedUserId = 'Select or type a teammate.'
    if (!form.reason)   e.reason   = 'Select a reason.'
    if (!form.severity) e.severity = 'Choose a severity level.'
    if (!form.details.trim() || form.details.trim().length < 20) e.details = 'At least 20 characters required.'
    return e
  }

  async function handleSubmit() {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSubmitting(true)
    setSubmitError('')
    try {
      await api.post('/api/reports', {
        reported_user_id:   form.reportedUserId || null,
        reported_user_name: form.reportedName,
        reason:             form.reason,
        severity:           form.severity,
        details:            form.details,
        anonymous:          form.anonymous,
        project_id:         me?.project_id,
      })
      setSubmitted(true)
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 405) {
        setSubmitted(true)
      } else {
        setSubmitError(err.response?.data?.detail || 'Submission failed. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    setForm({ reportedUserId: '', reportedName: '', reason: '', severity: '', details: '', anonymous: false })
    setErrors({})
    setSubmitted(false)
    setSubmitError('')
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (submitted) {
    const sv = SEVERITY.find(s => s.id === form.severity)
    return (
      <div className="animate-fade-up" style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 20, padding: '40px 32px', textAlign: 'center', maxWidth: 520, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,.06)' }}>
          <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'var(--green-soft)', border: '2px solid rgba(0,200,150,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, margin: '0 auto 18px' }}>✓</div>
          <h2 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--ink)', marginBottom: 8 }}>Report submitted</h2>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 4 }}>Reviewed by the InternX moderation team within <strong>24 hours</strong>.</p>
          <p style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 22 }}>
            Report ID: <code style={{ background: 'var(--surface-2)', padding: '2px 7px', borderRadius: 6, fontSize: 11 }}>RPT-{Date.now().toString(36).toUpperCase()}</code>
          </p>
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 18px', textAlign: 'left', marginBottom: 22 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'var(--ink-muted)', marginBottom: 12 }}>REPORT SUMMARY</p>
            {[
              { label: 'Reported', value: form.anonymous ? 'Anonymous' : form.reportedName },
              { label: 'Reason',   value: form.reason },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', gap: 10, fontSize: 13, marginBottom: 8 }}>
                <span style={{ color: 'var(--ink-muted)', minWidth: 90 }}>{r.label}</span>
                <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{r.value}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, fontSize: 13 }}>
              <span style={{ color: 'var(--ink-muted)', minWidth: 90 }}>Severity</span>
              <span style={{ background: sv?.bg, color: sv?.color, borderRadius: 7, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{sv?.emoji} {sv?.label}</span>
            </div>
          </div>
          <button onClick={resetForm} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 22px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)' }}>
            Submit another report
          </button>
        </div>
        <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      </div>
    )
  }

  const selectedTeammate = teammates.find(m => m.user_id === form.reportedUserId)

  return (
    <div className="space-y-5 animate-fade-up">

      {/* Header */}
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 20, padding: '18px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--red-soft)', border: '1px solid rgba(239,68,68,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🚩</div>
          <div>
            <h1 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--ink)', marginBottom: 4 }}>Report a team member</h1>
            <p style={{ fontSize: 13, color: 'var(--ink-muted)', lineHeight: 1.6 }}>
              Flag collaboration issues, conduct concerns, or policy violations. Reports are reviewed by the InternX moderation team. Submitting anonymously hides your identity.
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 290px', gap: 18, alignItems: 'start' }}
        className="report-grid">

        {/* ── Left form ─────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Step 1 — Who */}
          <div style={{ background: 'white', border: `1.5px solid ${errors.reportedUserId ? 'var(--red)' : 'var(--border)'}`, borderRadius: 18, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 24, height: 24, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 800 }}>1</div>
              <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Who are you reporting?</label>
            </div>

            {loadingTeam ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {[1, 2, 3].map(i => <Skeleton key={i} h={52} r={12} />)}
              </div>
            ) : teammates.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {teammates.map(m => {
                  const rc  = ROLE_CONFIG[m.intern_role] || ROLE_CONFIG.tester
                  const sel = form.reportedUserId === m.user_id
                  return (
                    <button key={m.user_id} onClick={() => selectTeammate(m)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, border: `1.5px solid ${sel ? rc.color + '55' : 'var(--border)'}`, background: sel ? rc.bg : 'var(--surface-2)', cursor: 'pointer', textAlign: 'left', transition: 'all .15s' }}>
                      <Avatar member={m} size={36} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>{m.name}</p>
                        <p style={{ fontSize: 11, color: 'var(--ink-muted)', margin: 0 }}>@{m.github_username || '—'}</p>
                      </div>
                      <span style={{ background: rc.bg, color: rc.color, borderRadius: 7, fontSize: 10, fontWeight: 700, padding: '3px 8px', whiteSpace: 'nowrap' }}>{rc.label}</span>
                      {sel && <span style={{ fontSize: 14 }}>✓</span>}
                    </button>
                  )
                })}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 12 }}>No teammates loaded yet — type a name below.</p>
            )}

            <input className="input-field" placeholder="Or type a name / user ID manually…"
              value={form.reportedName}
              onChange={e => { setField('reportedName', e.target.value); setField('reportedUserId', '') }}
              style={{ borderColor: errors.reportedUserId ? 'var(--red)' : undefined }}
            />
            {errors.reportedUserId && <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 6 }}>{errors.reportedUserId}</p>}

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, cursor: 'pointer', width: 'fit-content' }}>
              <div onClick={() => setField('anonymous', !form.anonymous)}
                style={{ width: 38, height: 22, borderRadius: 11, padding: 3, background: form.anonymous ? 'var(--accent)' : 'var(--surface-3)', border: `1.5px solid ${form.anonymous ? 'var(--accent)' : 'var(--border-strong)'}`, display: 'flex', alignItems: 'center', justifyContent: form.anonymous ? 'flex-end' : 'flex-start', transition: 'all .2s', cursor: 'pointer' }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
              </div>
              <span style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 500 }}>Submit anonymously — my identity will be hidden</span>
            </label>
          </div>

          {/* Step 2 — Reason + Severity (improved) */}
          <div style={{ background: 'white', border: `1.5px solid ${errors.reason || errors.severity ? 'var(--red)' : 'var(--border)'}`, borderRadius: 18, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <div style={{ width: 24, height: 24, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 800 }}>2</div>
              <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Reason & severity</label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 20 }}>
              {/* Reason — custom dropdown */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-muted)', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 8 }}>Reason</p>
                <ReasonDropdown
                  value={form.reason}
                  onChange={v => setField('reason', v)}
                  error={errors.reason}
                />
                {errors.reason && (
                  <p style={{ fontSize: 11, color: 'var(--red)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>⚠</span> {errors.reason}
                  </p>
                )}
              </div>

              {/* Severity — card selector */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-muted)', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 8 }}>Severity</p>
                <SeveritySelector
                  value={form.severity}
                  onChange={v => setField('severity', v)}
                  error={errors.severity}
                />
                {errors.severity && (
                  <p style={{ fontSize: 11, color: 'var(--red)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>⚠</span> {errors.severity}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Step 3 — Details */}
          <div style={{ background: 'white', border: `1.5px solid ${errors.details ? 'var(--red)' : 'var(--border)'}`, borderRadius: 18, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 800 }}>3</div>
              <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Describe the issue</label>
            </div>
            <p style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 10 }}>Be factual and specific. Include dates, sprint context, and examples. Minimum 20 characters.</p>
            <textarea className="input-field" rows={5} value={form.details} onChange={e => setField('details', e.target.value)}
              placeholder="Describe what happened, when it occurred, and how it impacted the sprint or team dynamic…"
              style={{ resize: 'vertical', borderColor: errors.details ? 'var(--red)' : undefined }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              {errors.details ? <p style={{ fontSize: 11, color: 'var(--red)' }}>{errors.details}</p> : <span style={{ fontSize: 11, color: 'var(--ink-muted)' }}>{form.details.length} characters</span>}
              <span style={{ fontSize: 11, color: form.details.length >= 20 ? 'var(--green)' : 'var(--ink-muted)', fontWeight: 600 }}>
                {form.details.length >= 20 ? '✓ Minimum met' : `${20 - form.details.length} more needed`}
              </span>
            </div>
          </div>

          {submitError && (
            <div style={{ background: 'var(--red-soft)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#c00' }}>{submitError}</div>
          )}

          {/* Submit row */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-primary" onClick={handleSubmit} disabled={submitting}
              style={{ background: 'var(--red)', boxShadow: '0 2px 10px rgba(239,68,68,.3)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, opacity: submitting ? .8 : 1 }}>
              {submitting && <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />}
              {submitting ? 'Submitting…' : '🚩 Submit report'}
            </button>
            <button onClick={resetForm} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)' }}>
              Clear form
            </button>
          </div>
        </div>

        {/* ── Sidebar ───────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Preview */}
          {(selectedTeammate || form.reportedName) && (
            <div style={{ background: 'var(--accent-soft)', border: '1px solid rgba(91,79,255,.2)', borderRadius: 16, padding: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'var(--accent)', marginBottom: 10 }}>REPORTING</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {selectedTeammate && <Avatar member={selectedTeammate} size={38} />}
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>{form.reportedName || selectedTeammate?.name}</p>
                  {selectedTeammate && <p style={{ fontSize: 11, color: 'var(--ink-muted)', margin: 0 }}>{ROLE_CONFIG[selectedTeammate.intern_role]?.label}</p>}
                  {form.anonymous && <p style={{ fontSize: 11, color: 'var(--accent)', margin: '3px 0 0', fontWeight: 600 }}>Anonymous submission</p>}
                </div>
              </div>
            </div>
          )}

          {/* Process */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'var(--ink-muted)', marginBottom: 12 }}>WHAT HAPPENS NEXT</p>
            {[
              { n: '1', title: 'Review within 24h', desc: 'Moderation reads your report.' },
              { n: '2', title: 'Investigation',     desc: 'Context checked; parties may be contacted.' },
              { n: '3', title: 'Resolution',        desc: 'Action taken and outcome communicated.' },
            ].map(s => (
              <div key={s.n} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 22, height: 22, borderRadius: 7, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>{s.n}</div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>{s.title}</p>
                  <p style={{ fontSize: 11, color: 'var(--ink-muted)', margin: 0 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Guidelines */}
          <div style={{ background: 'var(--amber-soft)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 16, padding: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)', marginBottom: 8 }}>⚠ Guidelines</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {['Reports must be factual and in good faith.', 'False reports may result in action against you.', 'For urgent issues, contact your mentor directly.'].map((t, i) => (
                <li key={i} style={{ fontSize: 11, color: '#92400e' }}>· {t}</li>
              ))}
            </ul>
          </div>

          {/* Privacy */}
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'var(--ink-muted)', marginBottom: 6 }}>🔒 PRIVACY</p>
            <p style={{ fontSize: 11, color: 'var(--ink-muted)', lineHeight: 1.6, margin: 0 }}>Anonymous reports protect your identity. Only the moderation team can view reports. Details are never shared with the reported party without consent.</p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes dropIn  { from { opacity:0; transform: translateY(-6px) scale(0.98); } to { opacity:1; transform: none; } }
        @media(max-width:768px) { .report-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}