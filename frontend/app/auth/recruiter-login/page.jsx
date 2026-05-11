'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function RecruiterLoginPage() {
  const router = useRouter()
  const [form,    setForm]    = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [showPw,  setShowPw]  = useState(false)

  useEffect(() => {
    try {
      const token = localStorage.getItem('recruiter_token')
      const user  = JSON.parse(localStorage.getItem('recruiter_user') || '{}')
      if (token && user?.role === 'recruiter') router.replace('/recruiter')
    } catch (_) {}
  }, [])

  const handleSubmit = async e => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res  = await fetch(`${API_URL}/api/auth/recruiter/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: form.username.trim(), password: form.password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Invalid credentials')
      localStorage.setItem('recruiter_token', data.access_token)
      localStorage.setItem('recruiter_user',  JSON.stringify(data.user))
      router.push('/recruiter')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#fafafa', fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:none } }
        @keyframes shimmer { 0%,100%{opacity:.6} 50%{opacity:1} }
        @keyframes spin { to { transform: rotate(360deg); } }
        .form-panel { animation: fadeUp 0.4s ease both; }
        .input-field { transition: border-color 0.2s, box-shadow 0.2s; }
        .input-field:focus { outline: none; border-color: #00c896 !important; box-shadow: 0 0 0 3px rgba(0,200,150,0.1); }
        .submit-btn { transition: all 0.2s; }
        .submit-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,168,120,0.35); }
        .back-btn:hover { color: #111 !important; }
        .back-btn { transition: color 0.15s; }
      `}</style>

      {/* ── Left panel ── */}
      <div style={{ width: '44%', background: 'linear-gradient(160deg, #00100a 0%, #001a11 40%, #00100a 100%)', display: 'flex', flexDirection: 'column', padding: '44px 52px', position: 'relative', overflow: 'hidden' }}
        className="hidden-mobile">
        <style>{`.hidden-mobile{display:none} @media(min-width:900px){.hidden-mobile{display:flex;flex-direction:column}}`}</style>

        {/* Grid texture */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.07, backgroundImage: 'linear-gradient(rgba(0,200,150,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(0,200,150,.5) 1px,transparent 1px)', backgroundSize: '52px 52px', pointerEvents: 'none' }} />

        {/* Glows */}
        <div style={{ position: 'absolute', top: '25%', left: '10%', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,200,150,0.1) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '5%', right: '-15%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,200,150,0.05) 0%,transparent 70%)', pointerEvents: 'none' }} />

        {/* Logo */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: '#00c896', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 900, color: '#fff', boxShadow: '0 4px 14px rgba(0,200,150,0.4)', fontFamily: 'Syne, sans-serif' }}>X</div>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 17, color: '#fff', letterSpacing: '-0.02em' }}>InternX</span>
        </div>

        {/* Main copy */}
        <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99, background: 'rgba(0,200,150,0.12)', border: '1px solid rgba(0,200,150,0.25)', marginBottom: 28, width: 'fit-content' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00c896', animation: 'shimmer 2s ease infinite' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#00c896', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Recruiter Portal</span>
          </div>

          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 38, fontWeight: 800, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.03em', marginBottom: 18 }}>
            Discover top<br />
            intern talent.<br />
            <span style={{ color: '#00c896' }}>Data-driven.</span>
          </h1>

          <p style={{ fontSize: 14, lineHeight: 1.8, color: 'rgba(255,255,255,0.38)', maxWidth: 300 }}>
            Browse performance-ranked students and find your perfect hire.
          </p>
        </div>

        {/* Feature list */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { icon: '🏆', text: 'Performance-ranked leaderboard' },
            { icon: '🔀', text: 'GitHub activity & PR quality' },
            { icon: '📈', text: 'Full activity timeline per student' },
            { icon: '✉️', text: 'One-click email contact' },
          ].map(f => (
            <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 14 }}>{f.icon}</span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right / Form panel ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 32px' }}>
        <div className="form-panel" style={{ width: '100%', maxWidth: 380 }}>

          {/* Back */}
          <button className="back-btn" onClick={() => router.push('/auth/role-select')}
            style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 40, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#aaa', fontFamily: 'DM Sans, sans-serif', fontWeight: 500, padding: 0 }}>
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Back to role select
          </button>

          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ width: 50, height: 50, borderRadius: 14, background: 'rgba(0,200,150,0.1)', border: '1px solid rgba(0,200,150,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <svg width="23" height="23" fill="none" viewBox="0 0 24 24" style={{ color: '#00c896' }}>
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
                <path d="M22 11l-3 3-1.5-1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 28, fontWeight: 800, color: '#111', letterSpacing: '-0.03em', marginBottom: 6, lineHeight: 1.1 }}>Recruiter Sign In</h2>
            <p style={{ fontSize: 13, color: '#aaa', fontWeight: 400 }}>Access your talent discovery dashboard</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Email / Username</label>
              <input
                className="input-field"
                type="text"
                placeholder="recruiter@company.com"
                value={form.username}
                onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                required autoComplete="username"
                style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1.5px solid #e8e8ee', background: '#fff', fontSize: 14, color: '#111', fontFamily: 'DM Sans, sans-serif' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input-field"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  required autoComplete="current-password"
                  style={{ width: '100%', padding: '11px 48px 11px 14px', borderRadius: 12, border: '1.5px solid #e8e8ee', background: '#fff', fontSize: 14, color: '#111', fontFamily: 'DM Sans, sans-serif' }}
                />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: 11, fontWeight: 700, padding: 0, fontFamily: 'DM Sans, sans-serif' }}>
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ padding: '11px 14px', borderRadius: 11, background: '#fff1f2', border: '1px solid #fecdd3', color: '#dc2626', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15 }}>⚠</span> {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="submit-btn"
              style={{ width: '100%', padding: '13px', borderRadius: 13, border: 'none', background: loading ? '#e8e8ee' : 'linear-gradient(135deg, #00c896, #00a07a)', color: loading ? '#aaa' : '#fff', fontSize: 14, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading
                ? <><span style={{ width: 14, height: 14, border: '2px solid #ccc', borderTopColor: '#999', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} /> Signing in…</>
                : 'Sign In →'}
            </button>
          </form>

          {/* Footer */}
          <div style={{ marginTop: 24, padding: '12px 14px', borderRadius: 12, background: 'rgba(0,200,150,0.05)', border: '1px solid rgba(0,200,150,0.15)', display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontSize: 16 }}>💼</span>
            <p style={{ fontSize: 12, color: '#aaa', lineHeight: 1.5 }}>
              Don't have an account? Contact{' '}
              <a href="mailto:admin@internx.io" style={{ color: '#00c896', textDecoration: 'none', fontWeight: 600 }}>admin@internx.io</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}