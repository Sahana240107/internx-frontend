'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store/authStore'
import api from '@/lib/api'
import Link from 'next/link'
import Image from 'next/image'

const ROLE_CONFIG = {
  frontend:  { label: 'Frontend',   color: '#5b4fff', bg: '#ede9ff',  icon: '⚡', darkBg: '#3730a3' },
  backend:   { label: 'Backend',    color: '#3b82f6', bg: '#eff6ff',  icon: '⚙️', darkBg: '#1d4ed8' },
  fullstack: { label: 'Full Stack', color: '#f59e0b', bg: '#fffbeb',  icon: '🔥', darkBg: '#b45309' },
  devops:    { label: 'DevOps',     color: '#00c896', bg: '#e0fff7',  icon: '🚀', darkBg: '#047857' },
  design:    { label: 'Design',     color: '#ec4899', bg: '#fdf2f8',  icon: '✦',  darkBg: '#be185d' },
  tester:    { label: 'QA/Tester',  color: '#8b5cf6', bg: '#f5f3ff',  icon: '🧪', darkBg: '#6d28d9' },
}

function MemberRow({ member, isMe, rc }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
      style={{
        background: isMe ? `linear-gradient(135deg, ${rc.bg}, white)` : 'white',
        border: isMe ? `1.5px solid ${rc.color}40` : '1.5px solid var(--border)',
        boxShadow: isMe ? `0 2px 12px ${rc.color}10` : 'none',
      }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white flex-shrink-0"
        style={{ background: `linear-gradient(135deg, ${rc.color}, ${rc.darkBg || rc.color})` }}>
        {member.avatar_url
          ? <Image src={member.avatar_url} alt={member.name} width={36} height={36} className="rounded-xl object-cover" />
          : member.name?.[0]?.toUpperCase() || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>{member.name}</span>
          {isMe && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
              style={{ background: rc.bg, color: rc.color }}>YOU</span>
          )}
        </div>
        {member.github_username && (
          <a href={`https://github.com/${member.github_username}`} target="_blank" rel="noopener noreferrer"
            className="text-[11px] hover:underline" style={{ color: 'var(--ink-muted)' }}>
            @{member.github_username}
          </a>
        )}
      </div>
      <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--ink-muted)' }}>
        {new Date(member.joined_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
      </span>
    </div>
  )
}

export default function TeamPage() {
  const router = useRouter()
  const { user } = useAuthStore()

  const [project, setProject]   = useState(null)
  const [teamData, setTeamData] = useState(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!user) { router.push('/auth/login'); return }
    const load = async () => {
      try {
        const meRes = await api.get('/api/auth/me')
        const me = meRes.data
        if (!me.project_id) { router.push('/internship/project'); return }

        const [projectRes, teamRes] = await Promise.all([
          api.get(`/api/projects/${me.project_id}`),
          api.get(`/api/projects/${me.project_id}/team`),
        ])
        setProject(projectRes.data)
        setTeamData(teamRes.data)
      } catch (err) {
        console.error(err)
        router.push('/internship/project')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface)' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        <span className="text-sm" style={{ color: 'var(--ink-muted)' }}>Loading your team...</span>
      </div>
    </div>
  )

  if (!project || !teamData) return null

  const isActive = project.project_status === 'active'
  const repoUrl = project.internx_repo_url
  const teamRoles = project.team_roles || (project.intern_role ? { [project.intern_role]: 1 } : {})
  const totalSlots = Object.values(teamRoles).reduce((a, b) => a + b, 0)
  const filledSlots = teamData.team?.length || 0
  const progress = totalSlots > 0 ? (filledSlots / totalSlots) * 100 : 0

  // Build sorted slots list: filled members first, then empty slots
  const allSlots = []
  for (const [role, count] of Object.entries(teamRoles)) {
    const filled = (teamData.slots || []).find(s => s.role === role)?.members || []
    for (let i = 0; i < count; i++) {
      allSlots.push({ role, member: filled[i] || null })
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--surface)' }}>
      {/* Ambient glow */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] pointer-events-none"
        style={{ background: `radial-gradient(circle, ${project.company_color || '#5b4fff'}10 0%, transparent 70%)`, filter: 'blur(80px)' }} />

      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/internship/project" className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold hover:opacity-80 transition-opacity"
              style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)', border: '1px solid var(--border)' }}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              Back to Project
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid rgba(91,79,255,0.2)' }}>
              📊 Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="mb-10 animate-fade-up">
          <div className="flex items-start gap-5 mb-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 shadow-sm"
              style={{ background: `${project.company_color || '#5b4fff'}15`, border: `2px solid ${project.company_color || '#5b4fff'}30` }}>
              {project.company_emoji}
            </div>
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: project.company_color || '#5b4fff' }}>
                {project.company_name}
              </p>
              <h1 className="text-3xl font-display font-bold mb-1" style={{ color: 'var(--ink)' }}>
                Your Team
              </h1>
              <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>{project.project_title}</p>
            </div>
          </div>

          {/* Team status card */}
          <div className="p-6 rounded-2xl mb-2"
            style={{
              background: isActive
                ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)'
                : 'linear-gradient(135deg, #fffbeb, #fef3c7)',
              border: `1.5px solid ${isActive ? '#86efac' : '#fde68a'}`,
            }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full"
                    style={{ background: isActive ? '#16a34a' : '#f59e0b' }} />
                  <span className="font-bold text-base"
                    style={{ color: isActive ? '#14532d' : '#92400e' }}>
                    {isActive ? '🎉 Team Complete — Active Project' : '⏳ Team Forming...'}
                  </span>
                </div>
                <p className="text-sm" style={{ color: isActive ? '#166534' : '#a16207' }}>
                  {filledSlots}/{totalSlots} members joined
                  {!isActive && ' · Waiting for remaining team members'}
                  {isActive && ' · Coding in progress'}
                </p>
              </div>
              {repoUrl && (
                <a href={repoUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold hover:scale-105 transition-transform flex-shrink-0"
                  style={{ background: '#24292e', color: 'white' }}>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  Open Team Repo ↗
                </a>
              )}
            </div>

            {/* Progress */}
            <div className="mb-3">
              <div className="h-2 rounded-full overflow-hidden" style={{ background: isActive ? '#86efac' : '#fde68a' }}>
                <div className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${progress}%`, background: isActive ? '#16a34a' : '#f59e0b' }} />
              </div>
            </div>

            {/* Role chips */}
            <div className="flex flex-wrap gap-2">
              {allSlots.map(({ role, member }, idx) => {
                const rc = ROLE_CONFIG[role] || { label: role, color: '#8888a0', bg: '#f0f0f4', icon: '?' }
                return (
                  <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold"
                    style={{
                      background: member ? rc.bg : 'rgba(255,255,255,0.5)',
                      color: member ? rc.color : (isActive ? '#166534' : '#a16207'),
                      border: member ? `1px solid ${rc.color}30` : `1px dashed ${isActive ? '#86efac' : '#fde68a'}`,
                    }}>
                    <span>{rc.icon}</span>
                    <span>{member ? member.name.split(' ')[0] : rc.label}</span>
                    {member ? (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                    ) : (
                      <span className="opacity-50">waiting...</span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Repo URL display */}
            {repoUrl && (
              <div className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.8)' }}>
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" style={{ color: '#24292e' }}>
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                <span className="text-sm font-mono font-semibold flex-1 truncate" style={{ color: '#24292e' }}>
                  {repoUrl.replace('https://github.com/', '')}
                </span>
                <button onClick={() => navigator.clipboard.writeText(repoUrl)}
                  className="text-xs font-semibold px-2 py-1 rounded-lg hover:opacity-80 transition-opacity"
                  style={{ background: 'white', color: '#24292e' }}>
                  Copy
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Project Members — grouped by role/team */}
        <div className="mb-6 animate-fade-up stagger-1">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-display font-bold" style={{ color: 'var(--ink)' }}>
                Project Members
              </h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                {filledSlots}/{totalSlots} members joined
              </p>
            </div>
            {/* Avatar stack */}
            <div className="flex -space-x-2">
              {(teamData.team || []).map(m => {
                const rc = ROLE_CONFIG[m.intern_role] || { color: '#5b4fff' }
                return (
                  <div key={m.user_id} className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold text-white"
                    style={{ background: rc.color, borderColor: 'var(--surface)' }}>
                    {m.name?.[0]?.toUpperCase() || '?'}
                  </div>
                )
              })}
              {totalSlots - filledSlots > 0 && (
                <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold"
                  style={{ background: 'var(--border)', borderColor: 'var(--surface)', color: 'var(--ink-muted)' }}>
                  +{totalSlots - filledSlots}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {Object.entries(teamRoles).map(([role, count]) => {
              const rc = ROLE_CONFIG[role] || { label: role, color: '#5b4fff', bg: '#ede9ff', icon: '?', darkBg: '#3730a3' }
              const slotData = (teamData.slots || []).find(s => s.role === role)
              const members = slotData?.members || []
              const openSlots = count - members.length
              const isMyTeam = role === (teamData.team || []).find(m => m.user_id === user?.id)?.intern_role

              return (
                <div key={role} className="rounded-2xl overflow-hidden"
                  style={{ border: isMyTeam ? `2px solid ${rc.color}35` : '1.5px solid var(--border)' }}>

                  {/* Team name header */}
                  <div className="flex items-center gap-3 px-5 py-3"
                    style={{ background: isMyTeam ? rc.bg : 'var(--surface-2)' }}>
                    <span className="text-base">{rc.icon}</span>
                    <span className="font-display font-bold text-sm" style={{ color: isMyTeam ? rc.color : 'var(--ink)' }}>
                      {rc.label} Team
                    </span>
                    {isMyTeam && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: rc.color, color: 'white' }}>
                        Your Team
                      </span>
                    )}
                    <span className="ml-auto text-xs" style={{ color: 'var(--ink-muted)' }}>
                      {members.length}/{count}
                    </span>
                  </div>

                  {/* Members + available slots */}
                  <div className="p-3 space-y-2" style={{ background: 'var(--surface)' }}>

                    {/* Filled members */}
                    {members.length > 0
                      ? members.map(member => (
                          <MemberRow
                            key={member.user_id}
                            member={member}
                            isMe={member.user_id === user?.id}
                            rc={rc}
                          />
                        ))
                      : (
                        <p className="text-xs px-4 py-2" style={{ color: 'var(--ink-muted)' }}>
                          No members yet.
                        </p>
                      )
                    }

                    {/* Available divider + open slots */}
                    {openSlots > 0 && (
                      <>
                        <div className="flex items-center gap-2 pt-1">
                          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                          <span className="text-[10px] font-semibold uppercase tracking-widest"
                            style={{ color: 'var(--ink-muted)' }}>Available</span>
                          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                        </div>
                        {Array.from({ length: openSlots }).map((_, i) => (
                          <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                            style={{ background: 'var(--surface-2)', border: '1.5px dashed var(--border)' }}>
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base opacity-25 flex-shrink-0"
                              style={{ background: rc.bg }}>{rc.icon}</div>
                            <div>
                              <p className="text-xs font-semibold" style={{ color: 'var(--ink-muted)' }}>Open slot</p>
                              <p className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>Waiting for {rc.label} intern</p>
                            </div>
                            <div className="flex gap-1 ml-auto">
                              {[0, 1, 2].map(j => (
                                <div key={j} className="w-1.5 h-1.5 rounded-full animate-pulse"
                                  style={{ background: rc.color + '50', animationDelay: `${j * 0.3}s` }} />
                              ))}
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Branch info */}
        {isActive && (
          <div className="mt-8 p-6 rounded-2xl animate-fade-up stagger-3"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <h3 className="font-display font-bold text-base mb-3" style={{ color: 'var(--ink)' }}>
              🌿 Branch Strategy
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--ink-muted)' }}>
              Each team member works on their own branch and opens PRs to <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'var(--border)', color: 'var(--ink)' }}>main</code>.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(teamData.team || []).map(m => {
                const rc = ROLE_CONFIG[m.intern_role] || { color: '#5b4fff', label: m.intern_role }
                const branchName = `${m.github_username || m.name?.toLowerCase().replace(/\s/g, '-')}-${m.intern_role}-dev`
                return (
                  <div key={m.user_id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                    style={{ background: 'white', border: '1px solid var(--border)' }}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: rc.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{m.name}</div>
                      <div className="font-mono text-[11px] truncate" style={{ color: 'var(--ink-muted)' }}>
                        {branchName}
                      </div>
                    </div>
                    {m.user_id === user?.id && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                        style={{ background: rc.color + '20', color: rc.color }}>you</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}