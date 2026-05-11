'use client'
/**
 * InternX — Admin Dashboard (v4)
 * Drop at: frontend/app/admin/page.jsx
 *
 * v4 CHANGES:
 *  - Removed "Add Recruiter" button and all createRecruiter logic
 *  - Removed Add Recruiter modal
 *  - Status (Online/Offline) and Last Login now pulled directly from Supabase
 *    profiles table via REST API using SUPABASE_URL + SUPABASE_ANON_KEY
 *  - refreshActivity now hits Supabase directly for real-time presence data
 *  - lastLogin fallback chain: last_login → last_seen → lastLogin → updated_at
 *  - Polling interval: 15s fallback when WebSocket not live
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

const API_URL       = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const SUPABASE_URL  = 'https://lpnrkvgmtewrjzebjywr.supabase.co'
const SUPABASE_ANON = 'sb_publishable_MURY5vE803BoclDd03zCiQ_oE6DRADH'
const ADMIN_CH      = 'internx_admin_session'

// ── auth header ───────────────────────────────────────────────────────────────
function ah() {
  const t = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : ''
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }
}

// Supabase REST header (for direct table reads)
function sbh() {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON || '',
    Authorization: `Bearer ${SUPABASE_ANON || ''}`,
  }
}

// Safe fetch — wraps network errors into a readable string instead of throwing
async function safeFetch(url, opts = {}) {
  try {
    const res = await fetch(url, { mode: 'cors', ...opts })
    return { res, networkError: null }
  } catch (err) {
    const isNet = err instanceof TypeError
    return {
      res: null,
      networkError: isNet
        ? `Cannot reach backend at ${url}.\n` +
          `Check: (1) backend is running, (2) CORS allows your origin, ` +
          `(3) NEXT_PUBLIC_API_URL="${API_URL}" is correct.`
        : (err.message || 'Unknown error'),
    }
  }
}

// ── Supabase direct presence fetch ───────────────────────────────────────────
// Fetches last_login, last_seen for all profiles directly from Supabase REST
async function fetchSupabasePresence() {
  if (!SUPABASE_URL || !SUPABASE_ANON) return []
  try {
    const url = `${SUPABASE_URL}/rest/v1/profiles?select=id,last_login,last_seen,last_active,updated_at&limit=1000`
    const res = await fetch(url, { headers: sbh(), mode: 'cors' })
    if (!res.ok) return []
    return await res.json()
  } catch (_) {
    return []
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────
const isOnline = ts => ts && (Date.now() - new Date(ts).getTime()) < 5 * 60_000
const timeAgo  = ts => {
  if (!ts) return 'Never'
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60_000)
  if (m < 1)  return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}
const fmtDate = ts => {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
// Best available "last login" — checks every field name backends tend to use
const lastLogin = u =>
  u?.last_login ?? u?.last_seen ?? u?.lastLogin ?? u?.last_active ?? u?.updated_at ?? null
const initials = u =>
  (u?.name || u?.email || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

// ── nav ───────────────────────────────────────────────────────────────────────
const NAV = [
  {
    id: 'students', label: 'Students',
    icon: <svg width="17" height="17" fill="none" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8"/></svg>,
  },
  {
    id: 'recruiters', label: 'Recruiters',
    icon: <svg width="17" height="17" fill="none" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="8.5" cy="7" r="4" stroke="currentColor" strokeWidth="1.8"/><polyline points="17 11 19 13 23 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  },
  {
    id: 'reports', label: 'Reports',
    icon: <svg width="17" height="17" fill="none" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.8"/><line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>,
  },
  {
    id: 'sessions', label: 'Login Log',
    icon: <svg width="17" height="17" fill="none" viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
]

const ROLE_CFG = {
  intern:    { bg: '#eef2ff', color: '#4f46e5', border: '#c7d2fe' },
  admin:     { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
  recruiter: { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' },
}
const STATUS_CFG = {
  open:         { bg: '#fef2f2', color: '#dc2626', border: '#fca5a5', dot: '#ef4444', label: 'Open' },
  under_review: { bg: '#fffbeb', color: '#b45309', border: '#fcd34d', dot: '#f59e0b', label: 'In Review' },
  resolved:     { bg: '#f0fdf4', color: '#15803d', border: '#86efac', dot: '#22c55e', label: 'Resolved' },
}

// ── tiny components ───────────────────────────────────────────────────────────
function Av({ u, sz = 34, color = '#4f46e5' }) {
  const s = { width: sz, height: sz, borderRadius: sz * 0.35, flexShrink: 0, objectFit: 'cover' }
  return u?.avatar_url
    ? <img src={u.avatar_url} alt="" style={s} />
    : <div style={{ ...s, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: sz * 0.32, fontWeight: 700, color, fontFamily: 'DM Sans,sans-serif', border: `1.5px solid ${color}30` }}>
        {initials(u)}
      </div>
}

function OnlineDot({ ts }) {
  const on = isOnline(ts)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: on ? '#22c55e' : '#e5e7eb', boxShadow: on ? '0 0 0 2.5px rgba(34,197,94,0.2)' : 'none' }} />
      <span style={{ fontSize: 12, color: on ? '#16a34a' : '#9ca3af', fontWeight: 500 }}>{on ? 'Online' : timeAgo(ts)}</span>
    </span>
  )
}

function RoleBadge({ role }) {
  const c = ROLE_CFG[role] || { bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: c.bg, color: c.color, border: `1px solid ${c.border}`, textTransform: 'capitalize' }}>
      {role}
    </span>
  )
}

function Toast({ t }) {
  if (!t) return null
  const err = t.type === 'error'
  return (
    <div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 999, padding: '13px 20px', borderRadius: 14, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 32px rgba(0,0,0,0.1)', background: err ? '#fff1f2' : '#f0fdf4', color: err ? '#dc2626' : '#16a34a', border: `1px solid ${err ? '#fecdd3' : '#bbf7d0'}`, display: 'flex', alignItems: 'center', gap: 8, maxWidth: 440 }}>
      <span>{err ? '✕' : '✓'}</span> {t.msg}
    </div>
  )
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(6px)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 22, padding: '28px 30px', width: '100%', maxWidth: 480, boxShadow: '0 24px 60px rgba(0,0,0,0.15)', border: '1px solid #f0f0f4', animation: 'fadeUp 0.18s ease', zIndex: 201, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#111' }}>{title}</h3>
          <button onClick={onClose} style={{ background: '#f4f4f8', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: 18, color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder, required, minLength }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}{required && ' *'}</label>
      <input
        type={type} value={value} onChange={onChange} placeholder={placeholder} minLength={minLength}
        style={{ width: '100%', padding: '10px 13px', borderRadius: 10, border: '1.5px solid #e8e8f0', fontSize: 13, color: '#111', outline: 'none', boxSizing: 'border-box', fontFamily: 'DM Sans,sans-serif', background: '#fafafa', transition: 'border-color 0.15s' }}
        onFocus={e => e.target.style.borderColor = '#4f46e5'}
        onBlur={e => e.target.style.borderColor = '#e8e8f0'}
      />
    </div>
  )
}

function Empty({ icon, msg }) {
  return (
    <tr><td colSpan={10}>
      <div style={{ padding: '56px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>{icon}</div>
        <div style={{ fontSize: 13, color: '#bbb', maxWidth: 280, margin: '0 auto', lineHeight: 1.6 }}>{msg}</div>
      </div>
    </td></tr>
  )
}

function StatCard({ label, value, icon, color, sub, loading }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #f0f0f4', padding: '18px 20px', display: 'flex', gap: 14, alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: color + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#111', lineHeight: 1, letterSpacing: '-0.02em' }}>
          {loading ? <span style={{ color: '#ddd' }}>—</span> : value}
        </div>
        <div style={{ fontSize: 12, color: '#aaa', marginTop: 3 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color, fontWeight: 600, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter()

  const [admin,      setAdmin]      = useState(null)
  const [tab,        setTab]        = useState('students')
  const [students,   setStudents]   = useState([])
  const [recruiters, setRecruiters] = useState([])
  const [reports,    setReports]    = useState([])
  const [sessions,   setSessions]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [search,     setSearch]     = useState('')
  const [toast,      setToast]      = useState(null)
  const [liveCount,  setLiveCount]  = useState(0)
  const [rtStatus,   setRtStatus]   = useState('connecting')

  // Reset password
  const [showRP,   setShowRP]   = useState(false)
  const [rpTarget, setRpTarget] = useState(null)
  const [rpPw,     setRpPw]     = useState('')
  const [rpBusy,   setRpBusy]   = useState(false)
  const [rpErr,    setRpErr]    = useState('')

  const hbRef  = useRef(null)
  const wsRef  = useRef(null)
  const actRef = useRef(null)

  // ── boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const raw = localStorage.getItem('admin_user')
    if (!raw) { router.push('/auth/admin-login'); return }
    const u = JSON.parse(raw)
    setAdmin(u)
    fetchAll()
    startHB(u)
    // Refresh presence from Supabase every 30s
    actRef.current = setInterval(refreshPresence, 30_000)
    let bc
    try {
      bc = new BroadcastChannel(ADMIN_CH)
      bc.onmessage = ev => { if (ev.data?.type === 'LOGIN') fetchAll() }
    } catch (_) {}
    return () => {
      clearInterval(hbRef.current)
      clearInterval(actRef.current)
      bc?.close()
    }
  }, [])

  function startHB(u) {
    const ping = () => fetch(`${API_URL}/api/auth/heartbeat`, {
      method: 'POST', headers: ah(), mode: 'cors',
      body: JSON.stringify({ user_id: u.id, role: u.role }),
    }).catch(() => {})
    ping()
    hbRef.current = setInterval(ping, 60_000)
  }

  // ── refreshPresence — pulls last_login / last_seen directly from Supabase ──
  // This ensures the Status and Last Login columns always reflect the DB truth,
  // even if the backend /dashboard endpoint doesn't return fresh timestamps.
  const refreshPresence = useCallback(async () => {
    const rows = await fetchSupabasePresence()
    if (!rows.length) return

    const byId = {}
    rows.forEach(r => { byId[r.id] = r })

    const mergePresence = (prev) => prev.map(u => {
      const sb = byId[u.id]
      if (!sb) return u
      return {
        ...u,
        last_login:  sb.last_login  ?? u.last_login,
        last_seen:   sb.last_seen   ?? u.last_seen,
        last_active: sb.last_active ?? u.last_active,
        updated_at:  sb.updated_at  ?? u.updated_at,
      }
    })

    setStudents(p  => mergePresence(p))
    setRecruiters(p => mergePresence(p))
  }, [])

  // ── fetchAll ──────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true); setError('')
    const { res, networkError } = await safeFetch(`${API_URL}/api/admin/dashboard`, { headers: ah() })
    if (networkError) { setError(networkError); setLoading(false); return }
    if (res.status === 401) { localStorage.clear(); router.push('/auth/admin-login'); return }
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      setError(e.detail || `Server error ${res.status}`)
      setLoading(false); return
    }
    const d = await res.json()

    // Immediately enrich with fresh Supabase presence data
    const sbRows = await fetchSupabasePresence()
    const byId = {}
    sbRows.forEach(r => { byId[r.id] = r })

    const enrich = (arr) => (arr || []).map(u => {
      const sb = byId[u.id]
      if (!sb) return u
      return {
        ...u,
        last_login:  sb.last_login  ?? u.last_login,
        last_seen:   sb.last_seen   ?? u.last_seen,
        last_active: sb.last_active ?? u.last_active,
        updated_at:  sb.updated_at  ?? u.updated_at,
      }
    })

    setStudents(enrich(d.students))
    setRecruiters(enrich(d.recruiters))
    setReports(d.reports   || [])
    setSessions(d.sessions  || [])
    setLoading(false)
  }, [])

  // ── realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON) { setRtStatus('polling'); return }
    let ws, pi, rt
    function conn() {
      const url = SUPABASE_URL.replace('https://', 'wss://').replace('http://', 'ws://')
      try { ws = new WebSocket(`${url}/realtime/v1/websocket?apikey=${SUPABASE_ANON}&vsn=1.0.0`) } catch { setRtStatus('polling'); return }
      ws.onopen = () => {
        ws.send(JSON.stringify({
          topic: 'realtime:public', event: 'phx_join',
          payload: {
            config: {
              postgres_changes: [
                { event: '*', schema: 'public', table: 'profiles' },
                { event: '*', schema: 'public', table: 'reports' },
                { event: '*', schema: 'public', table: 'login_sessions' },
              ]
            },
            access_token: localStorage.getItem('admin_token') || SUPABASE_ANON
          },
          ref: '1'
        }))
        pi = setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: null })), 25_000)
      }
      ws.onmessage = ev => {
        try {
          const m = JSON.parse(ev.data)
          if (m.event === 'phx_reply' && m.payload?.status === 'ok') setRtStatus('live')
          if (m.event === 'postgres_changes') {
            // For profile changes, do a lightweight presence refresh instead of full fetchAll
            const tbl = m.payload?.data?.table
            if (tbl === 'profiles') refreshPresence()
            else fetchAll()
          }
        } catch (_) {}
      }
      ws.onerror = () => setRtStatus('polling')
      ws.onclose = () => { clearInterval(pi); rt = setTimeout(conn, 5000) }
      wsRef.current = ws
    }
    conn()
    return () => { clearInterval(pi); clearTimeout(rt); wsRef.current?.close() }
  }, [fetchAll, refreshPresence])

  // Polling fallback every 15 s
  useEffect(() => {
    if (rtStatus !== 'live') {
      const id = setInterval(fetchAll, 15_000)
      return () => clearInterval(id)
    }
  }, [fetchAll, rtStatus])

  useEffect(() => {
    setLiveCount([...students, ...recruiters].filter(u => isOnline(u.last_seen)).length)
  }, [students, recruiters])

  // ── toast ─────────────────────────────────────────────────────────────────
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 5000)
  }

  // ── mutations ─────────────────────────────────────────────────────────────
  const changeRole = async (uid, newRole) => {
    const target = [...students, ...recruiters].find(u => u.id === uid)
    if (!target) return
    const updated = { ...target, role: newRole }
    setStudents(p  => { const w = p.filter(u => u.id !== uid); return newRole === 'intern'     ? [...w, updated] : w })
    setRecruiters(p => { const w = p.filter(u => u.id !== uid); return newRole === 'recruiter' ? [...w, updated] : w })
    const { res, networkError } = await safeFetch(`${API_URL}/api/admin/profiles/${uid}/role`, {
      method: 'PATCH', headers: ah(), body: JSON.stringify({ role: newRole }),
    })
    if (networkError || !res.ok) { showToast('Role update failed', 'error'); fetchAll() }
    else showToast(`Role updated → ${newRole}`)
  }

  const deleteUser = async (uid, name) => {
    if (!confirm(`Remove ${name}? This cannot be undone.`)) return
    setStudents(p => p.filter(u => u.id !== uid))
    setRecruiters(p => p.filter(u => u.id !== uid))
    const { res, networkError } = await safeFetch(`${API_URL}/api/admin/profiles/${uid}`, {
      method: 'DELETE', headers: ah(),
    })
    if (networkError || !res.ok) { showToast('Delete failed', 'error'); fetchAll() }
    else showToast('User removed')
  }

  const updateReport = async (id, status) => {
    setReports(p => p.map(r => r.id === id ? { ...r, status } : r))
    const { res, networkError } = await safeFetch(`${API_URL}/api/admin/reports/${id}/status`, {
      method: 'PATCH', headers: ah(), body: JSON.stringify({ status }),
    })
    if (networkError || !res.ok) { showToast('Update failed', 'error'); fetchAll() }
    else showToast('Report updated')
  }

  // ── RESET PASSWORD ────────────────────────────────────────────────────────
  const resetPassword = async () => {
    if (!rpPw || rpPw.length < 6) { setRpErr('Password must be at least 6 characters'); return }
    setRpBusy(true); setRpErr('')
    const { res, networkError } = await safeFetch(`${API_URL}/api/admin/recruiters/${rpTarget.id}/reset-password`, {
      method: 'POST', headers: ah(), body: JSON.stringify({ password: rpPw }),
    })
    if (networkError) { setRpErr(networkError); setRpBusy(false); return }
    let data = {}
    try { data = await res.json() } catch (_) {}
    if (!res.ok) {
      let msg = data.detail || data.message || `Error ${res.status}`
      if (Array.isArray(msg)) msg = msg.map(e => e.msg || JSON.stringify(e)).join(' · ')
      setRpErr(msg); setRpBusy(false); return
    }
    showToast(`Password reset for ${rpTarget.name}`)
    setShowRP(false); setRpPw(''); setRpErr(''); setRpBusy(false)
  }

  // ── derived ───────────────────────────────────────────────────────────────
  const q       = search.toLowerCase()
  const fs      = students.filter(s  => !q || s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q))
  const fr      = recruiters.filter(r => !q || r.name?.toLowerCase().includes(q) || r.email?.toLowerCase().includes(q))
  const openRep = reports.filter(r => r.status === 'open').length

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f6f6fb', fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:none } }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes spin   { to { transform: rotate(360deg); } }
        .fade-in  { animation: fadeUp 0.2s ease both; }
        .nav-item { transition: all 0.14s; border: none !important; }
        .nav-item:hover { background: rgba(79,70,229,0.07) !important; }
        .row-hover:hover { background: #fafafe !important; }
        .btn { transition: all 0.14s; cursor: pointer; border: none; }
        .btn:hover { opacity: 0.82; transform: translateY(-0.5px); }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #e0e0ea; border-radius: 99px; }
      `}</style>

      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <aside style={{ width: 228, flexShrink: 0, background: '#fff', borderRight: '1px solid #eeeef5', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid #f0f0f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, color: '#fff', boxShadow: '0 3px 10px rgba(79,70,229,0.3)' }}>X</div>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: '#111', letterSpacing: '-0.02em' }}>InternX</div>
              <div style={{ fontSize: 10, color: '#aaa', fontWeight: 500 }}>Admin Console</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#c0c0d0', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 10px 8px' }}>Management</div>
          {NAV.map(n => {
            const active = tab === n.id
            const badge = n.id === 'reports' ? openRep : n.id === 'students' ? students.length : n.id === 'recruiters' ? recruiters.length : sessions.length
            return (
              <button key={n.id} className="nav-item"
                onClick={() => { setTab(n.id); setSearch('') }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 11, cursor: 'pointer', width: '100%', textAlign: 'left', background: active ? 'rgba(79,70,229,0.08)' : 'transparent', color: active ? '#4f46e5' : '#666', fontWeight: active ? 700 : 500, fontSize: 13, fontFamily: 'DM Sans,sans-serif', position: 'relative' }}>
                <span style={{ opacity: active ? 1 : 0.6 }}>{n.icon}</span>
                <span style={{ flex: 1 }}>{n.label}</span>
                {badge > 0 && (
                  <span style={{ padding: '2px 7px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: n.id === 'reports' && openRep > 0 ? '#fef2f2' : active ? 'rgba(79,70,229,0.15)' : '#f0f0f8', color: n.id === 'reports' && openRep > 0 ? '#dc2626' : active ? '#4f46e5' : '#aaa' }}>{badge}</span>
                )}
                {active && <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 3, borderRadius: '0 3px 3px 0', background: '#4f46e5' }} />}
              </button>
            )
          })}
        </nav>

        <div style={{ margin: '0 10px 8px', padding: '10px 12px', borderRadius: 12, background: rtStatus === 'live' ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: rtStatus === 'live' ? '#16a34a' : '#b45309' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: rtStatus === 'live' ? '#22c55e' : '#f59e0b', animation: 'pulse 2s ease infinite', flexShrink: 0 }} />
            {rtStatus === 'live' ? 'Live updates' : rtStatus === 'connecting' ? 'Connecting…' : 'Polling 15s'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5, fontSize: 11, color: '#aaa' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: liveCount > 0 ? '#22c55e' : '#e5e7eb', flexShrink: 0 }} />
            {liveCount} online now
          </div>
        </div>

        <div style={{ padding: '10px 12px 16px', borderTop: '1px solid #f0f0f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Av u={admin} sz={30} color="#4f46e5" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{admin?.name || 'Admin'}</div>
              <div style={{ fontSize: 10, color: '#bbb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{admin?.email}</div>
            </div>
          </div>
          <button className="btn"
            onClick={() => { localStorage.removeItem('admin_token'); localStorage.removeItem('admin_user'); router.push('/auth/admin-login') }}
            style={{ width: '100%', padding: '8px', borderRadius: 9, background: '#fff1f2', border: '1px solid #fecdd3', color: '#dc2626', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── MAIN ────────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid #eeeef5', padding: '0 28px', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#111', letterSpacing: '-0.02em' }}>
              {{ students: 'Students', recruiters: 'Recruiters', reports: 'Reports', sessions: 'Login Log' }[tab]}
            </h1>
            <p style={{ margin: 0, fontSize: 11, color: '#bbb', marginTop: 1 }}>
              {tab === 'students'   && `${students.length} total · ${students.filter(s => isOnline(s.last_seen)).length} online`}
              {tab === 'recruiters' && `${recruiters.length} total · presence synced from Supabase`}
              {tab === 'reports'    && `${openRep} open · ${reports.filter(r => r.status === 'resolved').length} resolved`}
              {tab === 'sessions'   && `${sessions.length} recent logins`}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {(tab === 'students' || tab === 'recruiters') && (
              <div style={{ position: 'relative' }}>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#ccc', pointerEvents: 'none' }}>
                  <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/><path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${tab}…`}
                  style={{ padding: '7px 14px 7px 30px', borderRadius: 10, border: '1.5px solid #eeeeF5', background: '#fafafa', fontSize: 12, color: '#111', outline: 'none', width: 210, fontFamily: 'DM Sans,sans-serif' }}
                  onFocus={e => e.target.style.borderColor = '#4f46e5'}
                  onBlur={e => e.target.style.borderColor = '#eeeeF5'} />
              </div>
            )}
            {/* Refresh presence button — always visible */}
            {(tab === 'students' || tab === 'recruiters') && (
              <button className="btn" onClick={refreshPresence} title="Refresh presence from Supabase"
                style={{ padding: '7px 12px', borderRadius: 10, border: '1.5px solid #eeeeF5', background: '#fff', fontSize: 11, fontWeight: 600, color: '#4f46e5', display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24"><path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Sync
              </button>
            )}
            <button className="btn" onClick={fetchAll} disabled={loading}
              style={{ padding: '7px 12px', borderRadius: 10, border: '1.5px solid #eeeeF5', background: '#fff', fontSize: 12, fontWeight: 600, color: '#888', opacity: loading ? 0.5 : 1 }}>
              {loading ? '…' : '↻'}
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: '24px 28px 48px' }}>

          {error && (
            <div style={{ marginBottom: 20, padding: '14px 18px', borderRadius: 14, background: '#fff1f2', border: '1px solid #fecdd3', display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: 2 }}>Could not load data</div>
                <div style={{ color: '#b91c1c', fontSize: 12, whiteSpace: 'pre-wrap' }}>{error}</div>
              </div>
              <button onClick={fetchAll} className="btn" style={{ padding: '5px 12px', borderRadius: 8, background: '#dc2626', color: '#fff', border: 'none', fontSize: 11, fontWeight: 700 }}>Retry</button>
            </div>
          )}

          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 24 }}>
            <StatCard label="Students" value={students.length} color="#4f46e5" loading={loading}
              sub={`${students.filter(s => isOnline(s.last_seen)).length} online`}
              icon={<svg width="19" height="19" fill="none" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/></svg>} />
            <StatCard label="Recruiters" value={recruiters.length} color="#059669" loading={loading}
              sub={`${recruiters.filter(r => isOnline(r.last_seen)).length} online`}
              icon={<svg width="19" height="19" fill="none" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="8.5" cy="7" r="4" stroke="currentColor" strokeWidth="2"/><polyline points="17 11 19 13 23 9" stroke="currentColor" strokeWidth="2"/></svg>} />
            <StatCard label="Open Reports" value={openRep} color="#dc2626" loading={loading}
              sub={`${reports.filter(r => r.status === 'under_review').length} in review`}
              icon={<svg width="19" height="19" fill="none" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2"/><line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>} />
            <StatCard label="Online Now" value={liveCount} color="#16a34a" loading={loading}
              sub="active last 5 min"
              icon={<svg width="19" height="19" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>} />
          </div>

          {/* ══ STUDENTS ══ */}
          {tab === 'students' && (
            <div className="fade-in">
              <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #eeeef5', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8f8fd', borderBottom: '1px solid #eeeef5' }}>
                      {['Student', 'Status', 'Last Login', 'Role', 'Actions'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '11px 18px', fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? <Empty icon="⏳" msg="Loading…" />
                      : fs.length === 0 ? <Empty icon="🎓" msg={search ? 'No matches' : 'No students yet.'} />
                      : fs.map(s => (
                        <tr key={s.id} className="row-hover" style={{ borderBottom: '1px solid #f4f4fa' }}>
                          <td style={{ padding: '13px 18px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                              <div style={{ position: 'relative', flexShrink: 0 }}>
                                <Av u={s} sz={34} color="#4f46e5" />
                                {isOnline(s.last_seen) && <span style={{ position: 'absolute', bottom: -1, right: -1, width: 9, height: 9, borderRadius: '50%', background: '#22c55e', border: '2px solid #fff' }} />}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: '#111' }}>{s.name || '—'}</div>
                                <div style={{ fontSize: 11, color: '#bbb', marginTop: 1 }}>{s.email}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '13px 18px' }}><OnlineDot ts={s.last_seen} /></td>
                          <td style={{ padding: '13px 18px', fontSize: 12, color: '#aaa', whiteSpace: 'nowrap' }}>{fmtDate(lastLogin(s))}</td>
                          <td style={{ padding: '13px 18px' }}>
                            <select value={s.role} onChange={e => changeRole(s.id, e.target.value)}
                              style={{ padding: '5px 10px', borderRadius: 8, border: `1px solid ${ROLE_CFG[s.role]?.border || '#e8e8f0'}`, background: ROLE_CFG[s.role]?.bg || '#f3f4f6', color: ROLE_CFG[s.role]?.color || '#374151', fontSize: 11, fontWeight: 700, cursor: 'pointer', outline: 'none' }}>
                              <option value="intern">intern</option>
                              <option value="admin">admin</option>
                              <option value="recruiter">recruiter</option>
                            </select>
                          </td>
                          <td style={{ padding: '13px 18px' }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <a href={`mailto:${s.email}`}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#dcfce7'}
                                onMouseLeave={e => e.currentTarget.style.background = '#f0fdf4'}>
                                <svg width="10" height="10" fill="none" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2"/><polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2"/></svg>
                                Contact
                              </a>
                              <button className="btn" onClick={() => deleteUser(s.id, s.name || s.email)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, background: '#fff1f2', border: '1px solid #fecdd3', color: '#dc2626', fontSize: 11, fontWeight: 700 }}>
                                <svg width="10" height="10" fill="none" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══ RECRUITERS ══ */}
          {tab === 'recruiters' && (
            <div className="fade-in">

              <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #eeeef5', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8f8fd', borderBottom: '1px solid #eeeef5' }}>
                      {['Recruiter', 'Status', 'Last Login', 'Joined', 'Actions'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '11px 18px', fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? <Empty icon="⏳" msg="Loading…" />
                      : fr.length === 0 ? <Empty icon="🏢" msg={search ? 'No matches' : 'No recruiters yet.'} />
                      : fr.map(r => (
                        <tr key={r.id} className="row-hover" style={{ borderBottom: '1px solid #f4f4fa' }}>
                          <td style={{ padding: '13px 18px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                              <div style={{ position: 'relative', flexShrink: 0 }}>
                                <Av u={r} sz={34} color="#059669" />
                                {isOnline(r.last_seen) && <span style={{ position: 'absolute', bottom: -1, right: -1, width: 9, height: 9, borderRadius: '50%', background: '#22c55e', border: '2px solid #fff' }} />}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: '#111' }}>{r.name || '—'}</div>
                                <div style={{ fontSize: 11, color: '#bbb', marginTop: 1 }}>{r.email}</div>
                                {r.company && <div style={{ fontSize: 10, color: '#059669', fontWeight: 600, marginTop: 2 }}>🏢 {r.company}</div>}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '13px 18px' }}><OnlineDot ts={r.last_seen} /></td>
                          <td style={{ padding: '13px 18px', fontSize: 12, color: '#aaa', whiteSpace: 'nowrap' }}>{fmtDate(lastLogin(r))}</td>
                          <td style={{ padding: '13px 18px', fontSize: 12, color: '#aaa', whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}</td>
                          <td style={{ padding: '13px 18px' }}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <a href={`mailto:${r.email}`}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#dcfce7'}
                                onMouseLeave={e => e.currentTarget.style.background = '#f0fdf4'}>
                                <svg width="10" height="10" fill="none" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2"/><polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2"/></svg>
                                Contact
                              </a>
                              <button className="btn"
                                onClick={() => { setRpTarget({ id: r.id, name: r.name || r.email }); setRpPw(''); setRpErr(''); setShowRP(true) }}
                                style={{ padding: '5px 10px', borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', fontSize: 11, fontWeight: 700 }}>
                                Reset PW
                              </button>
                              <button className="btn" onClick={() => deleteUser(r.id, r.name || r.email)}
                                style={{ padding: '5px 10px', borderRadius: 8, background: '#fff1f2', border: '1px solid #fecdd3', color: '#dc2626', fontSize: 11, fontWeight: 700 }}>
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══ REPORTS ══ */}
          {tab === 'reports' && (
            <div className="fade-in">
              {loading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#ccc' }}><div style={{ fontSize: 32, marginBottom: 10 }}>⏳</div>Loading…</div>
              ) : reports.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#ccc' }}><div style={{ fontSize: 36, marginBottom: 10 }}>📋</div><div>No reports yet</div></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {reports.map(rep => {
                    const sc = STATUS_CFG[rep.status] || { bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb', dot: '#d1d5db', label: rep.status }
                    return (
                      <div key={rep.id} style={{ background: '#fff', borderRadius: 16, border: '1px solid #eeeef5', padding: '18px 20px', display: 'flex', gap: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
                        <div style={{ width: 3, borderRadius: 4, background: sc.dot, flexShrink: 0, minHeight: 40 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, color: '#111', fontSize: 14 }}>{rep.reason || 'Report'}</span>
                            <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{sc.label}</span>
                          </div>
                          {rep.description && <p style={{ margin: '0 0 6px', fontSize: 12, color: '#888', lineHeight: 1.6 }}>{rep.description}</p>}
                          <div style={{ fontSize: 11, color: '#bbb' }}>Submitted {timeAgo(rep.created_at)}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, justifyContent: 'center' }}>
                          {rep.status !== 'under_review' && (
                            <button className="btn" onClick={() => updateReport(rep.id, 'under_review')}
                              style={{ padding: '6px 12px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                              Mark Review
                            </button>
                          )}
                          {rep.status !== 'resolved' && (
                            <button className="btn" onClick={() => updateReport(rep.id, 'resolved')}
                              style={{ padding: '6px 12px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', fontSize: 11, fontWeight: 700 }}>
                              Resolve ✓
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══ SESSIONS ══ */}
          {tab === 'sessions' && (
            <div className="fade-in">
              <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #eeeef5', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8f8fd', borderBottom: '1px solid #eeeef5' }}>
                      {['User', 'Role', 'When', 'IP Address', 'Browser'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '11px 18px', fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? <Empty icon="⏳" msg="Loading…" />
                      : sessions.length === 0 ? <Empty icon="🔐" msg="No sessions recorded yet." />
                      : sessions.map((s, i) => {
                        const ua = s.user_agent || ''
                        const browser = ua.includes('Chrome') ? '🌐 Chrome' : ua.includes('Firefox') ? '🦊 Firefox' : ua.includes('Safari') ? '🧭 Safari' : ua ? '🖥 ' + ua.slice(0, 16) : '—'
                        return (
                          <tr key={s.id || i} className="row-hover" style={{ borderBottom: '1px solid #f4f4fa' }}>
                            <td style={{ padding: '12px 18px', fontWeight: 600, color: '#111' }}>{s.email || s.user_id}</td>
                            <td style={{ padding: '12px 18px' }}><RoleBadge role={s.role} /></td>
                            <td style={{ padding: '12px 18px', fontSize: 12, color: '#aaa', whiteSpace: 'nowrap' }}>{fmtDate(s.logged_in_at)}</td>
                            <td style={{ padding: '12px 18px', fontSize: 11, color: '#ccc', fontFamily: 'monospace' }}>{s.ip_address || '—'}</td>
                            <td style={{ padding: '12px 18px', fontSize: 12, color: '#aaa' }}>{browser}</td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ══ RESET PASSWORD MODAL ══ */}
      <Modal open={showRP} onClose={() => { setShowRP(false); setRpPw(''); setRpErr('') }} title={`Reset Password — ${rpTarget?.name}`}>
        <Field label="New Password" value={rpPw} onChange={e => setRpPw(e.target.value)} placeholder="Min 6 characters" required type="password" minLength={6} />
        {rpErr && (
          <div style={{ padding: '10px 13px', borderRadius: 10, background: '#fff1f2', border: '1px solid #fecdd3', fontSize: 12, color: '#dc2626', marginBottom: 14 }}>
            ⚠ <span style={{ wordBreak: 'break-word' }}>{rpErr}</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button className="btn" onClick={() => { setShowRP(false); setRpPw(''); setRpErr('') }}
            style={{ flex: 1, padding: '11px', borderRadius: 11, border: '1px solid #e8e8f0', background: '#f8f8fd', color: '#555', fontSize: 13, fontWeight: 700 }}>
            Cancel
          </button>
          <button className="btn" onClick={resetPassword} disabled={rpBusy}
            style={{ flex: 1, padding: '11px', borderRadius: 11, border: 'none', background: rpBusy ? '#bfdbfe' : '#2563eb', color: '#fff', fontSize: 13, fontWeight: 700, opacity: rpBusy ? 0.7 : 1 }}>
            {rpBusy ? 'Resetting…' : 'Reset Password'}
          </button>
        </div>
      </Modal>

      <Toast t={toast} />
    </div>
  )
}