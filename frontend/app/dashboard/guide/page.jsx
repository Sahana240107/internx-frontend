'use client'

import { useState, useEffect, useRef } from 'react'
import DashboardPanel from '@/components/team-hub/DashboardPanel'
import { useAuthStore } from '@/lib/store/authStore'
import api from '@/lib/api'

// ── Rules Modal ──────────────────────────────────────────────────────────────
function RulesModal({ onClose, companyColor = '#5b4fff' }) {
  const rules = [
    { icon: '🔒', title: 'No Direct Commits to Main', body: 'All code must go through a pull-request. Branch off `dev`, not `main`. Merges require at least one peer review approval.' },
    { icon: '🗂️', title: 'Follow the Folder Structure', body: 'Respect the folder layout defined in the SRS. Files created outside the specified structure will cause CI pipeline failures.' },
    { icon: '💬', title: 'Comment Your Code', body: 'Every function, component, or module must have a JSDoc / docstring header. Undocumented code will be rejected in review.' },
    { icon: '🚫', title: 'No Unapproved External Libraries', body: 'Adding a new npm/pip package requires team lead sign-off. Log the justification in the PR description.' },
    { icon: '🧪', title: 'Write Tests First (TDD)', body: 'Testers define test cases before devs implement features. No feature is "done" until it passes all agreed test cases.' },
    { icon: '📅', title: 'Daily Stand-up Updates', body: "Post your async update in the team channel by 9 AM — what you did, what you'll do, any blockers. Missing 3 = flagged." },
    { icon: '🤝', title: 'Respect Team Boundaries', body: 'Frontend devs do not modify backend routes and vice versa without coordination. Cross-boundary changes need explicit sign-off.' },
    { icon: '🔐', title: 'Never Expose Secrets', body: 'API keys, DB credentials, and tokens go in .env files only. Any committed secret will be immediately revoked and flagged.' },
  ]

  useEffect(() => {
    const h = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'transparent' }}
      onClick={onClose}>
      <div className="relative w-full max-w-2xl max-h-[82vh] overflow-y-auto rounded-3xl p-8 shadow-2xl"
        style={{ background: 'white', border: '1px solid rgba(255,255,255,0.7)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] mb-0.5 font-semibold" style={{ color: companyColor }}>
              Internship Programme
            </p>
            <h2 className="text-2xl font-bold text-gray-900">Rules &amp; Restrictions</h2>
          </div>
          <button onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-base font-bold transition-all hover:scale-110"
            style={{ background: 'rgba(0,0,0,0.06)', color: '#666' }}>✕</button>
        </div>
        <div className="space-y-3">
          {rules.map((r, i) => (
            <div key={i} className="flex gap-4 rounded-2xl p-4"
              style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.07)' }}>
              <span className="text-2xl mt-0.5 shrink-0">{r.icon}</span>
              <div>
                <p className="font-semibold mb-0.5 text-gray-800">{r.title}</p>
                <p className="text-sm leading-relaxed text-gray-500">{r.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <button onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: companyColor }}>
            Got it, let's build 🚀
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function TechPill({ label }) {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
      style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)', border: '1px solid var(--border)' }}>
      {label}
    </span>
  )
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-1"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      <p className="text-xs uppercase tracking-[0.15em]" style={{ color: 'var(--ink-muted)' }}>{label}</p>
      <p className="text-xl font-bold" style={{ color: accent ?? 'var(--ink)' }}>{value}</p>
      {sub && <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>{sub}</p>}
    </div>
  )
}

function FolderTree({ name, node, depth = 0 }) {
  const [open, setOpen] = useState(depth < 2)
  const isFile = node === null
  const isArray = Array.isArray(node)
  const indent = depth * 16

  if (isFile) return (
    <div className="flex items-center gap-2 py-0.5" style={{ paddingLeft: indent + 4 }}>
      <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--ink-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
      <span className="text-xs font-mono" style={{ color: 'var(--ink-soft)' }}>{name}</span>
    </div>
  )

  if (isArray) return (
    <div>{node.map(f => <FolderTree key={f} name={f} node={null} depth={depth} />)}</div>
  )

  return (
    <div>
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 py-0.5 w-full hover:opacity-80" style={{ paddingLeft: indent }}>
        <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>{open ? '▾' : '▸'}</span>
        <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#f59e0b' }} fill="currentColor" viewBox="0 0 24 24">
          <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
        </svg>
        <span className="text-xs font-mono font-semibold" style={{ color: 'var(--ink)' }}>{name}</span>
      </button>
      {open && (
        <div>
          {Object.entries(node).map(([k, v]) => <FolderTree key={k} name={k} node={v} depth={depth + 1} />)}
        </div>
      )}
    </div>
  )
}

// ── AI SRS Gist ───────────────────────────────────────────────────────────────
function SrsGist({ srsContent, accentColor }) {
  const [gist, setGist] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const calledRef = useRef(false)

  useEffect(() => {
    if (!srsContent || calledRef.current) return
    calledRef.current = true
    setLoading(true)

    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `You are a concise technical assistant. Read the following SRS document and produce a structured gist in this exact JSON format (no markdown, no code fences, raw JSON only):

{
  "summary": "2-3 sentence plain-English overview of what this project is and what it does",
  "goals": ["goal 1", "goal 2", "goal 3"],
  "key_features": ["feature 1", "feature 2", "feature 3", "feature 4"],
  "tech_highlights": ["tech/constraint 1", "tech/constraint 2"],
  "intern_focus": "1 sentence describing what interns specifically need to build or focus on"
}

SRS DOCUMENT:
${srsContent.slice(0, 8000)}`,
        }],
      }),
    })
      .then(r => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json() })
      .then(data => {
        const text = (data.content ?? []).filter(b => b.type === 'text').map(b => b.text).join('')
        const clean = text.replace(/```json|```/g, '').trim()
        setGist(JSON.parse(clean))
        setLoading(false)
      })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [srsContent])

  if (!srsContent) return null
  if (loading) return (
    <div className="rounded-2xl p-5 flex items-center gap-3 text-sm"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink-muted)' }}>
      <span className="animate-spin text-base">✨</span> Generating SRS summary…
    </div>
  )
  if (error || !gist) return null

  return (
    <div className="rounded-2xl p-5 space-y-4"
      style={{ background: `${accentColor}08`, border: `1px solid ${accentColor}25` }}>
      <div className="flex items-center gap-2">
        <span className="text-lg">✨</span>
        <p className="text-xs uppercase tracking-[0.18em] font-semibold" style={{ color: accentColor }}>AI SRS Summary</p>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{gist.summary}</p>
      {gist.intern_focus && (
        <div className="rounded-xl px-4 py-3 text-sm"
          style={{ background: `${accentColor}12`, color: 'var(--ink)', border: `1px solid ${accentColor}20` }}>
          🎓 <span className="font-medium">Your focus:</span> {gist.intern_focus}
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        {gist.goals?.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ink-muted)' }}>Goals</p>
            <ul className="space-y-1.5">
              {gist.goals.map((g, i) => (
                <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
                  <span className="mt-0.5 text-xs" style={{ color: accentColor }}>▸</span>{g}
                </li>
              ))}
            </ul>
          </div>
        )}
        {gist.key_features?.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ink-muted)' }}>Key Features</p>
            <ul className="space-y-1.5">
              {gist.key_features.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
                  <span className="mt-0.5 text-xs" style={{ color: accentColor }}>▸</span>{f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {gist.tech_highlights?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {gist.tech_highlights.map((t, i) => (
            <span key={i} className="text-xs px-3 py-1 rounded-full font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)', border: '1px solid var(--border)' }}>
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Download helpers ──────────────────────────────────────────────────────────
function downloadBlob(content, filename, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

async function downloadFromUrl(url, filename) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl; a.download = filename; a.click()
    URL.revokeObjectURL(objectUrl)
  } catch {
    // fallback: open in new tab
    window.open(url, '_blank')
  }
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function GuidePage() {
  const [showRules, setShowRules] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [srsLoading, setSrsLoading] = useState(false)
  const [srsContent, setSrsContent] = useState(null)
  const [srsError, setSrsError] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [project, setProject] = useState(null)
  const [projectLoading, setProjectLoading] = useState(true)
  const [projectError, setProjectError] = useState(null)

  // ── Fetch current user's project via /api/auth/me → /api/projects/:id ──────
  const { user } = useAuthStore()

  useEffect(() => {
    async function loadProject() {
      try {
        const meRes = await api.get('/api/auth/me')
        const me = meRes.data
        if (!me.project_id) throw new Error('No project assigned to your profile yet.')

        const projRes = await api.get(`/api/projects/${me.project_id}`)
        setProject(projRes.data)
      } catch (err) {
        setProjectError(err?.response?.data?.detail || err.message)
      } finally {
        setProjectLoading(false)
      }
    }
    if (user) {
      loadProject()
    } else {
      setProjectError('Not authenticated — please log in.')
      setProjectLoading(false)
    }
  }, [user])

  const p = project

  useEffect(() => {
    if (!p) return
    if (activeTab !== 'srs') return
    if (srsContent || srsError || srsLoading) return
    if (p.project_doc) { setSrsContent(p.project_doc); return }
    if (!p.project_doc_url) return
    setSrsLoading(true)
    fetch(p.project_doc_url)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text() })
      .then(text => { setSrsContent(text); setSrsLoading(false) })
      .catch(err => { setSrsError(err.message); setSrsLoading(false) })
  }, [activeTab, p])

  const accentColor = p?.company_color ?? '#5b4fff'
  const diffColor = { beginner: '#22c55e', intermediate: '#f59e0b', advanced: '#ef4444' }[p?.difficulty] ?? accentColor

  const srsFilename = p?.project_doc_url
    ? (p.project_doc_url.split('/').pop() || 'srs.txt')
    : `${(p?.project_title ?? 'srs').replace(/\s+/g, '-').toLowerCase()}-srs.txt`

  const handleDownload = async () => {
    if (downloading) return
    setDownloading(true)
    if (srsContent) {
      downloadBlob(srsContent, srsFilename)
    } else if (p?.project_doc_url) {
      await downloadFromUrl(p.project_doc_url, srsFilename)
    }
    setDownloading(false)
  }

  const tabs = [
    { id: 'overview', label: '📋 Overview' },
    { id: 'srs', label: '📄 SRS' },
    { id: 'structure', label: '🗂️ Structure' },
    { id: 'setup', label: '🔌 Setup' },
  ]

  // ── Loading state ──
  if (projectLoading) {
    return (
      <div className="flex items-center justify-center py-24 gap-3" style={{ color: 'var(--ink-muted)' }}>
        <span className="animate-spin text-xl">⏳</span>
        <span className="text-sm">Loading your project…</span>
      </div>
    )
  }

  // ── Error / no project state ──
  if (projectError || !p) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <p className="text-3xl mb-3">📭</p>
        <p className="font-semibold mb-1" style={{ color: 'var(--ink)' }}>No project assigned</p>
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>{projectError ?? 'You have not been assigned to a project yet. Check back soon.'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-up">
      {showRules && <RulesModal onClose={() => setShowRules(false)} companyColor={accentColor} />}

      {/* ── Hero ── */}
      <div className="rounded-3xl p-7 relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${accentColor}18 0%, ${accentColor}05 100%)`, border: `1px solid ${accentColor}30` }}>
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-10 pointer-events-none"
          style={{ background: accentColor, filter: 'blur(56px)' }} />
        <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
          <div className="flex items-center gap-4">
            <span className="text-4xl">{p.company_emoji ?? '🏢'}</span>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] mb-0.5 font-semibold" style={{ color: accentColor }}>
                {p.company_name}
              </p>
              <h1 className="text-2xl font-bold leading-tight" style={{ color: 'var(--ink)' }}>{p.project_title}</h1>
              {p.company_tagline && (
                <p className="text-sm mt-0.5" style={{ color: 'var(--ink-muted)' }}>{p.company_tagline}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            {p.project_doc_url && (
              <button onClick={handleDownload} disabled={downloading}
                className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all hover:opacity-90 text-white"
                style={{ background: downloading ? '#888' : '#8b7fff' }}>
                {downloading ? '⏳ Downloading…' : '⬇ Download SRS'}
              </button>
            )}
            {p.meet_url && (
              <a href={p.meet_url} target="_blank" rel="noreferrer"
                className="px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all hover:opacity-80"
                style={{ background: 'var(--surface-2)', color: 'var(--ink)', border: '1px solid var(--border)' }}>
                🎥 Join Meet
              </a>
            )}
            <button onClick={() => setShowRules(true)}
              className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all hover:opacity-90 text-white"
              style={{ background: accentColor }}>
               Rules &amp; Restrictions
            </button>
          </div>
        </div>
        <div className="relative mt-5 flex flex-wrap gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: `${diffColor}20`, color: diffColor }}>
            {p.difficulty?.charAt(0).toUpperCase() + p.difficulty?.slice(1)}
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>
            ⏱ {p.duration_weeks} weeks
          </span>
          {p.intern_role && (
            <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>
              🎓 {p.intern_role}
            </span>
          )}
          {p.repo_url && (
            <a href={p.repo_url} target="_blank" rel="noreferrer"
              className="px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 hover:opacity-80 transition-opacity"
              style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>
              🔗 Repo
            </a>
          )}
          <span className="px-3 py-1 rounded-full text-xs font-semibold"
            style={{ background: p.status === 'active' ? '#00c89615' : 'var(--surface-2)', color: p.status === 'active' ? '#00c896' : 'var(--ink-muted)' }}>
            {p.status === 'active' ? '🟢 Active' : p.status}
          </span>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="rounded-2xl p-1.5 flex gap-1 w-fit"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={activeTab === t.id
              ? { background: 'var(--surface-1)', color: 'var(--ink)', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }
              : { color: 'var(--ink-muted)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {activeTab === 'overview' && (
        <div className="space-y-5 animate-fade-up">
          <DashboardPanel title="Project Description" description="Understand the goal before you write a single line of code.">
            <div className="rounded-2xl p-5" style={{ background: `${accentColor}08`, border: `1px solid ${accentColor}20` }}>
              <p className="text-sm leading-8 tracking-wide" style={{ color: 'var(--ink)', lineHeight: '1.85' }}>{p.project_description}</p>
            </div>
          </DashboardPanel>
          <DashboardPanel title="Project At a Glance">
            <div className="grid sm:grid-cols-3 gap-4">
              <StatCard label="Duration" value={`${p.duration_weeks} wks`} accent={accentColor} />
              <StatCard label="Difficulty" value={p.difficulty?.charAt(0).toUpperCase() + p.difficulty?.slice(1)} accent={diffColor} />
              <StatCard label="Status" value={p.status?.charAt(0).toUpperCase() + p.status?.slice(1)}
                accent={p.status === 'active' ? '#8b7fff' : undefined} />
            </div>
          </DashboardPanel>
          <DashboardPanel title="Tech Stack" description="Technologies every team member must be familiar with.">
            <div className="flex flex-wrap gap-2">
              {(p.tech_stack ?? []).map(t => <TechPill key={t} label={t} />)}
            </div>
          </DashboardPanel>
        </div>
      )}

      {/* ── SRS ── */}
      {activeTab === 'srs' && (
        <div className="space-y-5 animate-fade-up">
          <DashboardPanel
            title="Software Requirements Specification"
            description="The single source of truth for all implementation decisions.">

            {srsLoading && (
              <div className="flex items-center gap-3 py-10 justify-center" style={{ color: 'var(--ink-muted)' }}>
                <span className="animate-spin text-xl">⏳</span>
                <span className="text-sm">Loading SRS document…</span>
              </div>
            )}

            {srsError && (
              <div className="rounded-2xl p-4 text-sm" style={{ background: '#ef444410', color: '#ef4444', border: '1px solid #ef444428' }}>
                <p className="font-semibold mb-1">Failed to load SRS document</p>
                <p className="opacity-70 text-xs">{srsError}</p>
                {p.project_doc_url && (
                  <a href={p.project_doc_url} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 mt-3 underline text-xs">Open directly ↗</a>
                )}
              </div>
            )}

            {!srsLoading && !srsError && srsContent && (
              <>
                <SrsGist srsContent={srsContent} accentColor={accentColor} />
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                  <p className="text-xs uppercase tracking-[0.15em] font-semibold mb-3" style={{ color: 'var(--ink-muted)' }}>
                    Full SRS Document
                  </p>
                  <div className="rounded-2xl p-6 text-sm leading-7 whitespace-pre-wrap overflow-x-auto"
                    style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)', border: '1px solid var(--border)', maxHeight: 500, overflowY: 'auto' }}>
                    {srsContent.replace(/^#{1,6}\s+/gm, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/`{1,3}([^`]*)`{1,3}/g, '$1').replace(/^>\s+/gm, '').replace(/^[-*]\s+/gm, '• ').replace(/_{1,2}(.+?)_{1,2}/g, '$1').trim()}
                  </div>
                </div>
              </>
            )}

            {!srsLoading && !srsError && !srsContent && !p.project_doc && !p.project_doc_url && (
              <p className="text-sm py-8 text-center" style={{ color: 'var(--ink-muted)' }}>
                No SRS document has been attached to this project yet.
              </p>
            )}

            {/* Action row */}
            {!srsLoading && (p.project_doc_url || srsContent) && (
              <div className="mt-5 flex items-center justify-between flex-wrap gap-3">
                <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
                  {p.project_doc_url ? `Source: ${p.project_doc_url.slice(0, 60)}…` : 'Document loaded from project record'}
                </p>
                <div className="flex items-center gap-3">
                  <button onClick={handleDownload} disabled={downloading}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-90 text-white"
                    style={{ background: downloading ? '#888' : '#8b7fff' }}>
                    {downloading ? '⏳ Downloading…' : '⬇ Download SRS'}
                  </button>
                </div>
              </div>
            )}
          </DashboardPanel>
        </div>
      )}

      {/* ── Structure ── */}
      {activeTab === 'structure' && (
        <DashboardPanel title="Folder Structure" description="Required repo layout. Deviate and CI will reject your PR.">
          {p.folder_structure && Object.keys(p.folder_structure).length > 0 ? (
            <div className="rounded-2xl p-4 select-none"
              style={{ background: '#f5f7f9', border: '1px solid #30363d' }}>
              {Object.entries(p.folder_structure).map(([k, v]) => (
                <FolderTree key={k} name={k} node={v} depth={0} />
              ))}
            </div>
          ) : (
            <p className="text-sm py-4 text-center" style={{ color: 'var(--ink-muted)' }}>
              No folder structure defined for this project.
            </p>
          )}
        </DashboardPanel>
      )}

      {/* ── Setup ── */}
      {activeTab === 'setup' && (
        <SetupTab p={p} accentColor={accentColor} />
      )}
    </div>
  )
}

// ── Setup Tab ─────────────────────────────────────────────────────────────────
function SetupTab({ p, accentColor }) {
  const [activeStep, setActiveStep] = useState(0)
  const [copied, setCopied] = useState(false)
  const [repoCopied, setRepoCopied] = useState(false)
  const [vsCodeConnecting, setVsCodeConnecting] = useState(false)
  const [vsCodeConnected, setVsCodeConnected] = useState(false)
  const [vsCodeError, setVsCodeError] = useState(null)
  const [showOpenPrompt, setShowOpenPrompt] = useState(false)

  const steps = [
    {
      number: '01',
      title: 'Install InternX CLI',
      description: 'Open your terminal and install the InternX CLI globally. This registers the internx:// deep-link protocol on your OS.',
      code: 'npm install -g internx-cli',
      tip: 'Only needed once per machine. Requires Node.js 18+.',
    },
    {
      number: '02',
      title: 'Create a GitHub Token',
      description: 'Go to github.com → Settings → Developer settings → Personal access tokens → Tokens (classic). Select the "repo" scope, generate the token, and copy it.',
      code: null,
      tip: 'The token starts with ghp_. Save it — GitHub only shows it once.',
    },
    {
      number: '03',
      title: 'Save your GitHub Token',
      description: 'Run this command with your token:',
      code: 'internx login --token ghp_your_token_here',
      tip: 'Your token is stored locally. InternX uses it to clone repos and push branches on your behalf.',
    },
    {
      number: '04',
      title: 'Click "Connect VS Code"',
      description: 'Click the Connect VS Code button below. Your browser will ask permission to open InternX — click Open or Allow.',
      code: null,
      tip: 'Watch for a small popup near the address bar. It may appear briefly.',
    },
    {
      number: '05',
      title: 'VS Code opens automatically',
      description: 'InternX clones the team repo, creates your personal branch (username-role-dev), scaffolds the folder structure, and opens VS Code.',
      code: null,
      tip: 'This may take 10–20 seconds the first time while the repo clones.',
    },
    {
      number: '06',
      title: 'Submit your work',
      description: 'When done coding, run this in the VS Code terminal:',
      code: 'internx pr --message "What I built"',
      tip: 'No git commands needed — internx pr handles add, commit, push, and opens a PR against main.',
    },
  ]

  const step = steps[activeStep]

  const internRepoUrl = p?.internx_repo_url || null
  const repoForConnect = internRepoUrl || p?.user_repo_url || p?.repo_url
  const repoUrl = repoForConnect
  const hasRepo = Boolean(repoUrl)

  const handleVsCodeConnect = async () => {
    if (!repoForConnect) return
    setVsCodeConnecting(true); setVsCodeError(null); setShowOpenPrompt(false)
    try {
      const r = await api.post(`/api/projects/${p?.id}/setup-token`)
      const a = document.createElement("a"); a.href = r.data.setup_url; a.click()
      setTimeout(() => { setVsCodeConnecting(false); setShowOpenPrompt(true) }, 2500)
    } catch (err) {
      setVsCodeError(err?.response?.data?.detail || "Failed to connect. Make sure internx-cli is installed.")
      setVsCodeConnecting(false)
    }
  }

  return (
    <div className="space-y-5 animate-fade-up">

      {/* ── Team Repo Banner ── */}
      {hasRepo ? (
        <div className="rounded-2xl p-5"
          style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '1.5px solid #86efac' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: '#16a34a' }} />
              <span className="text-sm font-bold" style={{ color: '#14532d' }}>Team Repo · Ready</span>
            </div>
            <a href={repoUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs font-semibold px-3 py-1.5 rounded-xl hover:opacity-80 transition-opacity"
              style={{ background: '#16a34a', color: 'white' }}>
              Open on GitHub ↗
            </a>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl font-mono text-xs truncate"
              style={{ background: 'white', border: '1px solid #86efac', color: '#166534' }}>
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span className="truncate">{repoUrl.replace('https://github.com/', '')}</span>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(repoUrl); setRepoCopied(true); setTimeout(() => setRepoCopied(false), 1500) }}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80 flex items-center gap-1.5"
              style={{ background: 'white', border: '1px solid #86efac', color: '#166534' }}>
              {repoCopied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-5"
          style={{ background: '#fffbeb', border: '1.5px solid #fde68a' }}>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#f59e0b' }} />
            <span className="text-sm font-bold" style={{ color: '#92400e' }}>Team Repo · Pending</span>
          </div>
          <p className="text-xs" style={{ color: '#a16207' }}>
            The shared GitHub repo will be created automatically once all team slots are filled.
          </p>
        </div>
      )}

      {/* ── VS Code Setup Steps ── */}
      <DashboardPanel title="VS Code Setup Guide" description="One-time setup · ~5 minutes">
        {/* Step tabs */}
        <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1">
          {steps.map((s, i) => (
            <button key={i} onClick={() => setActiveStep(i)}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: activeStep === i ? '#24292e' : 'var(--surface-2)',
                color: activeStep === i ? 'white' : 'var(--ink-muted)',
              }}>
              {s.number}
            </button>
          ))}
        </div>

        {/* Step content */}
        <div className="rounded-2xl p-5 space-y-4"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-xs text-white"
              style={{ background: '#24292e' }}>
              {step.number}
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--ink)' }}>{step.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{step.description}</p>
            </div>
          </div>

          {step.code && (
            <div className="flex items-center gap-3 rounded-xl px-4 py-3 font-mono text-xs"
              style={{ background: '#0d1117', border: '1px solid #30363d' }}>
              <span style={{ color: '#8b949e' }}>$</span>
              <span style={{ color: '#58a6ff', flex: 1 }}>{step.code}</span>
              <button
                onClick={() => { navigator.clipboard.writeText(step.code); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                className="flex-shrink-0 transition-opacity hover:opacity-100 opacity-60">
                {copied
                  ? <svg className="w-4 h-4" style={{ color: '#3fb950' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  : <svg className="w-4 h-4" style={{ color: '#8b949e' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>
                }
              </button>
            </div>
          )}

          <div className="flex items-start gap-2.5 rounded-xl px-4 py-3"
            style={{ background: `${accentColor}10`, border: `1px solid ${accentColor}20` }}>
            <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: accentColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
            </svg>
            <p className="text-xs leading-relaxed" style={{ color: accentColor }}>{step.tip}</p>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4">
          <button onClick={() => setActiveStep(i => Math.max(0, i - 1))} disabled={activeStep === 0}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-30"
            style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}>
            ← Back
          </button>
          <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
            Step {activeStep + 1} of {steps.length}
          </span>
          {activeStep < steps.length - 1
            ? <button onClick={() => setActiveStep(i => i + 1)}
                className="px-4 py-2 rounded-lg text-xs font-semibold hover:opacity-80"
                style={{ background: '#24292e', color: 'white' }}>
                Next →
              </button>
            : <button onClick={() => setActiveStep(0)}
                className="px-4 py-2 rounded-lg text-xs font-semibold hover:opacity-80"
                style={{ background: '#16a34a', color: 'white' }}>
                ✓ Done!
              </button>
          }
        </div>
      </DashboardPanel>

      {/* ── Connect VS Code CTA ── */}
      <DashboardPanel title="Connect VS Code">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1.5 text-xs" style={{ color: 'var(--ink-soft)' }}>
            {['Repo cloned automatically', 'Your role branch created', 'Folder structure scaffolded', 'Submit PRs with internx pr'].map(f => (
              <div key={f} className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--green)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                {f}
              </div>
            ))}
          </div>
          <div className="flex flex-col items-end gap-2">
            {vsCodeConnected ? (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: '#dcfce7', color: '#16a34a', border: '1px solid #bbf7d0' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                VS Code Connected
              </div>
            ) : (
              <button onClick={handleVsCodeConnect}
                disabled={vsCodeConnecting || !repoForConnect}
                title={!repoForConnect ? 'Waiting for team repo or add your own repo URL' : ''}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed"
                style={{ background: '#24292e', color: 'white', opacity: vsCodeConnecting || !repoForConnect ? 0.5 : 1 }}>
                {vsCodeConnecting ? (
                  <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Connecting...</>
                ) : (
                  <><svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M23.15 2.587L18.21.21a1.494 1.494 0 00-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 00-1.276.057L.327 7.261A1 1 0 00.326 8.74L3.899 12 .326 15.26a1 1 0 00.001 1.479L1.65 17.94a.999.999 0 001.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 001.704.29l4.942-2.377A1.5 1.5 0 0024 19.86V4.14a1.5 1.5 0 00-.85-1.553zm-5.146 14.861L10.826 12l7.178-5.448v10.896z" /></svg>Connect VS Code</>
                )}
              </button>
            )}
            {!repoForConnect && !vsCodeConnected && (
              <p className="text-xs" style={{ color: '#b45309' }}>⚠ Repo ready when team is complete</p>
            )}
          </div>
        </div>

        {showOpenPrompt && !vsCodeConnected && (
          <div className="mt-4 p-4 rounded-2xl animate-fade-up" style={{ background: '#fef9c3', border: '1px solid #fde68a' }}>
            <p className="text-sm font-semibold mb-1" style={{ color: '#92400e' }}>👀 Did VS Code open?</p>
            <div className="flex gap-2">
              <button onClick={() => { setVsCodeConnected(true); setShowOpenPrompt(false) }} className="px-4 py-1.5 rounded-lg text-xs font-semibold" style={{ background: '#dcfce7', color: '#16a34a' }}>✓ Yes, it opened</button>
              <button onClick={() => { setShowOpenPrompt(false); handleVsCodeConnect() }} className="px-4 py-1.5 rounded-lg text-xs font-semibold" style={{ background: '#fee2e2', color: '#dc2626' }}>✗ No — try again</button>
            </div>
          </div>
        )}
        {vsCodeError && (
          <div className="mt-4 p-4 rounded-2xl" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
            <p className="text-sm font-semibold" style={{ color: '#dc2626' }}>⚠️ {vsCodeError}</p>
          </div>
        )}
      </DashboardPanel>

    </div>
  )
}