'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAuthStore } from '@/lib/store/authStore'
import api from '@/lib/api'

// ─── Role config ──────────────────────────────────────────────────────────────
const ROLE_CONFIG = {
  frontend:  { label: 'Frontend',    color: '#7c6fff', gradient: 'linear-gradient(135deg,#8b7fff,#b3aaff)', icon: '⚡' },
  backend:   { label: 'Backend',     color: '#5b9ef6', gradient: 'linear-gradient(135deg,#4a7fd4,#7db3f8)', icon: '⚙️' },
  fullstack: { label: 'Full Stack',  color: '#f5a623', gradient: 'linear-gradient(135deg,#c97e1a,#fbc94a)', icon: '🔥' },
  devops:    { label: 'DevOps',      color: '#20d4a0', gradient: 'linear-gradient(135deg,#12b386,#4de8c0)', icon: '🚀' },
  design:    { label: 'Design',      color: '#f472b6', gradient: 'linear-gradient(135deg,#d4449a,#f896cc)', icon: '✦'  },
  tester:    { label: 'QA / Tester', color: '#a286f5', gradient: 'linear-gradient(135deg,#8b6ef5,#c4b0ff)', icon: '🧪' },
  intern:    { label: 'Intern',      color: '#7c6fff', gradient: 'linear-gradient(135deg,#8b7fff,#b3aaff)', icon: '🎓' },
}

const ROLE_SKILLS = {
  tester:    ['QA / Tester', 'Intern', 'Team Player', 'Detail Oriented', 'Fast Learner'],
  frontend:  ['Frontend Dev', 'Intern', 'UI Builder', 'CSS Wizard', 'React'],
  backend:   ['Backend Dev', 'Intern', 'API Builder', 'DB Expert', 'Python'],
  fullstack: ['Full Stack', 'Intern', 'Team Player', 'Problem Solver', 'Versatile'],
  devops:    ['DevOps', 'Intern', 'CI/CD', 'Cloud', 'Automation'],
  design:    ['Designer', 'Intern', 'Figma', 'UX Focus', 'Creative'],
  intern:    ['Intern', 'Team Player', 'Fast Learner', 'Curious', 'Driven'],
}
const SKILL_ICONS = { 'QA / Tester':'🧪','Intern':'🎓','Team Player':'🤝','Detail Oriented':'✅','Fast Learner':'🚀','Frontend Dev':'⚡','UI Builder':'🎨','CSS Wizard':'✨','React':'⚛','Backend Dev':'⚙️','API Builder':'🔌','DB Expert':'🗄','Python':'🐍','Full Stack':'🔥','Problem Solver':'🧩','Versatile':'🔄','DevOps':'🛠','CI/CD':'🔁','Cloud':'☁️','Automation':'🤖','Designer':'🖌','Figma':'🎭','UX Focus':'👁','Creative':'💡','Curious':'🔍','Driven':'🏁' }

// ─── Streak calculation (FIXED) ───────────────────────────────────────────────
/**
 * Calculates a true consecutive-day streak from today backwards.
 *
 * Rules:
 *  - Collects all unique YYYY-MM-DD dates from task `updated_at` fields.
 *  - Starts from today (or yesterday if today has no activity yet — grace period).
 *  - Walks backwards day-by-day; stops as soon as a day is missing.
 *
 * Bug that was here before:
 *   const activeDays = new Set(...).size          // just a count of unique days
 *   const streak     = Math.min(activeDays, 14)   // capped at 14 — NOT consecutive
 *
 * This meant working Mon + Wed + Fri showed streak=3 even though there were gaps,
 * and someone who hadn't touched the app in a week still showed a "streak".
 */
function calcStreak(tasks) {
  // Collect all unique calendar dates that have task activity
  const activeDates = new Set(
    tasks
      .filter(t => t.updated_at)
      .map(t => t.updated_at.slice(0, 10))   // "YYYY-MM-DD"
  )

  if (activeDates.size === 0) return 0

  // Helper: get "YYYY-MM-DD" string for a Date offset by `offsetDays` from today
  const toDateStr = (offsetDays = 0) => {
    const d = new Date()
    d.setDate(d.getDate() + offsetDays)
    return d.toISOString().slice(0, 10)
  }

  const today     = toDateStr(0)
  const yesterday = toDateStr(-1)

  // Grace period: if today has no activity yet, start counting from yesterday.
  // This prevents the streak from resetting every morning before the user works.
  let cursor = activeDates.has(today) ? 0 : activeDates.has(yesterday) ? -1 : null

  // If neither today nor yesterday has activity → streak is broken
  if (cursor === null) return 0

  let streak = 0
  while (activeDates.has(toDateStr(cursor))) {
    streak++
    cursor--
  }

  return streak
}

