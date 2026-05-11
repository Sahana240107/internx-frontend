'use client'
/**
 * Student Detail — app/recruiter/student/[id]/page.jsx
 * Improved Performance Metrics layout + Task Breakdown. GitHub stats removed.
 */
import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell,
} from 'recharts'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

// ── Metric definitions ────────────────────────────────────────────────────────
const METRICS = [
  { key: 'communication',     label: 'Communication',     icon: '💬', desc: 'Clarity in updates and comments',    accent: '#6366f1' },
  { key: 'collaboration',     label: 'Collaboration',     icon: '🤝', desc: 'Teamwork and peer interactions',     accent: '#0891b2' },
  { key: 'reliability',       label: 'Reliability',       icon: '⏱️', desc: 'On-time delivery of tasks',         accent: '#059669' },
  { key: 'pr_quality',        label: 'PR Quality',        icon: '🔀', desc: 'Code quality in pull requests',     accent: '#7c3aed' },
  { key: 'leadership',        label: 'Leadership',        icon: '🧭', desc: 'Initiative & high-priority work',   accent: '#d97706' },
  { key: 'response_time',     label: 'Response Time',     icon: '⚡', desc: 'Speed of picking up tasks',        accent: '#0284c7' },
  { key: 'incident_handling', label: 'Incident Handling', icon: '🛡️', desc: 'Handling blockers / critical work', accent: '#dc2626' },
]

function deriveMetrics(tasks = []) {
  const total  = tasks.length || 1
  const done   = tasks.filter(t => t.status === 'done').length
  const hasPR  = tasks.filter(t => t.github_pr_url).length
  const hiDone = tasks.filter(t => t.priority === 'high' && t.status === 'done').length
  const scored = tasks.filter(t => t.score != null)
  const avg    = scored.length ? scored.reduce((a, b) => a + b.score, 0) / scored.length : 50
  const active = tasks.filter(t => t.status === 'review' || t.status === 'in_progress').length
  return {
    communication:     Math.min(100, Math.round(55 + (done / total) * 45)),
    collaboration:     Math.min(100, Math.round(45 + (hasPR / total) * 55)),
    reliability:       Math.min(100, Math.round((done / total) * 100)),
    pr_quality:        Math.min(100, Math.round(avg * 0.75 + (hasPR / total) * 25)),
    leadership:        Math.min(100, Math.round(35 + (hiDone / total) * 65)),
    response_time:     Math.min(100, Math.round(55 + (active / total) * 45)),
    incident_handling: Math.min(100, Math.round(avg * 0.65 + 35)),
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const scoreCol    = s => s >= 85 ? '#059669' : s >= 70 ? '#4f46e5' : s >= 50 ? '#d97706' : '#dc2626'
const scoreBg     = s => s >= 85 ? '#ecfdf5' : s >= 70 ? '#eef2ff' : s >= 50 ? '#fffbeb' : '#fef2f2'
const scoreBorder = s => s >= 85 ? '#a7f3d0' : s >= 70 ? '#c7d2fe' : s >= 50 ? '#fde68a' : '#fecaca'
const scoreLabel  = s => s >= 85 ? 'Excellent' : s >= 70 ? 'Good' : s >= 50 ? 'Average' : 'Needs work'
const isOnline    = ts => ts && (Date.now() - new Date(ts).getTime()) < 5 * 60_000
const timeAgo     = ts => {
  if (!ts) return 'Never'
  const m = Math.floor((Date.now() - new Date(ts)) / 60_000)
  return m < 1 ? 'Just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`
}
const fmtDate = ts => ts ? new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ user, size = 80 }) {
  const init = (user?.name || user?.email || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const colors = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed']
  const bg = colors[(user?.email || user?.name || '').charCodeAt(0) % colors.length]
  return user?.avatar_url
    ? <img src={user.avatar_url} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: size * 0.35, fontWeight: 700 }}>{init}</div>
}

