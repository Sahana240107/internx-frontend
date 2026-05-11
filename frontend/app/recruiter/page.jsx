'use client'
/**
 * Recruiter Dashboard — app/recruiter/page.jsx
 * White / light theme · Students ranked by avg score (desc) · Backend-integrated
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

// ── helpers ──────────────────────────────────────────────────────────────────
const isOnline   = ts => ts && (Date.now() - new Date(ts).getTime()) < 5 * 60_000
const timeAgo    = ts => {
  if (!ts) return 'Never'
  const m = Math.floor((Date.now() - new Date(ts)) / 60_000)
  return m < 1 ? 'Just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`
}
const scoreCol   = s => s == null ? '#94a3b8' : s >= 85 ? '#059669' : s >= 70 ? '#4f46e5' : s >= 50 ? '#d97706' : '#dc2626'
const scoreBg    = s => s == null ? '#f1f5f9' : s >= 85 ? '#ecfdf5' : s >= 70 ? '#eef2ff' : s >= 50 ? '#fffbeb' : '#fef2f2'
const scoreBorder= s => s == null ? '#e2e8f0' : s >= 85 ? '#a7f3d0' : s >= 70 ? '#c7d2fe' : s >= 50 ? '#fde68a' : '#fecaca'
const scoreLabel = s => s == null ? 'Unscored' : s >= 85 ? 'Excellent' : s >= 70 ? 'Good' : s >= 50 ? 'Average' : 'Developing'

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ user, size = 42 }) {
  const init = (user?.name || user?.email || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const colors = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed']
  const colorIdx = (user?.email || user?.name || '').charCodeAt(0) % colors.length
  const bg = colors[colorIdx]
  return user?.avatar_url
    ? <img src={user.avatar_url} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: size * 0.34, fontWeight: 700, letterSpacing: '-0.01em', flexShrink: 0 }}>{init}</div>
}

// ── Score Arc ─────────────────────────────────────────────────────────────────
function ScoreArc({ score, size = 56 }) {
  const col  = scoreCol(score)
  const bg   = scoreBg(score)
  const pct  = score != null ? score : 0
  const r    = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={scoreBorder(score)} strokeWidth={5} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={5}
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          style={{ transition: 'all 1s cubic-bezier(.4,0,.2,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size * 0.255, fontWeight: 800, color: col }}>{score ?? '—'}</span>
      </div>
    </div>
  )
}

// ── Stat Card (top KPI) ───────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent, icon, loading }) {
  return (
    <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e8ecf4', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -24, right: -24, width: 90, height: 90, borderRadius: '50%', background: accent + '12', pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.09em', textTransform: 'uppercase' }}>{label}</span>
        <div style={{ width: 36, height: 36, borderRadius: 11, background: accent + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>{icon}</div>
      </div>
      {loading
        ? <div style={{ height: 36, width: 72, borderRadius: 8, background: '#f1f5f9', animation: 'shimmer 1.4s ease infinite' }} />
        : <div style={{ fontSize: 36, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.05em', lineHeight: 1 }}>{value}</div>
      }
      <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{sub}</span>
    </div>
  )
}

// ── Skeleton Row ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e8ecf4', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
      {[44, 160, 110, 60, 56].map((w, i) => (
        <div key={i} style={{ height: i === 0 ? 44 : 13, width: w, borderRadius: i === 0 ? '50%' : 7, background: '#f1f5f9', animation: 'shimmer 1.4s ease-in-out infinite', animationDelay: `${i * 0.1}s`, flexShrink: 0 }} />
      ))}
    </div>
  )
}

const ROLES = ['All', 'frontend', 'backend', 'fullstack', 'devops', 'design']

// ── Main ──────────────────────────────────────────────────────────────────────
export default function RecruiterDashboard() {
  const router   = useRouter()
  const tokenRef = useRef(null)

  const [recruiter, setRecruiter] = useState(null)
  const [students,  setStudents]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [search,    setSearch]    = useState('')
  const [roleF,     setRoleF]     = useState('All')

  const loadStudents = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API_URL}/api/recruiter/students`, {
        headers: { 'Authorization': `Bearer ${tokenRef.current}` },
      })
      if (res.status === 401) {
        localStorage.removeItem('recruiter_token'); localStorage.removeItem('recruiter_user')
        router.push('/auth/recruiter-login'); return
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || `Error ${res.status}`)
      }
      const profiles = await res.json()
      const enriched = (Array.isArray(profiles) ? profiles : []).map(p => {
        const tasks    = p.tasks || []
        const scored   = tasks.filter(t => t.score != null)
        const avgScore = scored.length
          ? Math.round(scored.reduce((a, t) => a + t.score, 0) / scored.length)
          : null
        return { ...p, tasks, avgScore, done: tasks.filter(t => t.status === 'done').length, prs: tasks.filter(t => t.github_pr_url).length }
      })
      // Sort by avg score descending (nulls last)
      enriched.sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1))
      setStudents(enriched)
    } catch (e) {
      setError(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    const raw   = localStorage.getItem('recruiter_user')
    const token = localStorage.getItem('recruiter_token')
    if (!raw || !token) { router.push('/auth/recruiter-login'); return }
    setRecruiter(JSON.parse(raw)); tokenRef.current = token; loadStudents()
  }, []) // eslint-disable-line

  // filter only — order is already score-desc from loadStudents
  const q = search.toLowerCase()
  const list = students.filter(s => {
    const mQ = !q || [s.name, s.email, s.github_username].some(v => v?.toLowerCase().includes(q))
    const mR = roleF === 'All' || s.intern_role === roleF
    return mQ && mR
  })

  const scoredAll = students.filter(s => s.avgScore != null)
  const platAvg   = scoredAll.length
    ? Math.round(scoredAll.reduce((a, s) => a + s.avgScore, 0) / scoredAll.length)
    : null
  const topPerf   = students.filter(s => s.avgScore != null && s.avgScore >= 80).length
  const onlineCt  = students.filter(s => isOnline(s.last_seen)).length

  const signOut = () => {
    localStorage.removeItem('recruiter_token'); localStorage.removeItem('recruiter_user')
    router.push('/auth/recruiter-login')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif", color: '#0f172a' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:.45} }
        @keyframes slideUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes dotPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(0.65);opacity:0.5} }
        .s-row { transition: all .18s cubic-bezier(.4,0,.2,1); cursor: pointer; }
        .s-row:hover { transform: translateY(-2px); box-shadow: 0 10px 36px rgba(79,70,229,0.1) !important; border-color: #c7d2fe !important; background: #fafbff !important; }
        .role-btn { transition: all .14s; border: none; cursor: pointer; font-family: inherit; }
        .icon-btn  { transition: all .14s; cursor: pointer; font-family: inherit; }
        .icon-btn:hover  { background: #f1f5f9 !important; }
        .sign-out:hover  { background: #fef2f2 !important; border-color: #fca5a5 !important; }
        .search-input:focus { outline: none; border-color: #a5b4fc !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.1) !important; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 99px; }
        ::placeholder { color: #94a3b8; }
      `}</style>

      {/* ── Topbar ── */}
      <div style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid #e8ecf4', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px', height: 62, display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 16, color: '#fff', boxShadow: '0 4px 12px rgba(79,70,229,0.35)' }}>X</div>
            <span style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', letterSpacing: '-0.03em' }}>InternX</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#4f46e5', background: '#eef2ff', padding: '2px 9px', borderRadius: 99, letterSpacing: '0.08em', textTransform: 'uppercase', border: '1px solid #c7d2fe' }}>Recruiter</span>
          </div>

          <div style={{ flex: 1 }} />

          <button className="icon-btn" onClick={loadStudents} disabled={loading}
            style={{ padding: '7px 14px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12.5, fontWeight: 600, color: '#64748b', opacity: loading ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14, display: 'inline-block', transition: 'transform .3s', transform: loading ? 'rotate(360deg)' : 'none' }}>↻</span> Refresh
          </button>

          {recruiter && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 14px 5px 6px', borderRadius: 40, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <Avatar user={recruiter} size={28} />
              <span style={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>{recruiter.name || recruiter.email}</span>
            </div>
          )}

          <button className="icon-btn sign-out" onClick={signOut}
            style={{ padding: '7px 14px', borderRadius: 10, border: '1px solid #fecaca', background: '#fef2f2', fontSize: 12.5, fontWeight: 700, color: '#dc2626' }}>
            Sign out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '36px 32px 80px' }}>

        {/* ── Hero heading ── */}
        <div style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.04em', margin: '0 0 6px', lineHeight: 1 }}>
              Talent Pool
            </h1>
            <p style={{ fontSize: 13.5, color: '#64748b', margin: 0, fontWeight: 500 }}>
              {loading ? 'Loading candidates…' : `${students.length} intern${students.length !== 1 ? 's' : ''} · ranked by performance score`}
            </p>
          </div>
          {onlineCt > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 13, fontWeight: 700, color: '#16a34a' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'dotPulse 2s infinite' }} />
              {onlineCt} active now
            </div>
          )}
        </div>

        {/* ── KPI: Total Students (prominent flash card) ── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', borderRadius: 22, padding: '28px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 8px 32px rgba(79,70,229,0.25)', flexWrap: 'wrap', gap: 20 }}>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Total Students</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                {loading
                  ? <div style={{ width: 80, height: 52, borderRadius: 10, background: 'rgba(255,255,255,0.15)', animation: 'shimmer 1.4s infinite' }} />
                  : <span style={{ fontSize: 56, fontWeight: 900, color: '#fff', letterSpacing: '-0.05em', lineHeight: 1 }}>{students.length}</span>
                }
                <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>candidates in pool</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[
                { l: 'Platform Avg', v: platAvg ?? '—', icon: '📈' },
                { l: 'Top Performers', v: topPerf, icon: '⭐' },
                { l: 'Online Now', v: onlineCt, icon: '🟢' },
              ].map(s => (
                <div key={s.l} style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 16, padding: '14px 20px', textAlign: 'center', minWidth: 100, border: '1px solid rgba(255,255,255,0.18)' }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1 }}>{loading ? '—' : s.v}</div>
                  <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)', marginTop: 4, fontWeight: 500 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{ marginBottom: 20, padding: '14px 18px', borderRadius: 14, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
            ⚠️ {error}
            <button onClick={loadStudents} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: 700, fontSize: 12, textDecoration: 'underline', fontFamily: 'inherit' }}>Retry</button>
          </div>
        )}

        {/* ── Filters ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '0 0 280px' }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/><path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <input
              className="search-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email or GitHub…"
              style={{ width: '100%', padding: '10px 36px', borderRadius: 12, border: '1.5px solid #e2e8f0', background: '#fff', fontSize: 13, color: '#0f172a', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'all .15s' }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18, lineHeight: 1 }}>×</button>
            )}
          </div>

          {/* Role pills */}
          <div style={{ display: 'flex', gap: 3, padding: 3, background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 13 }}>
            {ROLES.map(r => (
              <button key={r} className="role-btn" onClick={() => setRoleF(r)}
                style={{ padding: '6px 13px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: roleF === r ? '#4f46e5' : 'transparent', color: roleF === r ? '#fff' : '#64748b', textTransform: r === 'All' ? 'none' : 'capitalize', whiteSpace: 'nowrap', transition: 'all .14s', boxShadow: roleF === r ? '0 2px 8px rgba(79,70,229,0.3)' : 'none' }}>
                {r === 'All' ? 'All roles' : r}
              </button>
            ))}
          </div>

          <div style={{ marginLeft: 'auto' }}>
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path d="M3 6h18M7 12h10M11 18h2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
              Sorted by score (high → low)
            </span>
          </div>
        </div>

        {/* Score legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{!loading && `${list.length} result${list.length !== 1 ? 's' : ''}`}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 14 }}>
            {[['#059669','Excellent ≥85'],['#4f46e5','Good ≥70'],['#d97706','Average ≥50'],['#dc2626','Developing']].map(([c, l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />
                <span style={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 500 }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Student List ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, animation: 'slideUp .28s ease both' }}>
          {loading
            ? [...Array(6)].map((_, i) => <SkeletonRow key={i} />)
            : list.length === 0
            ? (
              <div style={{ background: '#fff', borderRadius: 20, border: '1.5px dashed #e2e8f0', padding: '80px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 52, marginBottom: 14 }}>{students.length === 0 ? '🎓' : '🔍'}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#334155', marginBottom: 7 }}>
                  {students.length === 0 ? 'No students yet' : 'No results found'}
                </div>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>
                  {students.length === 0 ? 'Students appear once they sign up via GitHub OAuth' : 'Try clearing your search or role filter'}
                </div>
              </div>
            )
            : list.map((s, idx) => {
                const online   = isOnline(s.last_seen)
                const complete = s.tasks.length ? Math.round((s.done / s.tasks.length) * 100) : 0
                const medals   = ['🥇','🥈','🥉']
                const col      = scoreCol(s.avgScore)
                const bg       = scoreBg(s.avgScore)
                const border   = scoreBorder(s.avgScore)

                return (
                  <div key={s.id} className="s-row"
                    onClick={() => router.push(`/recruiter/student/${s.id}`)}
                    style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e8ecf4', padding: '15px 22px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>

                    {/* Rank badge */}
                    <div style={{ width: 36, flexShrink: 0, textAlign: 'center' }}>
                      {idx < 3
                        ? <span style={{ fontSize: 22 }}>{medals[idx]}</span>
                        : <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>#{idx + 1}</span>
                      }
                    </div>

                    {/* Avatar + online indicator */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <Avatar user={s} size={44} />
                      {online && (
                        <span style={{ position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, borderRadius: '50%', background: '#22c55e', border: '2.5px solid #fff', boxShadow: '0 0 6px rgba(34,197,94,0.5)' }} />
                      )}
                    </div>

                    {/* Name + email + role */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.015em' }}>{s.name || 'Unnamed'}</span>
                        {s.intern_role && (
                          <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: 10.5, fontWeight: 600, background: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe', textTransform: 'capitalize' }}>{s.intern_role}</span>
                        )}
                        {online && (
                          <span style={{ fontSize: 10.5, color: '#16a34a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />Online
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span>{s.email}</span>
                        {s.github_username && <span style={{ color: '#4f46e5', fontWeight: 600 }}>@{s.github_username}</span>}
                        {!online && s.last_seen && <span style={{ color: '#94a3b8' }}>· {timeAgo(s.last_seen)}</span>}
                      </div>
                    </div>

                    {/* Quick stats */}
                    <div style={{ display: 'flex', gap: 22, flexShrink: 0, alignItems: 'center' }}>
                      {[
                        { l: 'TASKS', v: s.tasks.length, c: '#334155' },
                        { l: 'DONE',  v: `${complete}%`, c: '#059669' },
                        { l: 'PRs',   v: s.prs,          c: '#7c3aed' },
                      ].map(st => (
                        <div key={st.l} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 9.5, color: '#94a3b8', marginBottom: 3, fontWeight: 700, letterSpacing: '0.1em' }}>{st.l}</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: st.c, letterSpacing: '-0.02em' }}>{st.v}</div>
                        </div>
                      ))}
                    </div>

                    {/* Score arc + label */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                      <ScoreArc score={s.avgScore} size={52} />
                      <span style={{ fontSize: 9.5, fontWeight: 700, color: col, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{scoreLabel(s.avgScore)}</span>
                    </div>

                    {/* Chevron */}
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" style={{ color: '#cbd5e1', flexShrink: 0 }}>
                      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )
              })}
        </div>
      </div>
    </div>
  )
}