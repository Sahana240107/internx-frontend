'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store/authStore'
import api from '@/lib/api'
import Link from 'next/link'

// ─── Role config ──────────────────────────────────────────────────────────────
const ROLE_CONFIG = {
  frontend:  { label: 'Frontend',   color: '#5b4fff', bg: '#ede9ff',  icon: '⚡' },
  backend:   { label: 'Backend',    color: '#3b82f6', bg: '#eff6ff',  icon: '⚙️' },
  fullstack: { label: 'Full Stack', color: '#f59e0b', bg: '#fffbeb',  icon: '🔥' },
  devops:    { label: 'DevOps',     color: '#00c896', bg: '#e0fff7',  icon: '🚀' },
  design:    { label: 'Design',     color: '#ec4899', bg: '#fdf2f8',  icon: '✦'  },
  tester:    { label: 'QA/Tester',  color: '#8b5cf6', bg: '#f5f3ff',  icon: '🧪' },
}

// ─── Folder tree (unchanged from original) ───────────────────────────────────
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

// ─── Setup guide modal (unchanged from original) ─────────────────────────────
function SetupGuideModal({ onClose }) {
  const steps = [
    { number: '01', title: 'Install InternX CLI', description: 'Open your terminal and install the InternX CLI globally. This registers the internx:// deep-link protocol on your OS.', code: 'npm install -g internx-cli', tip: 'Only needed once per machine. Requires Node.js 18+.' },
    { number: '02', title: 'Create a GitHub Token', description: 'Go to github.com → Settings → Developer settings → Personal access tokens → Tokens (classic). Select the "repo" scope, generate the token, and copy it.', code: null, tip: "The token starts with ghp_. Save it — GitHub only shows it once." },
    { number: '03', title: 'Save your GitHub Token', description: 'Run this command with your token:', code: 'internx login --token ghp_your_token_here', tip: 'Your token is stored locally. InternX uses it to clone repos and push branches on your behalf.' },
    { number: '04', title: 'Click "Connect VS Code"', description: 'Click the Connect VS Code button on your project page. Your browser will ask permission to open InternX — click Open or Allow.', code: null, tip: 'Watch for a small popup near the address bar. It may appear briefly.' },
    { number: '05', title: 'VS Code opens automatically', description: 'InternX clones the team repo, creates your personal branch (username-role-dev), scaffolds the folder structure, and opens VS Code.', code: null, tip: 'This may take 10–20 seconds the first time while the repo clones.' },
    { number: '06', title: 'Submit your work', description: 'When done coding, run this in the VS Code terminal:', code: 'internx pr --message "What I built"', tip: 'No git commands needed — internx pr handles add, commit, push, and opens a PR against main.' },
  ]
  const [activeStep, setActiveStep] = useState(0)
  const [copied, setCopied] = useState(false)
  const step = steps[activeStep]

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="relative w-full max-w-lg rounded-2xl animate-fade-up"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="font-display font-bold text-base" style={{ color: 'var(--ink)' }}>VS Code Setup Guide</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted)' }}>One-time setup · ~5 minutes</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-70" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex gap-1.5 px-6 py-3 overflow-x-auto" style={{ borderBottom: '1px solid var(--border)' }}>
          {steps.map((s, i) => (
            <button key={i} onClick={() => setActiveStep(i)}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: activeStep === i ? '#24292e' : 'var(--surface-2)', color: activeStep === i ? 'white' : 'var(--ink-muted)' }}>
              {s.number}
            </button>
          ))}
        </div>
        <div className="px-6 py-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-display font-black text-xs text-white" style={{ background: '#24292e' }}>{step.number}</div>
            <div>
              <h3 className="font-display font-bold text-sm mb-1" style={{ color: 'var(--ink)' }}>{step.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{step.description}</p>
            </div>
          </div>
          {step.code && (
            <div className="flex items-center gap-3 rounded-xl px-4 py-3 mb-4 font-mono text-xs" style={{ background: '#0d1117', border: '1px solid #30363d' }}>
              <span style={{ color: '#8b949e' }}>$</span>
              <span style={{ color: '#58a6ff', flex: 1 }}>{step.code}</span>
              <button onClick={() => { navigator.clipboard.writeText(step.code); setCopied(true); setTimeout(() => setCopied(false), 1500) }} className="flex-shrink-0 transition-opacity hover:opacity-100 opacity-60">
                {copied ? <svg className="w-4 h-4" style={{ color: '#3fb950' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  : <svg className="w-4 h-4" style={{ color: '#8b949e' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>
                }
              </button>
            </div>
          )}
          <div className="flex items-start gap-2.5 rounded-xl px-4 py-3" style={{ background: 'var(--accent-soft)' }}>
            <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" /></svg>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--accent)' }}>{step.tip}</p>
          </div>
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <button onClick={() => setActiveStep(i => Math.max(0, i - 1))} disabled={activeStep === 0}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-30"
            style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}>← Back</button>
          <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>Step {activeStep + 1} of {steps.length}</span>
          {activeStep < steps.length - 1
            ? <button onClick={() => setActiveStep(i => i + 1)} className="px-4 py-2 rounded-lg text-xs font-semibold hover:opacity-80" style={{ background: '#24292e', color: 'white' }}>Next →</button>
            : <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold hover:opacity-80" style={{ background: '#16a34a', color: 'white' }}>✓ Got it!</button>
          }
        </div>
      </div>
    </div>
  , document.body)
}

// ─── Lobby: no project yet ───────────────────────────────────────────────────
function ProjectLobby({ internRole, onJoin, joining, alreadyAssigned }) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const role = ROLE_CONFIG[internRole] || { label: internRole, color: '#5b4fff', bg: '#ede9ff', icon: '🎯' }

  useEffect(() => {
    // Don't fetch if already assigned — show locked state
    if (alreadyAssigned) { setLoading(false); return }
    api.get('/api/projects/available')
      .then(r => setProjects(r.data || []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false))
  }, [alreadyAssigned])

  // Locked state — user already has a project (shouldn't normally reach here)
  if (alreadyAssigned) return (
    <div className="animate-fade-up text-center py-32">
      <div className="text-4xl mb-4">🔒</div>
      <h2 className="font-display font-bold text-2xl mb-2" style={{ color: 'var(--ink)' }}>
        You're already in a project
      </h2>
      <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
        Complete your current project before joining a new one.
      </p>
    </div>
  )

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 rounded-full border-2 animate-spin"
        style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold"
            style={{ background: role.bg, color: role.color, border: `1px solid ${role.color}30` }}>
            <span>{role.icon}</span>
            {role.label} Intern
          </div>
          <span className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            → {projects.length} project{projects.length !== 1 ? 's' : ''} with open slots for you
          </span>
        </div>
        <h1 className="text-4xl font-display mb-2" style={{ color: 'var(--ink)' }}>
          Find your team
        </h1>
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          Join a project that needs a {role.label.toLowerCase()} intern.
          When all roles are filled, a shared GitHub repo is created automatically.
        </p>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-3 gap-4 mb-8 p-5 rounded-2xl"
        style={{ background: 'linear-gradient(135deg, #f8f7ff, #fff)', border: '1px solid var(--border)' }}>
        {[
          { step: '01', title: 'Pick a project', desc: 'Join one that needs your role' },
          { step: '02', title: 'Team assembles', desc: 'Other interns fill remaining slots' },
          { step: '03', title: 'Repo is created', desc: 'GitHub repo auto-created for the team' },
        ].map(({ step, title, desc }) => (
          <div key={step} className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white flex-shrink-0"
              style={{ background: 'var(--accent)' }}>{step}</div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{title}</p>
              <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Project cards */}
      {projects.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="text-4xl mb-3">😢</div>
          <h3 className="font-display font-bold mb-2" style={{ color: 'var(--ink)' }}>No open slots right now</h3>
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            All projects with a {role.label.toLowerCase()} slot are full. Check back soon!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {projects.map((project, i) => (
            <ProjectCard
              key={project.id}
              project={project}
              userRole={internRole}
              onJoin={() => onJoin(project.id)}
              joining={joining === project.id}
              index={i}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ProjectCard({ project, userRole, onJoin, joining, index }) {
  const teamRoles = project.team_roles || (project.intern_role ? { [project.intern_role]: 1 } : {})
  const isMultiplayer = Object.keys(teamRoles).length > 1
  const openSlots = project.open_slots_for_role || 1

  return (
    <div className="card p-6 flex flex-col gap-4 hover:shadow-lg transition-all duration-200 animate-fade-up"
      style={{ animationDelay: `${index * 0.08}s`, borderLeft: `3px solid ${project.company_color || '#5b4fff'}` }}>
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
          style={{ background: `${project.company_color || '#5b4fff'}15`, border: `1.5px solid ${project.company_color || '#5b4fff'}25` }}>
          {project.company_emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold" style={{ color: project.company_color || '#5b4fff' }}>{project.company_name}</span>
            {isMultiplayer && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                style={{ background: '#f0fdf4', color: '#16a34a' }}>TEAM</span>
            )}
          </div>
          <h3 className="font-display font-bold text-base leading-tight" style={{ color: 'var(--ink)' }}>
            {project.project_title}
          </h3>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="text-xs font-semibold" style={{ color: project.difficulty === 'advanced' ? '#dc2626' : '#b45309' }}>
            {project.difficulty === 'advanced' ? '🔥' : '⚡'} {project.difficulty}
          </div>
          <div className="text-xs" style={{ color: 'var(--ink-muted)' }}>{project.duration_weeks}w</div>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--ink-soft)' }}>
        {project.project_description}
      </p>

      {/* Tech stack */}
      <div className="flex flex-wrap gap-1.5">
        {(project.tech_stack || []).slice(0, 4).map((tech, i) => (
          <span key={tech} className="text-xs px-2 py-0.5 rounded-md font-medium"
            style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)' }}>{tech}</span>
        ))}
        {(project.tech_stack || []).length > 4 && (
          <span className="text-xs px-2 py-0.5 rounded-md" style={{ color: 'var(--ink-muted)' }}>
            +{(project.tech_stack || []).length - 4}
          </span>
        )}
      </div>

      {/* Team slots */}
      {isMultiplayer && (
        <div>
          <div className="text-xs font-semibold mb-2" style={{ color: 'var(--ink-muted)' }}>TEAM SLOTS</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(teamRoles).map(([role, total]) => {
              const rc = ROLE_CONFIG[role] || { label: role, color: '#8888a0', bg: '#f0f0f4', icon: '?' }
              const isMyRole = role === userRole
              return (
                <div key={role} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                  style={{
                    background: isMyRole ? rc.bg : 'var(--surface-2)',
                    color: isMyRole ? rc.color : 'var(--ink-muted)',
                    border: isMyRole ? `1.5px solid ${rc.color}40` : '1.5px solid var(--border)',
                  }}>
                  <span>{rc.icon}</span>
                  <span>{rc.label}</span>
                  {isMyRole && <span className="font-bold">← you</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="text-xs" style={{ color: 'var(--ink-muted)' }}>
          {openSlots === 1 ? (
            <span className="font-semibold" style={{ color: '#dc2626' }}>⚡ Last spot!</span>
          ) : (
            <span>{openSlots} {userRole} slot{openSlots !== 1 ? 's' : ''} open</span>
          )}
        </div>
        <button
          onClick={onJoin}
          disabled={joining}
          className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-60"
          style={{ background: project.company_color || 'var(--accent)', color: 'white' }}
        >
          {joining ? (
            <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Joining...</>
          ) : (
            <>Join Project →</>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Team forming banner ─────────────────────────────────────────────────────
function TeamFormingBanner({ project, teamData }) {
  if (!teamData) return null
  const totalSlots = (teamData.slots || []).reduce((a, s) => a + s.total_slots, 0)
  const filledSlots = (teamData.slots || []).reduce((a, s) => a + s.filled_slots, 0)
  const progress = totalSlots > 0 ? (filledSlots / totalSlots) * 100 : 0

  return (
    <div className="mb-6 p-5 rounded-2xl animate-fade-up"
      style={{ background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', border: '1.5px solid #fde68a' }}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#f59e0b' }} />
            <span className="text-sm font-bold" style={{ color: '#92400e' }}>Team Forming</span>
          </div>
          <p className="text-xs" style={{ color: '#a16207' }}>
            {filledSlots}/{totalSlots} members joined · GitHub repo will be created when team is complete
          </p>
        </div>
        <Link href="/internship/team"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold hover:opacity-80 transition-opacity"
          style={{ background: '#f59e0b', color: 'white' }}>
          View Team →
        </Link>
      </div>
      {/* Slots */}
      <div className="flex flex-wrap gap-2 mb-3">
        {(teamData.slots || []).map(slot => {
          const rc = ROLE_CONFIG[slot.role] || { label: slot.role, color: '#8888a0', bg: '#f0f0f4', icon: '?' }
          return Array.from({ length: slot.total_slots }).map((_, idx) => {
            const member = slot.members[idx]
            return (
              <div key={`${slot.role}-${idx}`}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
                style={{
                  background: member ? rc.bg : 'rgba(255,255,255,0.6)',
                  color: member ? rc.color : '#a16207',
                  border: member ? `1.5px solid ${rc.color}40` : '1.5px dashed #fde68a',
                }}>
                {member ? (
                  <><span>{rc.icon}</span><span>{member.name.split(' ')[0]}</span></>
                ) : (
                  <><span className="opacity-50">{rc.icon}</span><span>Waiting for {rc.label}...</span></>
                )}
              </div>
            )
          })
        })}
      </div>
      {/* Progress bar */}
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#fde68a' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${progress}%`, background: '#f59e0b' }} />
      </div>
    </div>
  )
}

// ─── Active team banner ───────────────────────────────────────────────────────
function ActiveTeamBanner({ repoUrl, team }) {
  const [copied, setCopied] = useState(false)

  if (!repoUrl) return null

  return (
    <div className="mb-6 p-5 rounded-2xl animate-fade-up"
      style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '1.5px solid #86efac' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: '#16a34a' }} />
          <span className="text-sm font-bold" style={{ color: '#14532d' }}>Team Active · GitHub Repo Ready</span>
        </div>
        <Link href="/internship/team"
          className="text-xs font-semibold px-3 py-1.5 rounded-xl hover:opacity-80"
          style={{ background: '#16a34a', color: 'white' }}>
          View Team →
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl font-mono text-xs truncate"
          style={{ background: 'white', border: '1px solid #86efac', color: '#166534' }}>
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          <span className="truncate">{repoUrl.replace('https://github.com/', '')}</span>
        </div>
        <button onClick={() => { navigator.clipboard.writeText(repoUrl); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
          className="px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80 flex items-center gap-1.5"
          style={{ background: 'white', border: '1px solid #86efac', color: '#166534' }}>
          {copied ? '✓ Copied!' : 'Copy'}
        </button>
        <a href={repoUrl} target="_blank" rel="noopener noreferrer"
          className="px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80 flex items-center gap-1.5"
          style={{ background: '#16a34a', color: 'white' }}>
          Open ↗
        </a>
      </div>
      {/* Avatars */}
      {team && team.length > 0 && (
        <div className="flex items-center gap-3 mt-3">
          <div className="flex -space-x-2">
            {team.slice(0, 5).map((m, i) => (
              <div key={m.user_id}
                className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold text-white"
                style={{ background: ROLE_CONFIG[m.intern_role]?.color || '#5b4fff', borderColor: 'white', zIndex: 5 - i }}>
                {m.name?.[0]?.toUpperCase() || '?'}
              </div>
            ))}
          </div>
          <span className="text-xs" style={{ color: '#166534' }}>
            {team.map(m => m.name.split(' ')[0]).join(', ')}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Main Team tab panel ──────────────────────────────────────────────────────
function TeamTab({ project, teamData, currentUserId }) {
  if (!teamData) return (
    <div className="card p-16 text-center">
      <div className="w-10 h-10 rounded-full border-2 animate-spin mx-auto mb-3"
        style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Loading team...</p>
    </div>
  )

  const teamRoles = project.team_roles || (project.intern_role ? { [project.intern_role]: 1 } : {})

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-xl mb-1" style={{ color: 'var(--ink)' }}>
            {project.project_status === 'active' ? '✅ Full Team' : '⏳ Team Forming'}
          </h2>
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            {teamData.team?.length || 0}/{Object.values(teamRoles).reduce((a, b) => a + b, 0)} members joined
          </p>
        </div>
        {teamData.internx_repo && (
          <a href={teamData.internx_repo} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
            style={{ background: '#24292e', color: 'white' }}>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
            View Repo ↗
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(teamData.slots || []).map(slot => {
          const rc = ROLE_CONFIG[slot.role] || { label: slot.role, color: '#8888a0', bg: '#f0f0f4', icon: '?' }
          return Array.from({ length: slot.total_slots }).map((_, idx) => {
            const member = slot.members[idx]
            const isMe = member?.user_id === currentUserId
            return (
              <div key={`${slot.role}-${idx}`}
                className="flex items-center gap-4 p-4 rounded-2xl"
                style={{
                  background: member ? (isMe ? rc.bg : 'white') : 'var(--surface-2)',
                  border: member ? (isMe ? `2px solid ${rc.color}40` : '1.5px solid var(--border)') : '1.5px dashed var(--border)',
                }}>
                {member ? (
                  <>
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
                      style={{ background: rc.color }}>
                      {member.name?.[0]?.toUpperCase() || rc.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{member.name}</span>
                        {isMe && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: rc.bg, color: rc.color }}>You</span>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs" style={{ color: rc.color }}>{rc.icon}</span>
                        <span className="text-xs font-medium" style={{ color: 'var(--ink-muted)' }}>{rc.label} Intern</span>
                        {member.github_username && (
                          <a href={`https://github.com/${member.github_username}`} target="_blank" rel="noopener noreferrer"
                            className="text-xs font-mono hover:underline" style={{ color: 'var(--ink-muted)' }}>
                            @{member.github_username}
                          </a>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: 'var(--border)', opacity: 0.5 }}>
                      {rc.icon}
                    </div>
                    <div>
                      <div className="font-semibold text-sm" style={{ color: 'var(--ink-muted)' }}>Open slot</div>
                      <div className="text-xs" style={{ color: 'var(--ink-muted)' }}>Waiting for {rc.label} intern...</div>
                    </div>
                  </>
                )}
              </div>
            )
          })
        })}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ProjectPage() {
  const router = useRouter()
  const { user } = useAuthStore()

  // Page state machine
  const [pageState, setPageState] = useState('loading') // loading | lobby | project
  const [project, setProject]   = useState(null)
  const [teamData, setTeamData] = useState(null)
  const [joining, setJoining]   = useState(null)

  // Project page tabs / UI state
  const [activeTab, setActiveTab] = useState('overview')
  const [userRepoUrl, setUserRepoUrl] = useState('')
  const [repoInput, setRepoInput]     = useState('')
  const [editingRepo, setEditingRepo] = useState(false)
  const [repoSaving, setRepoSaving]   = useState(false)
  const [repoError, setRepoError]     = useState(null)
  const [showGuide, setShowGuide]     = useState(false)
  const [vsCodeConnecting, setVsCodeConnecting] = useState(false)
  const [vsCodeConnected, setVsCodeConnected]   = useState(false)
  const [vsCodeError, setVsCodeError]           = useState(null)
  const [showOpenPrompt, setShowOpenPrompt]     = useState(false)
  const [retryingRepo, setRetryingRepo]         = useState(false)
  const [retryMsg, setRetryMsg]                 = useState('')

  const handleRetryRepo = async () => {
    if (!project) return
    setRetryingRepo(true)
    setRetryMsg('')
    try {
      await api.post(`/api/projects/${project.id}/retry-repo`)
      setRetryMsg('Repo creation queued — refreshing in 10s…')
      setTimeout(async () => {
        try {
          const [pRes, tRes] = await Promise.all([
            api.get(`/api/projects/${project.id}`),
            api.get(`/api/projects/${project.id}/team`),
          ])
          setProject(pRes.data)
          setTeamData(tRes.data)
        } catch {}
        setRetryMsg('')
        setRetryingRepo(false)
      }, 10000)
    } catch (err) {
      setRetryMsg(err?.response?.data?.detail || 'Failed — check GITHUB_ORG_TOKEN in .env')
      setRetryingRepo(false)
    }
  }

  const loadTeam = useCallback(async (projectId) => {
    try {
      const r = await api.get(`/api/projects/${projectId}/team`)
      setTeamData(r.data)
    } catch { /* non-fatal */ }
  }, [])

  useEffect(() => {
    if (!user) { router.push('/auth/login'); return }
    if (!user.intern_role) { router.push('/auth/onboarding'); return }

    const init = async () => {
      try {
        const meRes = await api.get('/api/auth/me')
        const me = meRes.data

        // No project assigned yet — show lobby so user can join one
        if (!me.project_id) {
          setPageState('lobby')
          return
        }

        const projectRes = await api.get(`/api/projects/${me.project_id}`)
        const p = projectRes.data
        setProject(p)
        const saved = p.user_repo_url || p.internx_repo_url || ''
        setUserRepoUrl(saved)
        setRepoInput(saved)
        await loadTeam(p.id)

        // Always show project view — never drop back to lobby once assigned
        setPageState('project')
      } catch (err) {
        console.error(err)
        setPageState('lobby')
      }
    }
    init()
  }, [user, loadTeam])

  const handleJoin = async (projectId) => {
    // Safety guard — should never reach here if already in a project,
    // but prevent double-joining just in case
    if (project) return

    setJoining(projectId)
    try {
      const r = await api.post('/api/projects/join', { project_id: projectId })
      const p = r.data
      setProject(p)
      const saved = p.user_repo_url || p.internx_repo_url || ''
      setUserRepoUrl(saved)
      setRepoInput(saved)
      await loadTeam(p.id)
      setPageState('project')
    } catch (err) {
      alert(err?.response?.data?.detail || 'Failed to join project')
    } finally {
      setJoining(null)
    }
  }

  const handleSaveRepo = async () => {
    if (!repoInput.trim()) return
    setRepoSaving(true); setRepoError(null)
    try {
      await api.patch(`/api/projects/${project?.id}/repo`, { repo_url: repoInput.trim() })
      setUserRepoUrl(repoInput.trim()); setEditingRepo(false)
    } catch (err) { setRepoError(err?.response?.data?.detail || 'Failed to save') }
    finally { setRepoSaving(false) }
  }

  const handleVsCodeConnect = async () => {
    const repoToUse = project?.internx_repo_url || userRepoUrl
    if (!repoToUse) { setActiveTab('overview'); return }
    setVsCodeConnecting(true); setVsCodeError(null); setShowOpenPrompt(false)
    try {
      const r = await api.post(`/api/projects/${project?.id}/setup-token`)
      const a = document.createElement('a'); a.href = r.data.setup_url; a.click()
      setTimeout(() => { setVsCodeConnecting(false); setShowOpenPrompt(true) }, 2500)
    } catch (err) {
      setVsCodeError(err?.response?.data?.detail || 'Failed to connect. Make sure internx-cli is installed.')
      setVsCodeConnecting(false)
    }
  }

  // ── Renders ────────────────────────────────────────────────────────────────
  if (pageState === 'loading') return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface)' }}>
      <div className="text-center animate-fade-up">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--accent-soft)' }}>
          <svg className="w-6 h-6 animate-spin" style={{ color: 'var(--accent)' }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <p className="font-display font-semibold" style={{ color: 'var(--ink)' }}>Finding your team...</p>
        <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>Matching you with a real internship project</p>
      </div>
    </div>
  )

  const isActive = project?.project_status === 'active'
  // Only use teamData.internx_repo — this is set only after the GitHub repo is
  // actually created for this group. Do NOT fall back to project.internx_repo_url
  // as it holds a stale hardcoded URL from before the multiplayer system.
  const internRepoUrl = teamData?.internx_repo || null
  const repoForConnect = internRepoUrl || userRepoUrl
  const folderRoot = project?.folder_structure ? Object.entries(project.folder_structure)[0] : null

  return (
    <div className="min-h-screen" style={{ background: 'var(--surface)' }}>
      {project && (
        <div className="fixed top-0 right-0 w-[600px] h-[600px] pointer-events-none"
          style={{ background: `radial-gradient(circle, ${project.company_color}10 0%, transparent 70%)`, filter: 'blur(80px)' }} />
      )}

      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center font-display font-black text-sm text-white" style={{ background: 'var(--accent)' }}>X</div>
            <span className="font-display font-bold" style={{ color: 'var(--ink)' }}>InternX</span>
          </div>
          <div className="flex items-center gap-3">
            {pageState === 'project' && (
              <Link href="/internship/team" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)', border: '1px solid var(--border)' }}>
                👥 My Team
              </Link>
            )}
            <Link href="/dashboard" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid rgba(91,79,255,0.2)' }}>
              📊 Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* ── LOBBY ── */}
        {pageState === 'lobby' && (
          <ProjectLobby
            internRole={user?.intern_role}
            onJoin={handleJoin}
            joining={joining}
            alreadyAssigned={!!project}
          />
        )}

        {/* ── PROJECT VIEW ── */}
        {pageState === 'project' && project && (
          <>
            {/* Team banners */}
            {isActive ? (
              internRepoUrl ? (
                <ActiveTeamBanner repoUrl={internRepoUrl} team={teamData?.team} />
              ) : (
                <div className="mb-6 p-5 rounded-2xl animate-fade-up"
                  style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '1.5px solid #86efac' }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: '#16a34a' }} />
                      <span className="text-sm font-bold" style={{ color: '#14532d' }}>Team Active · Repo Pending</span>
                    </div>
                    <a href="/internship/team" className="text-xs font-semibold px-3 py-1.5 rounded-xl hover:opacity-80"
                      style={{ background: '#16a34a', color: 'white' }}>View Team →</a>
                  </div>
                  <p className="text-xs mb-3" style={{ color: '#166534' }}>
                    Your team is complete but the GitHub repo hasn&apos;t been created yet.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleRetryRepo}
                      disabled={retryingRepo}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105 disabled:opacity-50"
                      style={{ background: '#24292e', color: 'white' }}>
                      {retryingRepo
                        ? <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Creating…</>
                        : '🔄 Create GitHub Repo'}
                    </button>
                    {retryMsg && <span className="text-xs" style={{ color: retryingRepo ? '#166534' : '#dc2626' }}>{retryMsg}</span>}
                  </div>
                </div>
              )
            ) : (
              <TeamFormingBanner project={project} teamData={teamData} />
            )}

            {/* Project header */}
            <div className="animate-fade-up mb-8">
              <div className="flex items-start gap-5">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 shadow-sm"
                  style={{ background: `${project.company_color}15`, border: `2px solid ${project.company_color}30` }}>
                  {project.company_emoji}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-sm font-semibold" style={{ color: project.company_color }}>{project.company_name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>{project.company_tagline}</span>
                  </div>
                  <h1 className="text-3xl font-display font-bold mb-2" style={{ color: 'var(--ink)' }}>{project.project_title}</h1>
                  <div className="flex items-center gap-3 flex-wrap">
                    {(() => {
                      const myRole = teamData?.team?.find(m => m.user_id === user?.id)?.intern_role || user?.intern_role
                      const rc = ROLE_CONFIG[myRole] || { label: myRole, color: '#5b4fff', bg: '#ede9ff' }
                      return (
                        <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: rc.bg, color: rc.color }}>
                          {rc.label} Intern
                        </span>
                      )
                    })()}
                    <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                      style={{ background: project.difficulty === 'advanced' ? '#fee2e2' : '#fef9c3', color: project.difficulty === 'advanced' ? '#dc2626' : '#854d0e' }}>
                      {project.difficulty === 'advanced' ? '🔥 Advanced' : '⚡ Intermediate'}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>⏱ {project.duration_weeks} weeks</span>
                  </div>
                </div>

                {/* VS Code button */}
                <div className="flex-shrink-0 flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowGuide(true)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center hover:opacity-80"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink-muted)' }}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></svg>
                    </button>
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
                  </div>
                  {!repoForConnect && !vsCodeConnected && (
                    <p className="text-xs" style={{ color: '#b45309' }}>
                      ⚠ Repo ready when team is complete
                    </p>
                  )}
                </div>
              </div>

              {showGuide && <SetupGuideModal onClose={() => setShowGuide(false)} />}

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
                  <p className="text-sm font-semibold mb-1" style={{ color: '#dc2626' }}>⚠️ {vsCodeError}</p>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: 'var(--surface-2)' }}>
              {['overview', 'tech stack', 'team', 'folder structure'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize"
                  style={{ background: activeTab === tab ? 'white' : 'transparent', color: activeTab === tab ? 'var(--ink)' : 'var(--ink-muted)', boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                  {tab}
                  {tab === 'team' && teamData && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: isActive ? '#dcfce7' : '#fef3c7', color: isActive ? '#16a34a' : '#92400e' }}>
                      {teamData.team?.length || 0}/{Object.values(project.team_roles || { _: 1 }).reduce((a, b) => a + b, 0)}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="animate-fade-up stagger-2">
              {activeTab === 'overview' && (
                <div className="grid grid-cols-3 gap-5">
                  <div className="col-span-2 card p-7">
                    <h2 className="font-display font-bold text-lg mb-4" style={{ color: 'var(--ink)' }}>About this project</h2>
                    <p className="leading-relaxed text-sm" style={{ color: 'var(--ink-soft)' }}>{project.project_description}</p>
                    <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
                      <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--ink)' }}>What you'll learn</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {['Real-world codebase', 'Code review process', 'Sprint delivery', 'Team collaboration', 'Production quality', 'Applying feedback'].map(item => (
                          <div key={item} className="flex items-center gap-2 text-xs" style={{ color: 'var(--ink-soft)' }}>
                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--accent)' }} />{item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="card p-5">
                      <h3 className="font-display font-bold text-sm mb-3" style={{ color: 'var(--ink)' }}>Sprint Plan</h3>
                      <div className="space-y-3">
                        {[{ week: 'Week 1', label: 'Setup & Core Features', color: 'var(--accent)' }, { week: 'Week 2', label: 'Polish, Tests & Ship', color: 'var(--green)' }].map(s => (
                          <div key={s.week} className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                            <div>
                              <div className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{s.week}</div>
                              <div className="text-xs" style={{ color: 'var(--ink-muted)' }}>{s.label}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* GitHub repo card */}
                    <div className="card p-5">
                      <h3 className="font-display font-bold text-sm mb-1" style={{ color: 'var(--ink)' }}>
                        {internRepoUrl ? '✅ Team GitHub Repo' : '⏳ Personal Repo'}
                      </h3>
                      <p className="text-xs mb-3" style={{ color: 'var(--ink-muted)' }}>
                        {internRepoUrl ? 'Shared repo — everyone pushes here' : userRepoUrl ? 'Your repo (backup while team forms)' : 'Add your GitHub repo or wait for the team repo'}
                      </p>
                      {internRepoUrl ? (
                        <a href={internRepoUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold hover:opacity-80 transition-opacity"
                          style={{ background: '#24292e', color: 'white' }}>
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
                          {internRepoUrl.replace('https://github.com/', '')}
                        </a>
                      ) : (
                        <div className="space-y-2">
                          {userRepoUrl && !editingRepo ? (
                            <div className="flex items-center gap-2">
                              <span className="flex-1 text-xs font-mono truncate px-3 py-2 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)' }}>
                                {userRepoUrl.replace('https://github.com/', '')}
                              </span>
                              <button onClick={() => { setRepoInput(userRepoUrl); setEditingRepo(true) }}
                                className="p-2 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
                              </button>
                            </div>
                          ) : (
                            <>
                              <input type="url" value={repoInput} onChange={e => setRepoInput(e.target.value)}
                                placeholder="https://github.com/you/your-repo"
                                className="w-full px-3 py-2 rounded-lg text-xs font-mono outline-none"
                                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                                onKeyDown={e => e.key === 'Enter' && handleSaveRepo()} autoFocus={editingRepo} />
                              {repoError && <p className="text-xs" style={{ color: '#dc2626' }}>{repoError}</p>}
                              <div className="flex gap-2">
                                <button onClick={handleSaveRepo} disabled={repoSaving || !repoInput.trim()}
                                  className="flex-1 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
                                  style={{ background: '#24292e', color: 'white' }}>
                                  {repoSaving ? 'Saving...' : 'Save'}
                                </button>
                                {editingRepo && (
                                  <button onClick={() => { setRepoInput(userRepoUrl); setEditingRepo(false) }}
                                    className="px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>Cancel</button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'tech stack' && (
                <div className="card p-7">
                  <h2 className="font-display font-bold text-lg mb-6" style={{ color: 'var(--ink)' }}>Tech Stack</h2>
                  <div className="flex flex-wrap gap-3">
                    {(project.tech_stack || []).map((tech, i) => (
                      <div key={tech} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                        style={{ background: 'var(--surface-2)', color: 'var(--ink)', border: '1px solid var(--border)' }}>
                        <div className="w-2 h-2 rounded-full" style={{ background: `hsl(${i * 47}, 70%, 55%)` }} />{tech}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'team' && (
                <TeamTab project={project} teamData={teamData} currentUserId={user?.id} />
              )}

              {activeTab === 'folder structure' && (
                <div className="grid grid-cols-2 gap-5">
                  <div className="card p-6">
                    <h2 className="font-display font-bold text-lg mb-5" style={{ color: 'var(--ink)' }}>Starter Structure</h2>
                    {folderRoot ? (
                      <div className="rounded-xl p-4 font-mono" style={{ background: '#0d1117', border: '1px solid #30363d' }}>
                        <FolderTree name={folderRoot[0]} node={folderRoot[1]} depth={0} />
                      </div>
                    ) : <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>No folder structure defined.</p>}
                  </div>
                  <div className="space-y-4">
                    <div className="card p-5">
                      <h3 className="font-display font-bold text-sm mb-3" style={{ color: 'var(--ink)' }}>🔌 Connect VS Code</h3>
                      <div className="space-y-2 text-xs mb-4" style={{ color: 'var(--ink-soft)' }}>
                        {['Repo cloned automatically', 'Your role branch created', 'Folder structure scaffolded', 'Submit PRs with internx pr'].map(f => (
                          <div key={f} className="flex items-center gap-2">
                            <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--green)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>{f}
                          </div>
                        ))}
                      </div>
                      <button onClick={handleVsCodeConnect} disabled={vsCodeConnected || vsCodeConnecting || !repoForConnect}
                        className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all disabled:cursor-not-allowed"
                        style={{ background: vsCodeConnected ? '#dcfce7' : '#24292e', color: vsCodeConnected ? '#16a34a' : 'white', opacity: !repoForConnect ? 0.5 : 1 }}>
                        {vsCodeConnected ? '✓ Connected' : vsCodeConnecting ? 'Connecting...' : '→ Connect VS Code'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* CTA */}
            <div className="mt-10 flex justify-between items-center py-6 border-t" style={{ borderColor: 'var(--border)' }}>
              <div>
                <p className="font-display font-bold" style={{ color: 'var(--ink)' }}>Ready to start coding?</p>
                <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Your tasks are waiting in the dashboard</p>
              </div>
              <button onClick={() => router.push('/dashboard')}
                className="btn-primary px-8 py-3.5 text-sm flex items-center gap-2 hover:scale-105 active:scale-95 transition-transform">
                Go to Dashboard
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}