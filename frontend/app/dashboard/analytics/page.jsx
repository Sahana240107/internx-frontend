'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, LineChart, Line, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useAuthStore } from '@/lib/store/authStore'
import api from '@/lib/api'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function datLabel(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function groupByDay(tasks) {
  const map = {}
  tasks.forEach(t => {
    const day = (t.updated_at || t.created_at || '').slice(0, 10)
    if (!day) return
    map[day] = (map[day] || 0) + 1
  })
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, count]) => ({ date: datLabel(date), count }))
}

function groupByPriority(tasks) {
  const counts = { high: 0, medium: 0, low: 0 }
  tasks.forEach(t => { if (counts[t.priority] !== undefined) counts[t.priority]++ })
  return [
    { label: 'High',   value: counts.high,   color: '#ef4444' },
    { label: 'Medium', value: counts.medium, color: '#f59e0b' },
    { label: 'Low',    value: counts.low,    color: '#00c896' },
  ]
}

function scoreDistribution(tasks) {
  const ranges = [
    { label: '0–20',  min: 0,  max: 20,  count: 0 },
    { label: '21–40', min: 21, max: 40,  count: 0 },
    { label: '41–60', min: 41, max: 60,  count: 0 },
    { label: '61–80', min: 61, max: 80,  count: 0 },
    { label: '81–100',min: 81, max: 100, count: 0 },
  ]
  tasks.filter(t => typeof t.score === 'number').forEach(t => {
    const r = ranges.find(r => t.score >= r.min && t.score <= r.max)
    if (r) r.count++
  })
  return ranges
}

function radarData(tasks) {
  const total = tasks.length || 1
  const done  = tasks.filter(t => t.status === 'done').length
  const high  = tasks.filter(t => t.priority === 'high').length
  const onTime = tasks.filter(t => t.status === 'done' && (!t.due_date || new Date(t.updated_at) <= new Date(t.due_date))).length
  const scores = tasks.filter(t => typeof t.score === 'number')
  const avgSc  = scores.length ? scores.reduce((s, t) => s + t.score, 0) / scores.length : 50

  return [
    { skill: 'Completion',    val: Math.round((done / total) * 100) },
    { skill: 'On-time',       val: done ? Math.round((onTime / done) * 100) : 0 },
    { skill: 'Quality score', val: Math.round(avgSc) },
    { skill: 'High-pri done', val: high ? Math.round((tasks.filter(t => t.priority === 'high' && t.status === 'done').length / high) * 100) : 0 },
    { skill: 'Review rate',   val: Math.round((tasks.filter(t => t.status === 'review' || t.status === 'done').length / total) * 100) },
    { skill: 'Participation', val: total > 0 ? Math.min(100, Math.round((total / 10) * 100)) : 0 },
  ]
}