// ─── Certificate SVG (signatures removed) ─────────────────────────────────────
function buildCertSVG({ name, role, project, date, certId }) {
  const enc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 636" width="900" height="636">
  <defs>
    <linearGradient id="gbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f8f8fc"/><stop offset="100%" stop-color="#ede9ff"/></linearGradient>
    <linearGradient id="gacc" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#7c6fff"/><stop offset="100%" stop-color="#a99fff"/></linearGradient>
    <linearGradient id="ggold" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#c9a84c"/><stop offset="100%" stop-color="#f0d080"/></linearGradient>
  </defs>
  <rect width="900" height="636" fill="url(#gbg)"/>
  <rect x="14" y="14" width="872" height="608" rx="12" fill="none" stroke="url(#gacc)" stroke-width="2.5"/>
  <rect x="22" y="22" width="856" height="592" rx="10" fill="none" stroke="url(#gacc)" stroke-width="0.7" stroke-dasharray="8,5"/>
  <rect x="14" y="14" width="872" height="90" rx="12" fill="url(#gacc)"/>
  <rect x="14" y="84" width="872" height="20" fill="url(#gacc)"/>
  <rect x="38" y="28" width="54" height="54" rx="13" fill="rgba(255,255,255,0.2)"/>
  <text x="65" y="63" font-family="Georgia,serif" font-size="28" font-weight="800" fill="white" text-anchor="middle">X</text>
  <text x="106" y="51" font-family="Georgia,serif" font-size="21" font-weight="700" fill="white">InternX Academy</text>
  <text x="106" y="71" font-family="Arial,sans-serif" font-size="11" fill="rgba(255,255,255,0.75)" letter-spacing="2.5">OFFICIAL CERTIFICATION PROGRAM</text>
  <rect x="718" y="30" width="152" height="46" rx="9" fill="rgba(255,255,255,0.17)"/>
  <text x="794" y="56" font-family="Arial,sans-serif" font-size="11" font-weight="700" fill="white" text-anchor="middle" letter-spacing="1.5">CERTIFICATE OF</text>
  <text x="794" y="71" font-family="Arial,sans-serif" font-size="9.5" fill="rgba(255,255,255,0.8)" text-anchor="middle" letter-spacing="1.5">INTERNSHIP COMPLETION</text>
  <g fill="none" stroke="#c9a84c" stroke-width="1.3" opacity="0.65">
    <path d="M50 130 Q50 118 63 118"/><line x1="50" y1="150" x2="50" y2="130"/><line x1="50" y1="118" x2="80" y2="118"/>
    <path d="M850 130 Q850 118 837 118"/><line x1="850" y1="150" x2="850" y2="130"/><line x1="850" y1="118" x2="820" y2="118"/>
    <path d="M50 510 Q50 522 63 522"/><line x1="50" y1="490" x2="50" y2="510"/><line x1="50" y1="522" x2="80" y2="522"/>
    <path d="M850 510 Q850 522 837 522"/><line x1="850" y1="490" x2="850" y2="510"/><line x1="850" y1="522" x2="820" y2="522"/>
  </g>
  <circle cx="450" cy="152" r="24" fill="url(#gacc)" opacity="0.12"/>
  <circle cx="450" cy="152" r="17" fill="none" stroke="url(#gacc)" stroke-width="1.5"/>
  <text x="450" y="158" font-size="15" text-anchor="middle" fill="#7c6fff">&#x2726;</text>
  <text x="450" y="204" font-family="Georgia,serif" font-size="14" fill="#8888a0" text-anchor="middle" font-style="italic" letter-spacing="1">This is to certify that</text>
  <text x="450" y="264" font-family="Georgia,serif" font-size="43" font-weight="700" fill="#0a0a0f" text-anchor="middle">${enc(name)}</text>
  <line x1="185" y1="278" x2="715" y2="278" stroke="url(#ggold)" stroke-width="1.6"/>
  <text x="450" y="315" font-family="Arial,sans-serif" font-size="13" fill="#3d3d4e" text-anchor="middle">has successfully completed an internship as</text>
  <text x="450" y="348" font-family="Georgia,serif" font-size="23" font-weight="700" fill="#7c6fff" text-anchor="middle">${enc(role)}</text>
  <text x="450" y="385" font-family="Arial,sans-serif" font-size="13" fill="#3d3d4e" text-anchor="middle">for the project</text>
  <text x="450" y="415" font-family="Georgia,serif" font-size="19" font-weight="600" fill="#0a0a0f" text-anchor="middle">&quot;${enc(project)}&quot;</text>
  <line x1="110" y1="448" x2="790" y2="448" stroke="#e2e2ee" stroke-width="1"/>
  <circle cx="450" cy="510" r="45" fill="none" stroke="url(#gacc)" stroke-width="1.5"/>
  <circle cx="450" cy="510" r="35" fill="url(#gacc)" opacity="0.09"/>
  <text x="450" y="505" font-family="Arial,sans-serif" font-size="11" text-anchor="middle" fill="#7c6fff" font-weight="700" letter-spacing="1">INTERN</text>
  <text x="450" y="520" font-family="Arial,sans-serif" font-size="11" text-anchor="middle" fill="#7c6fff" font-weight="700" letter-spacing="1">X</text>
  <text x="450" y="535" font-family="Arial,sans-serif" font-size="8" text-anchor="middle" fill="#8888a0" letter-spacing="1.5">ACADEMY</text>
  <text x="450" y="596" font-family="Arial,sans-serif" font-size="10" fill="#8888a0" text-anchor="middle">Issued: ${enc(date)} &#xB7; Certificate ID: ${enc(certId)} &#xB7; internxacademy.dev</text>
</svg>`
}

async function svgToPngDataUrl(svgStr) {
  return new Promise((resolve, reject) => {
    const dataUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr)
    const img = new window.Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 1800; canvas.height = 1272
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1800, 1272)
      ctx.drawImage(img, 0, 0, 1800, 1272)
      try { resolve(canvas.toDataURL('image/png')) } catch (e) { reject(e) }
    }
    img.onerror = reject; img.src = dataUri
  })
}
function triggerDownload(href, filename) {
  const a = document.createElement('a'); a.href = href; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
}
function openPrintWindow(svgStr, name) {
  const w = window.open('', '_blank', 'width=960,height=700')
  if (!w) return
  w.document.write(`<!DOCTYPE html><html><head><title>InternX Certificate - ${name}</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{background:#f0f0f8;display:flex;justify-content:center;align-items:center;min-height:100vh;font-family:sans-serif}.wrap{background:white;padding:32px;border-radius:12px;box-shadow:0 4px 32px rgba(0,0,0,.12);max-width:960px;width:100%}svg{width:100%;height:auto;display:block}.actions{display:flex;gap:12px;justify-content:center;padding:24px 0 0}button{padding:10px 24px;border-radius:8px;border:none;cursor:pointer;font-weight:600;font-size:14px}.btn-print{background:#7c6fff;color:white}.btn-close{background:#f0f0f8;color:#3d3d4e}@media print{.actions{display:none}body{background:white}.wrap{box-shadow:none;padding:0}@page{size:A4 landscape;margin:0}}</style></head>
  <body><div class="wrap">${svgStr}<div class="actions"><button class="btn-print" onclick="window.print()">Print / Save as PDF</button><button class="btn-close" onclick="window.close()">Close</button></div></div></body></html>`)
  w.document.close()
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────
function Sk({ h = 14, w = '100%', r = 6, light = false }) {
  return <div style={{ height: h, width: w, borderRadius: r, flexShrink: 0, background: light ? 'rgba(255,255,255,0.18)' : 'linear-gradient(90deg,var(--surface-2) 25%,var(--surface-3) 50%,var(--surface-2) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 5500); return () => clearTimeout(t) }, [onClose])
  const P = {
    warning: { bg:'#fdfaf3', border:'rgba(245,158,11,.25)', text:'#78560a', icon:'⏳' },
    success: { bg:'#f2fdf9', border:'rgba(20,184,130,.25)', text:'#065f46', icon:'🎉' },
    error:   { bg:'#fff5f5', border:'rgba(239,68,68,.25)', text:'#991b1b', icon:'⚠️' }
  }[type] || {}
  return (
    <div style={{ position:'fixed', bottom:28, left:'50%', transform:'translateX(-50%)', zIndex:9999, display:'flex', alignItems:'center', gap:10, background:P.bg, border:`1.5px solid ${P.border}`, borderRadius:18, padding:'13px 20px', boxShadow:'0 8px 40px rgba(0,0,0,.1)', animation:'toastIn .3s cubic-bezier(.22,1,.36,1)', maxWidth:'min(520px,calc(100vw - 40px))', width:'max-content' }}>
      <span style={{ fontSize:18 }}>{P.icon}</span>
      <p style={{ fontSize:13, fontWeight:500, color:P.text, margin:0, lineHeight:1.5 }}>{message}</p>
      <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:14, color:P.text, opacity:.4, marginLeft:8 }}>✕</button>
    </div>
  )
}

// ─── Enhanced Stat Card ────────────────────────────────────────────────────────
function StatCard({ icon, iconBg, iconColor, label, value, sub, trend, trendColor, loading, accentBar }) {
  return (
    <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:22, padding:'20px 20px 16px', boxShadow:'0 2px 8px rgba(0,0,0,.04)', display:'flex', flexDirection:'column', gap:0, position:'relative', overflow:'hidden', transition:'box-shadow .2s, transform .2s' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,.08)'; e.currentTarget.style.transform='translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,.04)'; e.currentTarget.style.transform='none' }}
    >
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:accentBar || iconBg, borderRadius:'22px 22px 0 0' }} />
      <div style={{ position:'absolute', top:-20, right:-20, width:80, height:80, borderRadius:'50%', background:iconBg, opacity:.12, pointerEvents:'none' }} />
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <div style={{ width:44, height:44, borderRadius:14, background:iconBg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{icon}</div>
        {trend && !loading && (
          <span style={{ fontSize:11, fontWeight:700, color: trendColor || '#20d4a0', background: trendColor ? trendColor+'15' : 'rgba(32,212,160,.12)', padding:'4px 9px', borderRadius:8 }}>{trend}</span>
        )}
      </div>
      <p style={{ fontSize:10, color:'var(--ink-muted)', fontWeight:700, letterSpacing:'.07em', textTransform:'uppercase', margin:'0 0 4px' }}>{label}</p>
      {loading
        ? <Sk h={32} w={70} r={7}/>
        : <p style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:32, color: iconColor || 'var(--ink)', margin:'0 0 3px', lineHeight:1, letterSpacing:'-0.02em' }}>{value}</p>
      }
      {loading
        ? <div style={{marginTop:5}}><Sk h={11} w={80} r={4}/></div>
        : <p style={{ fontSize:12, color:'var(--ink-muted)', margin:0, fontWeight:500 }}>{sub}</p>
      }
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const router = useRouter()
  const { user: storeUser, setAuth } = useAuthStore()

  const [profile, setProfile]     = useState(null)
  const [project, setProject]     = useState(null)
  const [tasks, setTasks]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  const [editOpen, setEditOpen]   = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftBio, setDraftBio]   = useState('')
  const [saving, setSaving]       = useState(false)
  const [saveMsg, setSaveMsg]     = useState('')
  const [certState, setCertState] = useState('idle')
  const [toast, setToast]         = useState(null)

  const showToast = (msg, type='warning') => setToast({ message:msg, type })

  useEffect(() => {
    if (!storeUser) { router.push('/auth/login'); return }
    let mounted = true
    async function load() {
      try {
        setLoading(true)
        const meRes = await api.get('/api/auth/me')
        const me = meRes.data
        if (!mounted) return
        setProfile(me); setDraftName(me.name||''); setDraftBio(me.bio||'')
        const [taskRes, projRes] = await Promise.all([
          api.get('/api/tasks/my-tasks').catch(() => ({ data: [] })),
          me.project_id ? api.get(`/api/projects/${me.project_id}`).catch(() => ({ data:null })) : Promise.resolve({ data:null }),
        ])
        if (!mounted) return
        setTasks(taskRes.data || []); setProject(projRes.data)
      } catch { if (mounted) setError('Could not load profile. Please refresh.') }
      finally { if (mounted) setLoading(false) }
    }
    load(); return () => { mounted = false }
  }, [storeUser, router])

  async function saveProfile() {
    if (!draftName.trim()) return
    setSaving(true)
    try {
      const res = await api.put('/api/auth/me', { name:draftName.trim(), bio:draftBio.trim()||null })
      setProfile(res.data)
      if (storeUser) setAuth({ ...storeUser, name:res.data.name, bio:res.data.bio }, storeUser.token ?? JSON.parse(localStorage.getItem('internx-auth')||'{}')?.state?.token)
      setSaveMsg('✓ Saved'); setEditOpen(false); setTimeout(() => setSaveMsg(''), 3000)
    } catch { setSaveMsg('⚠ Failed') }
    finally { setSaving(false) }
  }

  async function handleCert(fmt) {
    if (!allDone) {
      const remaining = totalTasks - done
      const msg = totalTasks === 0
        ? 'Looks like no tasks have been assigned to you yet. Check back soon!'
        : remaining === 1
          ? 'Almost there! Just 1 more task to wrap up before your certificate is ready.'
          : `You\'re doing great! ${remaining} tasks left — finish them up to unlock your certificate.`
      showToast(msg, 'warning')
      return
    }
    setCertState('busy')
    try {
      const certId = 'IXA-' + Date.now().toString(36).toUpperCase()
      const date   = new Date().toLocaleDateString('en-US',{ year:'numeric', month:'long', day:'numeric' })
      const rc     = ROLE_CONFIG[profile?.intern_role] || ROLE_CONFIG.intern
      const svg    = buildCertSVG({ name:profile?.name||'Intern', role:rc.label, project:project?.project_title||project?.title||'InternX Programme', date, certId })
      const slug   = (profile?.name||'Intern').replace(/\s+/g,'-')
      if (fmt==='svg') { triggerDownload(URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})), `InternX-Certificate-${slug}.svg`) }
      else if (fmt==='png') { triggerDownload(await svgToPngDataUrl(svg), `InternX-Certificate-${slug}.png`) }
      else { openPrintWindow(svg, profile?.name||'Intern') }
      setCertState('done'); showToast('Your certificate has been exported successfully! 🎓', 'success'); setTimeout(() => setCertState('idle'), 3000)
    } catch(e) { console.error(e); showToast('Something went wrong during export. Please try again.', 'error'); setCertState('idle') }
  }

  // ── Derived stats ───────────────────────────────────────────────────────────
  const totalTasks  = tasks.length
  const done        = tasks.filter(t => t.status === 'done').length
  const inProgress  = tasks.filter(t => t.status === 'in_progress').length
  const review      = tasks.filter(t => t.status === 'review').length
  const allDone     = totalTasks > 0 && done === totalTasks
  const pctDone     = totalTasks ? Math.round((done/totalTasks)*100) : 0
  const scored      = tasks.filter(t => typeof t.score === 'number')
  const avgScore    = scored.length ? (scored.reduce((s,t) => s+t.score,0)/scored.length).toFixed(0) : null
  const hoursLogged = done*2 + inProgress*0.5 + review*1

  // ── FIXED: Real consecutive-day streak ──────────────────────────────────────
  // Old (broken): const activeDays = new Set(...).size; const streak = Math.min(activeDays, 14)
  // - This just counted total unique days worked (not consecutive) and capped at 14.
  // - e.g. working Mon + Wed + Fri gave streak=3 despite gaps.
  // - Someone inactive for a week still showed their old "streak" number.
  //
  // New (fixed): calcStreak() walks backwards from today/yesterday, stops at first gap.
  // - Grace period: if today has no activity yet, starts from yesterday (avoids streak
  //   resetting every morning before the user does any work).
  const streak      = calcStreak(tasks)
  const activeDays  = new Set(tasks.filter(t => t.updated_at).map(t => t.updated_at.slice(0,10))).size

  const rc        = ROLE_CONFIG[profile?.intern_role] || ROLE_CONFIG.intern
  const initials  = profile ? profile.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() : '?'
  const joined    = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US',{month:'long',year:'numeric'}) : '—'
  const skills    = ROLE_SKILLS[profile?.intern_role] || ROLE_SKILLS.intern

  if (error) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:280, gap:12 }}>
      <span style={{ fontSize:36 }}>⚠️</span>
      <p style={{ color:'var(--ink-muted)' }}>{error}</p>
      <button className="btn-primary" onClick={() => window.location.reload()}>Retry</button>
    </div>
  )

  return (
    <div className="animate-fade-up" style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ══════════════════════════════════════════════════
          HERO BANNER
         ══════════════════════════════════════════════════ */}
      <div style={{ borderRadius:24, overflow:'hidden', boxShadow:'0 8px 40px rgba(124,111,255,.15)', position:'relative' }}>
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg, #8b7fff 0%, #a99fff 40%, #c4b8ff 100%)', opacity:1 }} />
        <div style={{ position:'absolute', inset:0, backgroundImage:"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")", opacity:.5 }} />
        <div style={{ position:'absolute', right:-80, top:-80, width:360, height:360, borderRadius:'50%', background:'rgba(255,255,255,0.1)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', right:60, bottom:-60, width:220, height:220, borderRadius:'50%', background:'rgba(255,255,255,0.06)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', left:-40, top:60, width:180, height:180, borderRadius:'50%', background:'rgba(255,255,255,0.05)', pointerEvents:'none' }} />

        <div style={{ position:'relative', padding:'28px 32px 26px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:10 }}>
            <span style={{ display:'flex', alignItems:'center', gap:7, background:'rgba(0,200,150,0.2)', color:'#b8fff0', border:'1.5px solid rgba(0,200,150,0.3)', borderRadius:12, fontSize:12, fontWeight:700, padding:'6px 14px', backdropFilter:'blur(8px)' }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:'#4dffd4', display:'inline-block', animation:'pulse 2s ease-in-out infinite' }} />
              Active intern
            </span>
            <div style={{ display:'flex', gap:8 }}>
              {profile?.github_username && (
                <a
                  href={`https://github.com/${profile.github_username}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.18)', color:'white', border:'1.5px solid rgba(255,255,255,0.28)', borderRadius:12, fontSize:12, fontWeight:700, padding:'6px 14px', cursor:'pointer', backdropFilter:'blur(8px)', textDecoration:'none', transition:'all .18s' }}
                  onMouseEnter={e=>{ e.currentTarget.style.background='rgba(255,255,255,0.28)' }}
                  onMouseLeave={e=>{ e.currentTarget.style.background='rgba(255,255,255,0.18)' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                  View Profile
                </a>
              )}
              <button
                onClick={() => { setDraftName(profile?.name||''); setDraftBio(profile?.bio||''); setEditOpen(true) }}
                style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.18)', color:'white', border:'1.5px solid rgba(255,255,255,0.28)', borderRadius:12, fontSize:12, fontWeight:700, padding:'6px 14px', cursor:'pointer', backdropFilter:'blur(8px)', transition:'all .18s' }}
                onMouseEnter={e=>{ e.currentTarget.style.background='rgba(255,255,255,0.28)' }}
                onMouseLeave={e=>{ e.currentTarget.style.background='rgba(255,255,255,0.18)' }}
              >
                ✏ Edit profile
              </button>
            </div>
          </div>

          <div style={{ display:'flex', alignItems:'flex-start', gap:22 }}>
            <div style={{ position:'relative', flexShrink:0 }}>
              {loading ? (
                <div style={{ width:100, height:100, borderRadius:24, background:'rgba(255,255,255,0.2)' }} />
              ) : profile?.avatar_url ? (
                <Image src={profile.avatar_url} alt={profile.name} width={100} height={100} style={{ borderRadius:24, border:'3px solid rgba(255,255,255,0.5)', objectFit:'cover', boxShadow:'0 8px 28px rgba(0,0,0,.18)', display:'block' }} />
              ) : (
                <div style={{ width:100, height:100, borderRadius:24, background:'rgba(255,255,255,0.22)', border:'3px solid rgba(255,255,255,0.45)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:34, color:'white', letterSpacing:'-2px', backdropFilter:'blur(8px)', boxShadow:'0 8px 28px rgba(0,0,0,.15)' }}>
                  {initials}
                </div>
              )}
              <div style={{ position:'absolute', bottom:4, right:4, width:16, height:16, borderRadius:'50%', background:'#4dffd4', border:'3px solid white', boxShadow:'0 0 0 2px rgba(77,255,212,.35)' }} />
            </div>

            <div style={{ flex:1, minWidth:0, paddingTop:4 }}>
              {loading ? (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  <Sk h={30} w={200} r={8} light />
                  <Sk h={16} w={150} r={6} light />
                  <Sk h={13} w={280} r={5} light />
                </div>
              ) : (
                <>
                  <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:6 }}>
                    <h1 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:28, color:'white', margin:0, letterSpacing:'-0.03em', textShadow:'0 2px 8px rgba(0,0,0,.1)' }}>{profile?.name}</h1>
                    <div style={{ width:26, height:26, borderRadius:'50%', background:'rgba(255,255,255,0.28)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0 }}>✓</div>
                    {saveMsg && <span style={{ fontSize:11, fontWeight:700, color:saveMsg.startsWith('✓')?'#b8fff0':'#fca5a5', background:'rgba(0,0,0,0.15)', padding:'3px 10px', borderRadius:8 }}>{saveMsg}</span>}
                  </div>
                  <p style={{ fontSize:14, color:'rgba(255,255,255,0.88)', margin:'0 0 10px', fontWeight:600 }}>{rc.icon} {rc.label} Intern</p>
                  <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', fontSize:13, color:'rgba(255,255,255,0.78)' }}>
                    {profile?.github_username && (
                      <span style={{ display:'flex', alignItems:'center', gap:5 }}>👤 @{profile.github_username}</span>
                    )}
                    {profile?.email && <span style={{ display:'flex', alignItems:'center', gap:5 }}>✉ {profile.email}</span>}
                    <span style={{ display:'flex', alignItems:'center', gap:5 }}>📅 Joined {joined}</span>
                  </div>
                  {profile?.bio && (
                    <p style={{ fontSize:13, color:'rgba(255,255,255,0.82)', lineHeight:1.6, margin:'10px 0 0', maxWidth:540 }}>{profile.bio}</p>
                  )}
                </>
              )}
            </div>
          </div>

          {!loading && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:18 }}>
              {skills.map(s => (
                <span key={s} style={{ display:'flex', alignItems:'center', gap:5, background:'rgba(255,255,255,0.18)', color:'white', borderRadius:12, fontSize:12, fontWeight:600, padding:'6px 13px', backdropFilter:'blur(6px)', border:'1px solid rgba(255,255,255,0.22)', cursor:'default' }}>
                  {SKILL_ICONS[s] || '✦'} {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          PROJECT CARD
         ══════════════════════════════════════════════════ */}
      <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:20, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.04)' }}>
        {loading ? (
          <div style={{ display:'flex', gap:16 }}>
            <Sk h={64} w={64} r={14} />
            <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}><Sk h={14} w={120} /><Sk h={20} w={240} /><Sk h={12} w={180} /><Sk h={8} /></div>
          </div>
        ) : (
          <div style={{ display:'flex', flexWrap:'wrap', alignItems:'flex-start', gap:16 }}>
            <div style={{ width:64, height:64, borderRadius:16, background:rc.gradient, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, flexShrink:0, boxShadow:`0 6px 20px ${rc.color}33` }}>🛍</div>
            <div style={{ flex:1, minWidth:200 }}>
              <p style={{ fontSize:11, fontWeight:700, letterSpacing:'.07em', color:'var(--ink-muted)', textTransform:'uppercase', margin:'0 0 4px' }}>Current Project</p>
              <h2 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:18, color:'var(--ink)', margin:'0 0 4px' }}>
                {project?.project_title || project?.title || 'Not assigned yet'}
              </h2>
              {project?.description && <p style={{ fontSize:13, color:'var(--ink-soft)', margin:'0 0 10px', lineHeight:1.5 }}>{project.description}</p>}
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                  <span style={{ fontSize:12, color:'var(--ink-muted)' }}>Overall Progress</span>
                  <span style={{ fontSize:13, fontWeight:800, color:rc.color }}>{pctDone}%</span>
                </div>
                <div style={{ height:8, borderRadius:99, background:'var(--surface-2)', overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:99, background:rc.gradient, width:`${pctDone}%`, transition:'width .6s ease', boxShadow:`0 0 8px ${rc.color}44` }} />
                </div>
              </div>
            </div>
            <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
              {[
                { icon:'📋', val:`${done} / ${totalTasks}`, label:'Tasks Completed' },
                { icon:'⏱', val:`${hoursLogged.toFixed(0)}`, label:'Hours Logged' },
              ].map(s => (
                <div key={s.label} style={{ textAlign:'center', minWidth:80 }}>
                  <div style={{ width:44, height:44, borderRadius:14, background:'var(--accent-soft)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, margin:'0 auto 6px' }}>{s.icon}</div>
                  <p style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:20, color:'var(--ink)', margin:'0 0 1px' }}>{s.val}</p>
                  <p style={{ fontSize:11, color:'var(--ink-muted)', margin:0 }}>{s.label}</p>
                </div>
              ))}
              {project && (
                <div style={{ textAlign:'center', minWidth:80 }}>
                  <div style={{ width:44, height:44, borderRadius:14, background:rc.gradient, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, color:'white', margin:'0 auto 6px', boxShadow:`0 4px 12px ${rc.color}44` }}>
                    {project.difficulty?.[0]?.toUpperCase() || '?'}
                  </div>
                  <p style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:20, color:rc.color, margin:'0 0 1px', textTransform:'capitalize' }}>{project.difficulty || 'Active'}</p>
                  <p style={{ fontSize:11, color:'var(--ink-muted)', margin:0 }}>Difficulty</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════
          STATS GRID
         ══════════════════════════════════════════════════ */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(165px, 1fr))', gap:12 }}>
        <StatCard
          icon="✅" iconBg="linear-gradient(135deg,#d4f7ee,#a8f0da)" iconColor="#0a7a55"
          accentBar="linear-gradient(90deg,#20d4a0,#4de8c0)"
          label="Tasks Completed" value={done} sub={`out of ${totalTasks} total`}
          trend={done > 0 ? `${pctDone}%` : undefined} trendColor="#20d4a0" loading={loading}
        />
        <StatCard
          icon="⏱" iconBg="linear-gradient(135deg,#dbeafe,#bfdbfe)" iconColor="#1d4ed8"
          accentBar="linear-gradient(90deg,#3b82f6,#60a5fa)"
          label="Hours Logged" value={`${hoursLogged.toFixed(0)}h`} sub="total hours tracked"
          trend={inProgress > 0 ? `${inProgress} active` : undefined} trendColor="#3b82f6" loading={loading}
        />
        <StatCard
          icon="📅" iconBg="linear-gradient(135deg,#ede9ff,#d8d1ff)" iconColor="#5b21b6"
          accentBar="linear-gradient(90deg,#7c6fff,#a99fff)"
          label="Days Active" value={activeDays} sub="days contributed"
          trend={activeDays > 0 ? 'Consistent' : undefined} trendColor="#7c6fff" loading={loading}
        />
        <StatCard
          icon="⭐" iconBg="linear-gradient(135deg,#fef9c3,#fde68a)" iconColor="#92400e"
          accentBar="linear-gradient(90deg,#f59e0b,#fbbf24)"
          label="Avg Score" value={avgScore ? `${avgScore}%` : '—'} sub="across all tasks"
          trend={avgScore && avgScore >= 70 ? 'Great!' : undefined} trendColor="#f59e0b" loading={loading}
        />
        {/* 🔥 Streak card — now shows real consecutive-day streak */}
        <StatCard
          icon="🔥" iconBg="linear-gradient(135deg,#fee2e2,#fecaca)" iconColor="#991b1b"
          accentBar="linear-gradient(90deg,#ef4444,#f87171)"
          label="Streak" value={streak} sub={streak === 1 ? 'day in a row' : 'days in a row'}
          trend={streak >= 3 ? 'On fire! 🔥' : streak > 0 ? 'Keep it up!' : undefined}
          trendColor="#ef4444" loading={loading}
        />
      </div>

      {/* ══════════════════════════════════════════════════
          CERTIFICATE CARD
         ══════════════════════════════════════════════════ */}
      <div style={{ background:'linear-gradient(135deg, #f0edff 0%, #f6f4ff 50%, white 100%)', border:'1px solid rgba(124,111,255,.18)', borderRadius:24, padding:24, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', right:-40, top:-40, width:180, height:180, borderRadius:'50%', background:'rgba(124,111,255,.05)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', left:-20, bottom:-20, width:100, height:100, borderRadius:'50%', background:'rgba(124,111,255,.04)', pointerEvents:'none' }} />

        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
          <div style={{ width:46, height:46, borderRadius:14, background:'linear-gradient(135deg,#8b7fff,#b3aaff)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0, boxShadow:'0 6px 16px rgba(124,111,255,.3)' }}>🏆</div>
          <div>
            <h2 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:17, color:'var(--ink)', margin:0 }}>Certificate of Completion</h2>
            <p style={{ fontSize:11, color:'var(--ink-muted)', margin:'2px 0 0' }}>InternX Academy — Official Document</p>
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderRadius:14, background: allDone ? '#f0fdf9' : '#fdfaf4', border:`1.5px solid ${allDone ? 'rgba(20,184,130,.2)' : 'rgba(245,158,11,.2)'}`, marginBottom:16 }}>
          <span style={{ fontSize:20, flexShrink:0 }}>{allDone ? '🎉' : '📝'}</span>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:12, fontWeight:600, color: allDone ? '#065f46' : '#78560a', margin:0, lineHeight:1.5 }}>
              {allDone
                ? 'All done! Your certificate is ready to download.'
                : totalTasks === 0
                  ? 'Your tasks will appear here once they\'ve been assigned.'
                  : `${done} of ${totalTasks} tasks completed — finish the rest to unlock your certificate`}
            </p>
            {!allDone && totalTasks > 0 && (
              <div style={{ marginTop:7, height:4, borderRadius:99, background:'rgba(245,158,11,.15)', overflow:'hidden' }}>
                <div style={{ height:'100%', borderRadius:99, background:'linear-gradient(90deg,#f59e0b,#fbbf24)', width:`${pctDone}%`, transition:'width .6s ease' }} />
              </div>
            )}
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(135px, 1fr))', gap:8 }}>
          {[
            { fmt:'svg',   icon:'📄', label:'SVG',   sub:'Vector · scalable',   color:'#7c6fff', bg:'#f0edff' },
            { fmt:'png',   icon:'🖼',  label:'PNG',   sub:'1800 × 1272 px',      color:'#3b82f6', bg:'#eff6ff' },
            { fmt:'pdf',   icon:'📑',  label:'PDF',   sub:'Opens print dialog',  color:'#f59e0b', bg:'#fffbeb' },
            { fmt:'print', icon:'🖨',  label:'Print', sub:'Print-ready preview', color:'#20d4a0', bg:'#f0fdf9' },
          ].map(opt => {
            const locked = !allDone && !loading
            return (
              <button key={opt.fmt} onClick={() => handleCert(opt.fmt)} disabled={loading || certState==='busy'}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 14px', borderRadius:14, border:`1.5px solid ${locked ? 'rgba(0,0,0,.06)' : opt.color+'22'}`, background: locked ? 'var(--surface-2)' : opt.bg, cursor: locked || certState==='busy' ? 'not-allowed' : 'pointer', textAlign:'left', transition:'all .18s', opacity: loading ? .5 : locked ? .55 : 1, filter: locked ? 'grayscale(40%)' : 'none' }}
                onMouseEnter={e => { if(!locked && certState!=='busy'){ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow=`0 6px 18px ${opt.color}22` } }}
                onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none' }}
              >
                <div style={{ width:34, height:34, borderRadius:10, background:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, flexShrink:0, boxShadow:`0 2px 8px ${opt.color}18` }}>
                  {certState==='busy' ? <span style={{ display:'inline-block', width:14, height:14, border:`2px solid ${opt.color}55`, borderTopColor:opt.color, borderRadius:'50%', animation:'spin .7s linear infinite' }} /> : locked ? '🔒' : opt.icon}
                </div>
                <div>
                  <p style={{ fontSize:13, fontWeight:700, color: locked ? 'var(--ink-muted)' : opt.color, margin:0 }}>{opt.label}</p>
                  <p style={{ fontSize:10, color:'var(--ink-muted)', margin:'1px 0 0' }}>{locked ? 'Finish tasks first' : opt.sub}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          ACCOUNT DETAILS
         ══════════════════════════════════════════════════ */}
      <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:24, padding:22 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
          <div style={{ width:32, height:32, borderRadius:10, background:'var(--surface-2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15 }}>⚙️</div>
          <h2 style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:15, color:'var(--ink)', margin:0 }}>Account details</h2>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:10 }}>
          {[
            { icon:'👤', label:'Display name', value:profile?.name, action:() => { setDraftName(profile?.name||''); setDraftBio(profile?.bio||''); setEditOpen(true) }, actionLabel:'✏ Edit' },
            { icon:'🏷', label:'Role',          value:rc.label },
            { icon:'✉', label:'Email',         value:profile?.email },
            { icon:'🐙', label:'GitHub',        value:profile?.github_username ? '@'+profile.github_username : '—' },
            { icon:'🟢', label:'Status',        value:'● Active intern', green:true },
            { icon:'📅', label:'Member since',  value:joined },
          ].map(row => (
            <div key={row.label}
              style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 16px', background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:14, transition:'all .15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='var(--border-strong)'; e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,.05)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.boxShadow='none' }}
            >
              <div style={{ width:32, height:32, borderRadius:9, background:'white', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0 }}>{row.icon}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontSize:10, fontWeight:700, color:'var(--ink-muted)', letterSpacing:'.06em', textTransform:'uppercase', margin:'0 0 2px' }}>{row.label}</p>
                {loading ? <Sk h={13} w={80} r={4} /> : <p style={{ fontSize:13, fontWeight:600, color: row.green ? 'var(--green)' : 'var(--ink)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', margin:0 }}>{row.value||'—'}</p>}
              </div>
              {row.action && !loading && (
                <button onClick={row.action}
                  style={{ background:'white', border:'1px solid var(--border)', borderRadius:8, fontSize:11, padding:'4px 10px', cursor:'pointer', color:'var(--ink-muted)', fontWeight:600, flexShrink:0, transition:'all .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background='var(--accent-soft)'; e.currentTarget.style.color='var(--accent)'; e.currentTarget.style.borderColor='rgba(124,111,255,.3)' }}
                  onMouseLeave={e => { e.currentTarget.style.background='white'; e.currentTarget.style.color='var(--ink-muted)'; e.currentTarget.style.borderColor='var(--border)' }}
                >{row.actionLabel}</button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          EDIT PROFILE MODAL
         ══════════════════════════════════════════════════ */}
      {editOpen && (
        <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={e => { if(e.target===e.currentTarget) setEditOpen(false) }}>
          <div style={{ position:'absolute', inset:0, background:'rgba(10,10,15,.45)', backdropFilter:'blur(7px)' }} onClick={() => setEditOpen(false)} />
          <div style={{ position:'relative', background:'white', borderRadius:24, width:'100%', maxWidth:460, boxShadow:'0 32px 80px rgba(0,0,0,.18)', animation:'modalUp .22s cubic-bezier(.22,1,.36,1)', overflow:'hidden' }}>
            <div style={{ padding:'24px 28px 28px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:22 }}>
                <div>
                  <h2 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:20, color:'var(--ink)', margin:0, letterSpacing:'-0.02em' }}>Edit profile</h2>
                  <p style={{ fontSize:12, color:'var(--ink-muted)', margin:'3px 0 0' }}>Update your display info</p>
                </div>
                <button onClick={() => setEditOpen(false)}
                  style={{ width:32, height:32, borderRadius:10, background:'var(--surface-2)', border:'1px solid var(--border)', cursor:'pointer', fontSize:14, color:'var(--ink-muted)', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background='var(--red-soft)'; e.currentTarget.style.color='var(--red)' }}
                  onMouseLeave={e => { e.currentTarget.style.background='var(--surface-2)'; e.currentTarget.style.color='var(--ink-muted)' }}
                >✕</button>
              </div>

              <div style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:16, marginBottom:20 }}>
                <div style={{ width:48, height:48, borderRadius:14, background:rc.gradient, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:18, color:'white', flexShrink:0 }}>
                  {(draftName||profile?.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <div>
                  <p style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:15, color:'var(--ink)', margin:0 }}>{draftName||'Your name'}</p>
                  <p style={{ fontSize:12, color:'var(--ink-muted)', margin:'2px 0 0' }}>{rc.icon} {rc.label} Intern</p>
                </div>
                <span style={{ marginLeft:'auto', fontSize:10, color:'var(--ink-muted)', background:'white', border:'1px solid var(--border)', borderRadius:7, padding:'3px 8px', fontWeight:600 }}>Preview</span>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--ink-muted)', marginBottom:8, letterSpacing:'.07em', textTransform:'uppercase' }}>Display Name</label>
                  <input autoFocus className="input-field" value={draftName} onChange={e => setDraftName(e.target.value)}
                    onKeyDown={e => { if(e.key==='Enter') saveProfile(); if(e.key==='Escape') setEditOpen(false) }}
                    placeholder="Your full name" style={{ fontSize:14 }} />
                </div>
                <div>
                  <label style={{ display:'flex', justifyContent:'space-between', fontSize:11, fontWeight:700, color:'var(--ink-muted)', marginBottom:8, letterSpacing:'.07em', textTransform:'uppercase' }}>
                    <span>Bio</span>
                    <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0 }}>Optional · {draftBio.length}/160</span>
                  </label>
                  <textarea className="input-field" rows={3} maxLength={160} value={draftBio} onChange={e => setDraftBio(e.target.value)}
                    placeholder="A short bio about yourself…" style={{ resize:'none', fontSize:14, lineHeight:1.6 }} />
                </div>
              </div>

              <div style={{ display:'flex', gap:10, marginTop:22 }}>
                <button className="btn-primary" onClick={saveProfile} disabled={saving||!draftName.trim()} style={{ flex:1, justifyContent:'center', opacity:(saving||!draftName.trim())?.6:1 }}>
                  {saving ? <><span style={{ display:'inline-block', width:13, height:13, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'white', borderRadius:'50%', animation:'spin .7s linear infinite' }} /> Saving…</> : 'Save changes'}
                </button>
                <button onClick={() => setEditOpen(false)} style={{ padding:'10px 18px', borderRadius:12, border:'1.5px solid var(--border)', background:'var(--surface-2)', color:'var(--ink-soft)', fontSize:14, fontWeight:600, cursor:'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes modalUp { from { opacity:0; transform: translateY(20px) scale(0.97); } to { opacity:1; transform:none; } }
        @keyframes pulse   { 0%,100% { box-shadow:0 0 0 0 rgba(77,255,212,.4); } 50% { box-shadow:0 0 0 4px rgba(77,255,212,0); } }
        @keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(14px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
      `}</style>
    </div>
  )
}