// ── Improved Metric Card ───────────────────────────────────────────────────────
function MetricCard({ label, icon, value, desc, accent }) {
  const pct = value
  // Use the metric's own accent for brand consistency, but mute it if score is low
  const barColor = value >= 50 ? accent : scoreCol(value)
  const textColor = scoreCol(value)

  return (
    <div style={{
      background: '#fff',
      borderRadius: 18,
      border: '1.5px solid #eef0f6',
      padding: '18px 20px 16px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle top accent stripe */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${accent}, ${accent}55)`, borderRadius: '18px 18px 0 0' }} />

      {/* Top row: icon + label + score */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 13,
          background: accent + '12',
          border: `1.5px solid ${accent}22`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, flexShrink: 0,
        }}>{icon}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>{label}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{desc}</div>
        </div>

        {/* Score pill */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '6px 12px', borderRadius: 12,
          background: scoreBg(value), border: `1.5px solid ${scoreBorder(value)}`,
          minWidth: 56, flexShrink: 0,
        }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: textColor, letterSpacing: '-0.04em', lineHeight: 1 }}>{value}</span>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: textColor, opacity: 0.75, marginTop: 1, whiteSpace: 'nowrap' }}>{scoreLabel(value)}</span>
        </div>
      </div>

      {/* Progress bar with segmented look */}
      <div style={{ position: 'relative' }}>
        {/* Track */}
        <div style={{ height: 8, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: 99,
            background: `linear-gradient(90deg, ${barColor}99, ${barColor})`,
            transition: 'width 1s cubic-bezier(.4,0,.2,1)',
            position: 'relative',
          }}>
            {/* Shimmer effect */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 99,
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)',
            }} />
          </div>
        </div>
        {/* Tick marks at 25, 50, 75 */}
        {[25, 50, 75].map(tick => (
          <div key={tick} style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `${tick}%`, width: 1,
            background: '#e2e8f0',
            pointerEvents: 'none',
          }} />
        ))}
        {/* Percentage label */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
          <span style={{ fontSize: 10, color: '#cbd5e1' }}>0</span>
          <span style={{ fontSize: 10, color: '#cbd5e1' }}>50</span>
          <span style={{ fontSize: 10, color: '#cbd5e1' }}>100</span>
        </div>
      </div>
    </div>
  )
}