// ─── Custom tooltip ─────────────────────────────────────────────────────────
function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,.1)' }}>
      <p style={{ color: 'var(--ink-muted)', marginBottom: 4 }}>{label}</p>
      {payload.map(p => <p key={p.dataKey} style={{ color: p.color || 'var(--accent)', fontWeight: 700, margin: 0 }}>{p.name}: {p.value}</p>)}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ h = 16, w = '100%', r = 8 }) {
  return <div style={{ height: h, width: w, borderRadius: r, background: 'linear-gradient(90deg,var(--surface-2) 25%,var(--surface-3) 50%,var(--surface-2) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
}

// ─── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, icon, loading }) {
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <p style={{ fontSize: 11, color: 'var(--ink-muted)', fontWeight: 500, margin: 0 }}>{label}</p>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      {loading ? (
        <><Skeleton h={28} w={70} r={6} /><div style={{ height: 8 }} /><Skeleton h={12} w={90} r={4} /></>
      ) : (
        <>
          <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 28, color: color || 'var(--ink)', margin: '0 0 4px' }}>{value}</p>
          {sub && <p style={{ fontSize: 11, color: 'var(--ink-muted)', margin: 0 }}>{sub}</p>}
        </>
      )}
    </div>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function Bar2({ label, pct, color }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div style={{ borderRadius: 99, overflow: 'hidden', height: 8, background: 'var(--surface-2)' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: color, transition: 'width .6s ease' }} />
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const POLL_INTERVAL = 30_000 // 30 s live refresh

export default function AnalyticsPage() {
  const router = useRouter()
  const { user } = useAuthStore()

  const [tasks, setTasks]     = useState([])
  const [sprint, setSprint]   = useState(null)
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [tab, setTab]         = useState('overview')
  const timerRef              = useRef(null)

  const fetchData = useCallback(async (isFirstLoad = false) => {
    if (isFirstLoad) setLoading(true)
    try {
      const [meRes, taskRes] = await Promise.all([
        api.get('/api/auth/me'),
        api.get('/api/tasks/my-tasks').catch(() => ({ data: [] })),
      ])
      const me = meRes.data
      setTasks(taskRes.data || [])
      setLastUpdated(new Date())

      if (me.project_id) {
        const [projRes, sprintRes] = await Promise.all([
          api.get(`/api/projects/${me.project_id}`).catch(() => ({ data: null })),
          api.get('/api/tasks/sprints/active').catch(() => ({ data: [] })),
        ])
        setProject(projRes.data)
        setSprint(sprintRes.data?.[0] || null)
      }
    } catch (err) {
      console.error('Analytics fetch error', err)
    } finally {
      if (isFirstLoad) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) { router.push('/auth/login'); return }
    fetchData(true)
    timerRef.current = setInterval(() => fetchData(false), POLL_INTERVAL)
    return () => clearInterval(timerRef.current)
  }, [user, router, fetchData])

  // ── Derived analytics ──────────────────────────────────────────────────────
  const total       = tasks.length
  const done        = tasks.filter(t => t.status === 'done').length
  const inProg      = tasks.filter(t => t.status === 'in_progress').length
  const review      = tasks.filter(t => t.status === 'review').length
  const todo        = tasks.filter(t => t.status === 'todo').length
  const pctDone     = total ? Math.round((done / total) * 100) : 0
  const scored      = tasks.filter(t => typeof t.score === 'number')
  const avgScore    = scored.length ? (scored.reduce((s, t) => s + t.score, 0) / scored.length).toFixed(1) : null
  const highDone    = tasks.filter(t => t.priority === 'high' && t.status === 'done').length
  const dayData     = groupByDay(tasks)
  const prioData    = groupByPriority(tasks)
  const scoreData   = scoreDistribution(tasks)
  const radar       = radarData(tasks)

  const TABS = ['overview', 'breakdown', 'radar']

  return (
    <div className="space-y-5 animate-fade-up">

      {/* ── Header ──────────────────────────────────────── */}
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 20, padding: '16px 22px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--ink)', marginBottom: 2 }}>
              My Analytics
            </h1>
            <p style={{ fontSize: 12, color: 'var(--ink-muted)', margin: 0 }}>
              {loading ? 'Loading…' : `${total} tasks · ${project?.project_title || 'Current project'}`}
              {sprint && ` · ${sprint.title}`}
              {lastUpdated && (
                <span style={{ marginLeft: 8, color: 'var(--green)', fontWeight: 600 }}>
                  ● Live — updated {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {/* Manual refresh */}
            <button onClick={() => fetchData(false)} title="Refresh now"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '7px 12px', cursor: 'pointer', fontSize: 14 }}>
              ↻
            </button>
            {/* Tab switcher */}
            <div style={{ display: 'flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 3 }}>
              {TABS.map(t => (
                <button key={t} onClick={() => setTab(t)}
                  style={{ padding: '6px 14px', borderRadius: 9, border: `1px solid ${tab === t ? 'var(--border)' : 'transparent'}`, background: tab === t ? 'white' : 'transparent', fontSize: 12, fontWeight: 600, color: tab === t ? 'var(--ink)' : 'var(--ink-muted)', cursor: 'pointer', boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,.07)' : 'none', textTransform: 'capitalize' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI cards ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        <KpiCard label="Tasks completed"  value={done}    sub={`${pctDone}% of total`}                   color="var(--green)"  icon="✅" loading={loading} />
        <KpiCard label="In review"         value={review}  sub={review ? 'Awaiting feedback' : 'None pending'} color="var(--accent)" icon="👁"  loading={loading} />
        <KpiCard label="In progress"       value={inProg}  sub={inProg ? 'Active right now' : 'None active'}   color="var(--amber)"  icon="⚡" loading={loading} />
        <KpiCard label="Avg task score"    value={avgScore ? `${avgScore}%` : '—'} sub={scored.length ? `From ${scored.length} scored task${scored.length > 1 ? 's' : ''}` : 'No scores yet'} color="var(--blue)"  icon="⭐" loading={loading} />
      </div>

      {/* ── Tab: Overview ──────────────────────────────────── */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16 }} className="analytics-grid">

          {/* Task status breakdown */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 18, padding: 20 }}>
            <h2 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 16 }}>Task status</h2>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1,2,3,4].map(i => <Skeleton key={i} h={36} r={10} />)}
              </div>
            ) : total === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--ink-muted)', fontSize: 13 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
                No tasks assigned yet
              </div>
            ) : (
              <>
                {[
                  { label: 'Completed ✅',   count: done,   color: 'var(--green)',  bg: 'var(--green-soft)' },
                  { label: 'In review 👁',    count: review, color: 'var(--accent)', bg: 'var(--accent-soft)' },
                  { label: 'In progress ⚡', count: inProg, color: 'var(--amber)',  bg: 'var(--amber-soft)' },
                  { label: 'To-do 📋',        count: todo,   color: 'var(--ink-muted)', bg: 'var(--surface-2)' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: row.bg, marginBottom: 8, border: '1px solid rgba(0,0,0,.04)' }}>
                    <span style={{ fontSize: 13, flex: 1, color: 'var(--ink-soft)', fontWeight: 500 }}>{row.label}</span>
                    <span style={{ fontSize: 20, fontFamily: 'Syne,sans-serif', fontWeight: 800, color: row.color }}>{row.count}</span>
                    <div style={{ width: 60, borderRadius: 99, overflow: 'hidden', height: 6, background: 'rgba(0,0,0,.07)' }}>
                      <div style={{ width: `${total ? (row.count / total) * 100 : 0}%`, height: '100%', borderRadius: 99, background: row.color, transition: 'width .5s ease' }} />
                    </div>
                    <span style={{ fontSize: 11, color: row.color, fontWeight: 700, minWidth: 30, textAlign: 'right' }}>{total ? Math.round((row.count / total) * 100) : 0}%</span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Activity over time */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 18, padding: 20 }}>
            <h2 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 16 }}>Task activity (last 14 days)</h2>
            {loading ? <Skeleton h={180} r={10} /> : dayData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--ink-muted)', fontSize: 13 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📆</div>
                No activity data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={dayData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<Tip />} />
                  <Bar dataKey="count" name="Tasks" fill="var(--accent)" radius={[6, 6, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Priority breakdown */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 18, padding: 20 }}>
            <h2 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 16 }}>Priority breakdown</h2>
            {loading ? <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[1,2,3].map(i => <Skeleton key={i} h={28} r={8} />)}</div> : (
              <>
                {prioData.map(p => (
                  <div key={p.label} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500 }}>{p.label} priority</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: p.color }}>{p.value}</span>
                    </div>
                    <div style={{ borderRadius: 99, overflow: 'hidden', height: 9, background: 'var(--surface-2)' }}>
                      <div style={{ width: `${total ? (p.value / total) * 100 : 0}%`, height: '100%', borderRadius: 99, background: p.color, transition: 'width .6s ease' }} />
                    </div>
                  </div>
                ))}
                {highDone > 0 && (
                  <p style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600, marginTop: 6 }}>
                    ✓ {highDone} high-priority task{highDone > 1 ? 's' : ''} completed
                  </p>
                )}
              </>
            )}
          </div>

          {/* Score distribution */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 18, padding: 20 }}>
            <h2 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 16 }}>Score distribution</h2>
            {loading ? <Skeleton h={180} r={10} /> : scored.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--ink-muted)', fontSize: 13 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🎯</div>
                No scored tasks yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={scoreData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<Tip />} />
                  <Bar dataKey="count" name="Tasks" fill="var(--amber)" radius={[5, 5, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Breakdown ─────────────────────────────────── */}
      {tab === 'breakdown' && (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 18, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--ink)', margin: 0 }}>All assigned tasks</h2>
            <span style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: 'var(--ink-muted)' }}>{total} tasks</span>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[1,2,3,4].map(i => <Skeleton key={i} h={58} r={12} />)}</div>
          ) : tasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--ink-muted)', fontSize: 13 }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
              No tasks assigned yet. Your work will appear here once tasks are assigned.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tasks.map(t => {
                const statusColor = { done: 'var(--green)', review: 'var(--accent)', in_progress: 'var(--amber)', todo: 'var(--ink-muted)' }[t.status] || 'var(--ink-muted)'
                const statusBg    = { done: 'var(--green-soft)', review: 'var(--accent-soft)', in_progress: 'var(--amber-soft)', todo: 'var(--surface-2)' }[t.status] || 'var(--surface-2)'
                const prioColor   = { high: '#ef4444', medium: '#f59e0b', low: '#00c896' }[t.priority] || 'var(--ink-muted)'
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: prioColor, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</p>
                      <p style={{ fontSize: 11, color: 'var(--ink-muted)', margin: 0 }}>
                        {t.priority} priority · {t.due_date ? `Due ${new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'No due date'}
                      </p>
                    </div>
                    {typeof t.score === 'number' && (
                      <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--amber)' }}>{t.score}%</span>
                    )}
                    <span style={{ background: statusBg, color: statusColor, borderRadius: 8, fontSize: 10, fontWeight: 700, padding: '4px 10px', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Radar ─────────────────────────────────────── */}
      {tab === 'radar' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16 }} className="analytics-grid">
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 18, padding: 22 }}>
            <h2 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 4 }}>Performance radar</h2>
            <p style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 16 }}>Computed from your live task data</p>
            {loading ? <Skeleton h={280} r={12} /> : (
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radar}>
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11, fill: 'var(--ink-muted)' }} />
                  <Radar name="Score" dataKey="val" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.18} strokeWidth={2.5} />
                  <Tooltip content={<Tip />} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 18, padding: 22 }}>
            <h2 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 16 }}>Detailed breakdown</h2>
            {loading ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[1,2,3,4,5,6].map(i => <Skeleton key={i} h={28} r={8} />)}</div> : (
              <>
                {radar.sort((a, b) => b.val - a.val).map(item => {
                  const c = item.val >= 80 ? 'var(--green)' : item.val >= 55 ? 'var(--accent)' : 'var(--amber)'
                  return <Bar2 key={item.skill} label={item.skill} pct={item.val} color={c} />
                })}
                {total === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 8, fontStyle: 'italic' }}>
                    Metrics will improve as you complete more tasks.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @media(max-width:768px){.analytics-grid{grid-template-columns:1fr!important}}
      `}</style>
    </div>
  )
}