// ── Task Breakdown — improved ─────────────────────────────────────────────────
function TaskBreakdown({ statusCounts, completion, totalTasks }) {
  const items = [
    { key: 'todo',        label: 'To Do',       count: statusCounts.todo,        color: '#94a3b8', icon: '○', bg: '#f8fafc', border: '#e2e8f0' },
    { key: 'in_progress', label: 'In Progress', count: statusCounts.in_progress, color: '#4f46e5', icon: '◑', bg: '#eef2ff', border: '#c7d2fe' },
    { key: 'review',      label: 'In Review',   count: statusCounts.review,      color: '#d97706', icon: '◕', bg: '#fffbeb', border: '#fde68a' },
    { key: 'done',        label: 'Completed',   count: statusCounts.done,        color: '#059669', icon: '●', bg: '#ecfdf5', border: '#a7f3d0' },
  ]

  return (
    <div style={{ background: '#fff', borderRadius: 20, border: '1.5px solid #eef0f6', padding: '22px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>Task Breakdown</h3>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>{totalTasks} tasks total</p>
        </div>
        {/* Overall completion ring */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="52" height="52" viewBox="0 0 52 52">
            <circle cx="26" cy="26" r="21" fill="none" stroke="#f1f5f9" strokeWidth="6" />
            <circle
              cx="26" cy="26" r="21" fill="none"
              stroke={completion >= 70 ? '#059669' : completion >= 40 ? '#d97706' : '#dc2626'}
              strokeWidth="6"
              strokeDasharray={`${2 * Math.PI * 21}`}
              strokeDashoffset={`${2 * Math.PI * 21 * (1 - completion / 100)}`}
              strokeLinecap="round"
              transform="rotate(-90 26 26)"
              style={{ transition: 'stroke-dashoffset 1s ease' }}
            />
            <text x="26" y="31" textAnchor="middle" fontSize="11" fontWeight="800" fill="#0f172a">{completion}%</text>
          </svg>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>Done</div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>completion</div>
          </div>
        </div>
      </div>

      {/* 4 status cards in a row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
        {items.map(item => (
          <div key={item.key} style={{
            padding: '14px 10px 12px',
            borderRadius: 14,
            background: item.bg,
            border: `1.5px solid ${item.border}`,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: item.color, letterSpacing: '-0.04em', lineHeight: 1 }}>{item.count}</div>
            <div style={{ fontSize: 10.5, color: item.color, fontWeight: 700, marginTop: 5, opacity: 0.8 }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* Stacked progress bar */}
      <div>
        <div style={{ display: 'flex', height: 10, borderRadius: 99, overflow: 'hidden', gap: 2 }}>
          {items.filter(i => i.count > 0).map(item => (
            <div key={item.key}
              title={`${item.label}: ${item.count}`}
              style={{
                flex: item.count,
                background: item.color,
                transition: 'flex 0.8s ease',
                minWidth: item.count > 0 ? 4 : 0,
                opacity: item.key === 'done' ? 1 : 0.7,
              }}
            />
          ))}
          {/* Empty remainder */}
          {totalTasks === 0 && <div style={{ flex: 1, background: '#f1f5f9' }} />}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          {items.map(item => (
            <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: item.color, opacity: item.key === 'done' ? 1 : 0.6 }} />
              <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── StatPill ──────────────────────────────────────────────────────────────────
function StatPill({ label, value, color }) {
  return (
    <div style={{ padding: '12px 18px', borderRadius: 14, textAlign: 'center', minWidth: 88, background: color + '0f', border: `1.5px solid ${color}25` }}>
      <div style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: '-0.04em', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 5, fontWeight: 500 }}>{label}</div>
    </div>
  )
}

const TABS = ['Overview', 'Activity', 'Reputation Graph']

// ── Main ──────────────────────────────────────────────────────────────────────
export default function StudentDetailPage() {
  const router    = useRouter()
  const params    = useParams()
  const studentId = params?.id ?? null

  const [student,   setStudent]   = useState(null)
  const [tasks,     setTasks]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [activeTab, setActiveTab] = useState('Overview')

  const fetchData = useCallback(async (tokenArg) => {
    if (!studentId) { setError('No student ID in URL'); setLoading(false); return }
    setLoading(true); setError('')
    const token = tokenArg || localStorage.getItem('recruiter_token')
    if (!token) { router.push('/auth/recruiter-login'); return }
    const headers = { 'Authorization': `Bearer ${token}` }

    try {
      let res = await fetch(`${API_URL}/api/recruiter/students/${studentId}`, { headers })

      if (res.status === 404 || res.status === 405) {
        const listRes = await fetch(`${API_URL}/api/recruiter/students`, { headers })
        if (listRes.ok) {
          const all = await listRes.json()
          const found = (Array.isArray(all) ? all : []).find(s => String(s.id) === String(studentId))
          if (found) { setStudent(found); setTasks(found.tasks || []); setLoading(false); return }
        }
        setStudent(null); setLoading(false); return
      }

      if (res.status === 401) {
        localStorage.removeItem('recruiter_token'); localStorage.removeItem('recruiter_user')
        router.push('/auth/recruiter-login'); return
      }
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || `Error ${res.status}`) }

      const data = await res.json()
      setStudent(data); setTasks(data.tasks || [])
    } catch (e) {
      setError(e.message || 'Failed to load student')
    } finally {
      setLoading(false)
    }
  }, [studentId, router])

  useEffect(() => {
    const token = localStorage.getItem('recruiter_token')
    if (!token) { router.push('/auth/recruiter-login'); return }
    fetchData(token)
  }, [studentId]) // eslint-disable-line

  const pageStyle = { minHeight: '100vh', background: '#f8fafc', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#0f172a' }

  if (loading) return (
    <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&family=Syne:wght@700;800&display=swap');`}</style>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 0.75s linear infinite', margin: '0 auto 14px' }} />
        <p style={{ color: '#94a3b8', fontSize: 14, fontWeight: 500 }}>Loading profile…</p>
      </div>
    </div>
  )

  if (error) return (
    <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <div style={{ fontSize: 52, marginBottom: 14 }}>⚠️</div>
        <p style={{ color: '#dc2626', fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{error}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18 }}>
          <button onClick={() => fetchData()} style={{ padding: '10px 20px', borderRadius: 11, background: '#eef2ff', border: '1px solid #c7d2fe', color: '#4f46e5', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>
          <button onClick={() => router.back()} style={{ padding: '10px 20px', borderRadius: 11, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>← Go back</button>
        </div>
      </div>
    </div>
  )

  if (!student) return (
    <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 14 }}>🔍</div>
        <p style={{ color: '#334155', fontSize: 16, fontWeight: 700 }}>Student not found</p>
        <button onClick={() => router.back()} style={{ marginTop: 14, padding: '10px 20px', borderRadius: 11, background: '#eef2ff', border: '1px solid #c7d2fe', color: '#4f46e5', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>← Go back</button>
      </div>
    </div>
  )

  // ── Derived data ──────────────────────────────────────────────────────
  const metrics    = deriveMetrics(tasks)
  const scored     = tasks.filter(t => t.score != null)
  const avgScore   = scored.length ? Math.round(scored.reduce((a, b) => a + b.score, 0) / scored.length) : null
  const online     = isOnline(student.last_seen)
  const statusCts  = { todo: 0, in_progress: 0, review: 0, done: 0 }
  tasks.forEach(t => { if (statusCts[t.status] !== undefined) statusCts[t.status]++ })
  const completion = tasks.length ? Math.round((statusCts.done / tasks.length) * 100) : 0
  const radarData  = METRICS.map(m => ({ subject: m.label.split(' ')[0], value: metrics[m.key], fullMark: 100 }))
  const timeline   = [...tasks]
    .filter(t => t.score != null && t.updated_at)
    .sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at))
    .slice(-12)
    .map(t => ({ date: new Date(t.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), score: t.score }))
  const barData = Object.entries(statusCts).map(([k, v]) => ({
    name:  { todo: 'To Do', in_progress: 'In Prog', review: 'Review', done: 'Done' }[k],
    count: v,
    color: { todo: '#cbd5e1', in_progress: '#4f46e5', review: '#d97706', done: '#059669' }[k],
  }))

  const accentC  = avgScore != null ? scoreCol(avgScore) : '#4f46e5'
  const mailHref = `mailto:${student.email}?subject=Opportunity via InternX — ${encodeURIComponent(student.name || 'there')}&body=Hi ${encodeURIComponent(student.name || 'there')},%0A%0AI came across your profile on InternX and would love to connect.%0A%0ABest regards`

  // Overall performance score (weighted avg of all metrics)
  const overallScore = Math.round(Object.values(metrics).reduce((a, b) => a + b, 0) / METRICS.length)

  return (
    <div style={pageStyle}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&family=Syne:wght@700;800&display=swap');
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        @keyframes dotPulse{ 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(.7)} }
        .ix-fade { animation: fadeUp .25s ease both; }
        .ix-tab  { border: none; cursor: pointer; font-family: inherit; transition: all .15s; }
        .ix-tab:hover { color: #0f172a !important; }
        .contact-btn { transition: all .2s cubic-bezier(.4,0,.2,1); text-decoration: none; }
        .contact-btn:hover { transform: translateY(-2px); box-shadow: 0 14px 32px rgba(5,150,105,0.35) !important; }
        .github-btn  { transition: all .18s; text-decoration: none; }
        .github-btn:hover  { transform: translateY(-2px); border-color: #a5b4fc !important; box-shadow: 0 8px 24px rgba(79,70,229,0.2) !important; }
        .back-btn { border: none; cursor: pointer; font-family: inherit; transition: background .14s; }
        .back-btn:hover { background: #f1f5f9 !important; }
        .metric-card { transition: transform .18s, box-shadow .18s; }
        .metric-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.08) !important; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 99px; }
      `}</style>

      {/* ── Topbar ── */}
      <div style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid #e8ecf4', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', padding: '0 32px', height: 58, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="back-btn" onClick={() => router.back()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', background: 'transparent', fontSize: 13, fontWeight: 600, padding: '7px 12px', borderRadius: 10 }}>
            ← All Students
          </button>
          <div style={{ flex: 1 }} />
          <span style={{ padding: '3px 11px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Recruiter View</span>
          <button className="back-btn" onClick={() => fetchData()}
            style={{ padding: '6px 13px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12.5, fontWeight: 600, color: '#64748b' }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1140, margin: '0 auto', padding: '28px 32px 72px' }}>

        {/* ── Hero Card ── */}
        <div style={{ background: '#fff', borderRadius: 24, border: '1.5px solid #e8ecf4', padding: '28px 32px', marginBottom: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${accentC}, ${accentC}55)` }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
            {/* Avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ padding: 3, borderRadius: '50%', background: avgScore != null ? `conic-gradient(${accentC} ${avgScore}%, #e2e8f0 ${avgScore}%)` : '#e2e8f0', boxShadow: '0 0 0 2px #fff' }}>
                <div style={{ padding: 3, borderRadius: '50%', background: '#fff' }}><Avatar user={student} size={78} /></div>
              </div>
              {online && <span style={{ position: 'absolute', bottom: 4, right: 4, width: 16, height: 16, borderRadius: '50%', background: '#22c55e', border: '3px solid #fff', animation: 'dotPulse 2s ease infinite' }} />}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 200, paddingTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.04em', fontFamily: 'Syne, sans-serif' }}>{student.name || 'Unnamed'}</h1>
                {student.intern_role && (
                  <span style={{ padding: '3px 11px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: '#eef2ff', color: '#4f46e5', textTransform: 'capitalize', border: '1px solid #c7d2fe' }}>{student.intern_role}</span>
                )}
                {online
                  ? <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'dotPulse 2s ease infinite' }} />Online now
                    </span>
                  : <span style={{ fontSize: 12.5, color: '#94a3b8', fontWeight: 500 }}>Last seen {timeAgo(student.last_seen)}</span>
                }
              </div>
              <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: '3px 14px' }}>
                <span>📧 {student.email}</span>
                {student.github_username && <span>🐙 @{student.github_username}</span>}
                <span>📅 Joined {fmtDate(student.created_at)}</span>
              </div>
              {student.bio && <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 14px', lineHeight: 1.7, fontStyle: 'italic', maxWidth: 480 }}>"{student.bio}"</p>}

              {/* Quick stats */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[
                  { l: 'Avg Score',    v: avgScore ?? '—',  c: avgScore != null ? scoreCol(avgScore) : '#94a3b8' },
                  { l: 'Overall',      v: overallScore,     c: scoreCol(overallScore) },
                  { l: 'Completion',   v: `${completion}%`, c: '#059669' },
                  { l: 'Tasks',        v: tasks.length,     c: '#4f46e5' },
                  { l: 'PRs Linked',   v: tasks.filter(t => t.github_pr_url).length, c: '#7c3aed' },
                ].map(st => (
                  <div key={st.l} style={{ padding: '9px 16px', borderRadius: 12, background: st.c + '0d', border: `1.5px solid ${st.c}20`, textAlign: 'center', minWidth: 76 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: st.c, lineHeight: 1, letterSpacing: '-0.03em' }}>{st.v}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, fontWeight: 500 }}>{st.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Action buttons ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0, minWidth: 210 }}>
              <a href={mailHref} className="contact-btn"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '15px 24px', borderRadius: 14, background: 'linear-gradient(135deg, #059669, #047857)', color: '#fff', fontSize: 14, fontWeight: 700, boxShadow: '0 4px 16px rgba(5,150,105,0.3)', border: '1.5px solid #34d399' }}>
                <svg width="17" height="17" fill="none" viewBox="0 0 24 24">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Contact Student
              </a>

              {student.github_username
                ? <a href={`https://github.com/${student.github_username}`} target="_blank" rel="noreferrer" className="github-btn"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '15px 24px', borderRadius: 14, background: '#fff', color: '#1e293b', fontSize: 14, fontWeight: 700, border: '1.5px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                    <svg width="17" height="17" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                    View GitHub Profile ↗
                  </a>
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '15px 24px', borderRadius: 14, background: '#f8fafc', color: '#94a3b8', fontSize: 13, fontWeight: 600, border: '1.5px dashed #e2e8f0' }}>
                    No GitHub linked
                  </div>
              }
              <p style={{ margin: 0, fontSize: 10.5, color: '#94a3b8', textAlign: 'center' }}>
                {student.github_username ? `@${student.github_username} on GitHub` : 'Contact via email only'}
              </p>
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 3, padding: 4, borderRadius: 14, background: '#fff', border: '1.5px solid #e8ecf4', width: 'fit-content', marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          {TABS.map(tab => (
            <button key={tab} className="ix-tab" onClick={() => setActiveTab(tab)}
              style={{ padding: '9px 22px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: activeTab === tab ? '#0f172a' : 'transparent', color: activeTab === tab ? '#fff' : '#64748b', boxShadow: activeTab === tab ? '0 2px 8px rgba(15,23,42,0.18)' : 'none' }}>
              {tab}
            </button>
          ))}
        </div>

        {/* ──────────────────────────────────────────────────────────────────── */}
        {/* OVERVIEW TAB */}
        {/* ──────────────────────────────────────────────────────────────────── */}
        {activeTab === 'Overview' && (
          <div className="ix-fade">

            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em', fontFamily: 'Syne, sans-serif' }}>Performance Metrics</h2>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: '3px 0 0' }}>Derived from task history · 7 dimensions</p>
              </div>
              {/* Overall score badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderRadius: 14, background: scoreBg(overallScore), border: `1.5px solid ${scoreBorder(overallScore)}` }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: scoreCol(overallScore), opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Overall</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: scoreCol(overallScore), letterSpacing: '-0.05em', lineHeight: 1 }}>{overallScore}</div>
                </div>
                <div style={{ fontSize: 11, color: scoreCol(overallScore), fontWeight: 700 }}>{scoreLabel(overallScore)}</div>
              </div>
            </div>

            {/* Metrics grid — 2 columns on wide, 1 on narrow */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, marginBottom: 28 }}>
              {METRICS.map((m, i) => (
                <div key={m.key} className="metric-card" style={{ animationDelay: `${i * 0.04}s` }}>
                  <MetricCard {...m} value={metrics[m.key]} />
                </div>
              ))}
            </div>

            {/* Task Breakdown — full width, improved */}
            <TaskBreakdown statusCounts={statusCts} completion={completion} totalTasks={tasks.length} />
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────────────── */}
        {/* ACTIVITY TAB */}
        {/* ──────────────────────────────────────────────────────────────────── */}
        {activeTab === 'Activity' && (
          <div className="ix-fade">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em', fontFamily: 'Syne, sans-serif' }}>All Tasks</h2>
              <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500, background: '#f1f5f9', padding: '4px 12px', borderRadius: 99 }}>{tasks.length} tasks</span>
            </div>

            {tasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8' }}>
                <div style={{ fontSize: 46, marginBottom: 14 }}>📋</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#334155' }}>No tasks assigned yet</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tasks.map(task => {
                  const sc = {
                    todo:        { color: '#94a3b8', label: 'To Do',       bg: '#f8fafc', border: '#e2e8f0' },
                    in_progress: { color: '#4f46e5', label: 'In Progress', bg: '#eef2ff', border: '#c7d2fe' },
                    review:      { color: '#d97706', label: 'In Review',   bg: '#fffbeb', border: '#fde68a' },
                    done:        { color: '#059669', label: 'Done',        bg: '#ecfdf5', border: '#a7f3d0' },
                  }[task.status] || { color: '#94a3b8', label: task.status, bg: '#f8fafc', border: '#e2e8f0' }
                  const pc = { high: '#dc2626', medium: '#d97706', low: '#94a3b8' }[task.priority] || '#94a3b8'

                  return (
                    <div key={task.id} style={{ padding: '16px 20px', borderRadius: 16, background: '#fff', border: '1.5px solid #e8ecf4', display: 'flex', alignItems: 'flex-start', gap: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: sc.color, marginTop: 7, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{task.title}</span>
                          <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 700, background: pc + '15', color: pc, textTransform: 'capitalize', border: `1px solid ${pc}25` }}>{task.priority}</span>
                          <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 700, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{sc.label}</span>
                        </div>
                        {task.description && <p style={{ fontSize: 12.5, color: '#64748b', margin: '0 0 7px', lineHeight: 1.6 }}>{task.description.slice(0, 150)}{task.description.length > 150 ? '…' : ''}</p>}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 11.5, color: '#94a3b8' }}>{fmtDate(task.created_at)}</span>
                          {task.github_pr_url && (
                            <a href={task.github_pr_url} target="_blank" rel="noreferrer"
                              style={{ fontSize: 12, color: '#4f46e5', textDecoration: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 8, background: '#eef2ff', border: '1px solid #c7d2fe' }}>
                              🔀 View PR
                            </a>
                          )}
                        </div>
                      </div>
                      {task.score != null && (
                        <div style={{ padding: '8px 14px', borderRadius: 12, background: scoreBg(task.score), border: `1.5px solid ${scoreBorder(task.score)}`, textAlign: 'center', flexShrink: 0 }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: scoreCol(task.score), lineHeight: 1, letterSpacing: '-0.02em' }}>{task.score}</div>
                          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>score</div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────────────── */}
        {/* REPUTATION GRAPH TAB */}
        {/* ──────────────────────────────────────────────────────────────────── */}
        {activeTab === 'Reputation Graph' && (
          <div className="ix-fade" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(310px,1fr))', gap: 16 }}>

              {/* Radar */}
              <div style={{ padding: '22px 22px 14px', borderRadius: 20, background: '#fff', border: '1.5px solid #e8ecf4', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: '0 0 2px', letterSpacing: '-0.02em', fontFamily: 'Syne, sans-serif' }}>Skill Radar</h3>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 12px' }}>7-axis performance overview</p>
                <ResponsiveContainer width="100%" height={270}>
                  <RadarChart data={radarData} margin={{ top: 10, right: 22, bottom: 10, left: 22 }}>
                    <PolarGrid stroke="#e8ecf4" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} />
                    <Radar name="Score" dataKey="value" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.1} strokeWidth={2.5} dot={{ r: 4, fill: '#4f46e5', strokeWidth: 0 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Score Timeline */}
              <div style={{ padding: '22px 22px 14px', borderRadius: 20, background: '#fff', border: '1.5px solid #e8ecf4', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: '0 0 2px', letterSpacing: '-0.02em', fontFamily: 'Syne, sans-serif' }}>Score Timeline</h3>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 12px' }}>Last {timeline.length} scored tasks</p>
                {timeline.length < 2 ? (
                  <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, color: '#94a3b8' }}>
                    <div style={{ fontSize: 36 }}>📈</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#64748b' }}>Not enough scored tasks yet</div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={timeline} margin={{ top: 5, right: 12, bottom: 5, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                      <Line type="monotone" dataKey="score" stroke="#4f46e5" strokeWidth={2.5} dot={{ fill: '#4f46e5', r: 5, strokeWidth: 0 }} activeDot={{ r: 7, fill: '#4f46e5', stroke: '#c7d2fe', strokeWidth: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Bar chart */}
            <div style={{ padding: '22px 22px 14px', borderRadius: 20, background: '#fff', border: '1.5px solid #e8ecf4', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: '0 0 2px', letterSpacing: '-0.02em', fontFamily: 'Syne, sans-serif' }}>Task Distribution</h3>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 12px' }}>Breakdown by current status</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={barData} margin={{ top: 0, right: 12, left: -32, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 13, fontWeight: 600 }} cursor={{ fill: 'rgba(79,70,229,0.04)' }} />
                  <Bar dataKey="count" radius={[7, 7, 0, 0]}>
                    {barData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* GitHub live prompt — only link, no stats panel */}
            {student.github_username && (
              <div style={{ padding: '16px 20px', borderRadius: 16, background: '#eef2ff', border: '1.5px solid #c7d2fe', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(79,70,229,0.35)' }}>
                  <svg width="18" height="18" fill="#fff" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#3730a3', marginBottom: 2 }}>Live GitHub Activity</div>
                  <div style={{ fontSize: 12.5, color: '#6366f1' }}>See @{student.github_username}'s commits, repos and history</div>
                </div>
                <a href={`https://github.com/${student.github_username}`} target="_blank" rel="noreferrer"
                  style={{ marginLeft: 'auto', padding: '9px 18px', borderRadius: 10, background: '#4f46e5', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 700, flexShrink: 0, boxShadow: '0 4px 12px rgba(79,70,229,0.3)' }}>
                  Open GitHub →
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}