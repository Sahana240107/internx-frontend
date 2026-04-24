'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { taskApi } from '@/lib/taskApi'
import { useAuthStore } from '@/lib/store/authStore'

// ── Status / Priority config ─────────────────────────────────────────────────
const STATUS_CONFIG = {
  done:        { label: 'Done',        bg: '#00c89618', color: '#00c896', emoji: '✅' },
  in_progress: { label: 'In Progress', bg: '#3b82f618', color: '#3b82f6', emoji: '🔄' },
  todo:        { label: 'To Do',       bg: '#f59e0b18', color: '#f59e0b', emoji: '📌' },
  review:      { label: 'In Review',   bg: '#a855f718', color: '#a855f7', emoji: '👀' },
}
const PRIORITY_CONFIG = {
  high:   { label: 'High',   color: '#ef4444', bg: '#ef444412', icon: '🔴' },
  medium: { label: 'Medium', color: '#f59e0b', bg: '#f59e0b12', icon: '🟡' },
  low:    { label: 'Low',    color: '#6b7280', bg: '#6b728012', icon: '⚪' },
}
const STATUS_ORDER = ['in_progress', 'review', 'todo', 'done']

// ── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

// ── Sub-components ───────────────────────────────────────────────────────────
function Avatar({ src, name, size = 44 }) {
  const colors = ['#5b4fff','#3b82f6','#00c896','#f59e0b','#ec4899','#8b5cf6']
  const bg = colors[(name?.charCodeAt(0) || 0) % colors.length]
  if (src) return (
    <img src={src} alt={name || ''} width={size} height={size}
      className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
  )
  return (
    <div className="rounded-full flex items-center justify-center shrink-0 font-bold text-white"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.33 }}>
      {getInitials(name)}
    </div>
  )
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: '#88888818', color: '#888', emoji: '•' }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.emoji} {cfg.label}
    </span>
  )
}

function PriorityBadge({ priority }) {
  const cfg = PRIORITY_CONFIG[priority]
  if (!cfg) return null
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

function ProgressRing({ pct, size = 52, color = '#00c896' }) {
  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width={size} height={size} className="shrink-0" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        style={{ fill: 'var(--ink)', fontSize: size * 0.22, fontWeight: 700,
          transform: 'rotate(90deg)', transformOrigin: 'center' }}>
        {pct}%
      </text>
    </svg>
  )
}

// ── Task Row ─────────────────────────────────────────────────────────────────
function TaskRow({ task }) {
  const due = task.due_date
    ? new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : null
  const isOverdue = task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date()

  return (
    <div className="flex flex-col gap-2 px-3 py-3 rounded-xl"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>

      {/* Title + status */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold leading-snug flex-1" style={{ color: 'var(--ink)' }}>
          {task.title}
        </p>
        <StatusBadge status={task.status} />
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-[11px] leading-relaxed line-clamp-2" style={{ color: 'var(--ink-muted)' }}>
          {task.description}
        </p>
      )}

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={task.priority} />
        {due && (
          <span className="text-[10px] px-2 py-0.5 rounded-full"
            style={{
              background: isOverdue ? '#ef444412' : 'var(--surface-2)',
              color: isOverdue ? '#ef4444' : 'var(--ink-muted)',
              border: '1px solid var(--border)',
            }}>
            📅 {isOverdue ? 'Overdue · ' : ''}{due}
          </span>
        )}
        {task.score != null && (
          <span className="text-[10px]" style={{ color: '#f59e0b' }}>⭐ {task.score}</span>
        )}
      </div>
    </div>
  )
}

// ── Teammate Row ──────────────────────────────────────────────────────────────
function TeammateCard({ member, isYou, allTasks, index }) {
  const [showDone, setShowDone] = useState(false)

  const memberId    = member.user_id || member.id
  const myTasks     = allTasks.filter(t => t.assigned_to === memberId)
  const doneTasks   = myTasks.filter(t => t.status === 'done')
  const activeTasks = myTasks.filter(t => t.status !== 'done')
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))

  const total      = myTasks.length
  const done       = doneTasks.length
  const inProgress = myTasks.filter(t => t.status === 'in_progress').length
  const inReview   = myTasks.filter(t => t.status === 'review').length
  const todo       = myTasks.filter(t => t.status === 'todo').length

  return (
    <div
      className="rounded-2xl overflow-hidden animate-fade-up"
      style={{
        background: 'var(--surface-1)',
        border: isYou ? '2px solid var(--accent)' : '1px solid var(--border)',
        boxShadow: isYou ? '0 0 0 4px rgba(91,79,255,0.07)' : undefined,
        animationDelay: `${index * 0.07}s`,
      }}>

      {/* ── Member header ── */}
      <div className="px-5 py-4 flex items-center gap-4"
        style={{ borderBottom: total > 0 ? '1px solid var(--border)' : undefined }}>
        <div className="relative">
          {isYou && (
            <span className="absolute -top-1 -right-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide z-10"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              You
            </span>
          )}
          <Avatar src={member.avatar_url} name={member.name} size={42} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-sm" style={{ color: 'var(--ink)' }}>
              {member.name ?? 'Unknown'}
            </p>
            {member.intern_role && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold capitalize"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                {member.intern_role}
              </span>
            )}
          </div>
          {member.github_username && (
            <a href={`https://github.com/${member.github_username}`} target="_blank" rel="noreferrer"
              className="text-xs hover:underline" style={{ color: 'var(--ink-muted)' }}>
              @{member.github_username}
            </a>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Stat chips */}
          <div className="hidden sm:flex gap-1.5">
            {todo > 0 && <span className="text-[11px] px-2 py-1 rounded-lg font-medium" style={{ background: '#f59e0b12', color: '#f59e0b' }}>📌 {todo}</span>}
            {inProgress > 0 && <span className="text-[11px] px-2 py-1 rounded-lg font-medium" style={{ background: '#3b82f612', color: '#3b82f6' }}>🔄 {inProgress}</span>}
            {inReview > 0 && <span className="text-[11px] px-2 py-1 rounded-lg font-medium" style={{ background: '#a855f712', color: '#a855f7' }}>👀 {inReview}</span>}
            {done > 0 && <span className="text-[11px] px-2 py-1 rounded-lg font-medium" style={{ background: '#00c89612', color: '#00c896' }}>✅ {done}</span>}
          </div>
        </div>
      </div>

      {/* ── Tasks horizontal grid ── */}
      {total === 0 ? (
        <div className="px-5 py-3">
          <p className="text-xs italic" style={{ color: 'var(--ink-muted)' }}>No tasks assigned yet.</p>
        </div>
      ) : (
        <div className="px-5 py-4 flex flex-col gap-3">
          {/* Active tasks — horizontal wrapping grid */}
          {activeTasks.length > 0 && (
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              {activeTasks.map(task => <TaskRow key={task.id} task={task} />)}
            </div>
          )}

          {/* Done tasks toggle */}
          {doneTasks.length > 0 && (
            <div className="flex flex-col gap-2">
              {activeTasks.length > 0 && <div style={{ height: 1, background: 'var(--border)' }} />}
              <button
                onClick={() => setShowDone(v => !v)}
                className="flex items-center gap-2 text-[11px] font-semibold text-left py-1.5 px-3 rounded-xl transition-all hover:opacity-80 w-fit"
                style={{
                  background: showDone ? '#00c89612' : 'var(--surface-2)',
                  color: showDone ? '#00c896' : 'var(--ink-muted)',
                  border: '1px solid var(--border)',
                }}>
                <span style={{ display: 'inline-block', transform: showDone ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
                {showDone ? 'Hide' : 'Show'} {doneTasks.length} completed task{doneTasks.length !== 1 ? 's' : ''}
              </button>
              {showDone && (
                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                  {doneTasks.map(task => <TaskRow key={task.id} task={task} />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {member.github_repo_url && (
        <div className="px-5 pb-4" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <a href={member.github_repo_url} target="_blank" rel="noreferrer"
            className="text-xs flex items-center gap-1.5 hover:underline"
            style={{ color: 'var(--ink-muted)' }}>
            🔗 View personal repo
          </a>
        </div>
      )}
    </div>
  )
}

// ── Sprint Summary Bar ────────────────────────────────────────────────────────
function SprintSummaryBar({ tasks, members }) {
  const total      = tasks.length
  const done       = tasks.filter(t => t.status === 'done').length
  const inProgress = tasks.filter(t => t.status === 'in_progress').length
  const inReview   = tasks.filter(t => t.status === 'review').length
  const todo       = tasks.filter(t => t.status === 'todo').length
  const pct        = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #00c896, #3b82f6)' }} />
        </div>
        <span className="text-xs font-bold shrink-0" style={{ color: '#00c896' }}>{pct}% complete</span>
      </div>
      <div className="flex flex-wrap gap-3 text-xs" style={{ color: 'var(--ink-muted)' }}>
        <span>📋 {total} total</span>
        <span style={{ color: '#f59e0b' }}>📌 {todo} to-do</span>
        <span style={{ color: '#3b82f6' }}>🔄 {inProgress} active</span>
        <span style={{ color: '#a855f7' }}>👀 {inReview} review</span>
        <span style={{ color: '#00c896' }}>✅ {done} done</span>
        <span>👥 {members} member{members !== 1 ? 's' : ''}</span>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TeammatesPage() {
  const router   = useRouter()
  const { user } = useAuthStore()

  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [allMembers,    setAllMembers]    = useState([])
  const [allTasks,      setAllTasks]      = useState([])
  const [sprint,        setSprint]        = useState(null)
  const [projectTitle,  setProjectTitle]  = useState('')
  const [teamRole,      setTeamRole]      = useState('')
  const [groupName,     setGroupName]     = useState('')
  const [currentUserId, setCurrentUserId] = useState(null)
  const [searchQuery,   setSearchQuery]   = useState('')

  useEffect(() => {
    if (!user) { router.replace('/auth/login'); return }
    let isMounted = true

    const load = async () => {
      // Hoisted so steps 5 & 6 can access them
      let me        = null
      let roleTeam  = []
      let myGroupId = null

      // ── Step 1-4: core data (teammates) ─────────────────────────────────────
      try {
        // 1. Current user
        const meRes = await api.get('/api/auth/me')
        me = meRes.data
        if (isMounted) setCurrentUserId(me.id)

        if (!me?.project_id) {
          if (isMounted) setError('No project assigned yet. Join a project to see your teammates.')
          if (isMounted) setLoading(false)
          return
        }

        // 2. Project + team
        const [projectRes, teamRes] = await Promise.all([
          api.get(`/api/projects/${me.project_id}`),
          api.get(`/api/projects/${me.project_id}/team`),
        ])
        if (!isMounted) return

        if (isMounted) setProjectTitle(projectRes.data?.project_title || '')

        const allTeam = teamRes.data?.team || []

        // 3. My entry → group + role
        const myEntry = allTeam.find(m => m.user_id === me.id)
        myGroupId     = myEntry?.group_id ?? null
        const myRole  = myEntry?.intern_role || me.intern_role || ''
        if (isMounted) setTeamRole(myRole)
        if (isMounted) setGroupName(projectRes.data?.project_title || '')

        // 4. Filter same group + same role
        roleTeam = myGroupId && myRole
          ? allTeam.filter(m => m.group_id === myGroupId && m.intern_role === myRole)
          : allTeam.filter(m => m.intern_role === myRole)

        if (isMounted) setAllMembers(roleTeam)

        if (!roleTeam.length) {
          if (isMounted) setLoading(false)
          return
        }
      } catch (err) {
        console.error('[TeammatesPage] core load failed', err)
        if (isMounted) setError('Could not load teammates. Please try again.')
        if (isMounted) setLoading(false)
        return
      }

      // ── Step 5: tasks via backend (bypasses RLS) ────────────────────────────
      try {
        const res = await taskApi.getProjectTasks()
        const tasks = Array.isArray(res.data) ? res.data : []
        // Filter to only role teammates
        const memberIds = new Set(roleTeam.map(m => m.user_id).filter(Boolean))
        if (isMounted) setAllTasks(tasks.filter(t => memberIds.has(t.assigned_to)))
      } catch (err) {
        console.warn('[TeammatesPage] tasks fetch failed (non-fatal):', err)
      }

      // ── Step 6: sprint via backend (bypasses RLS) ───────────────────────────
      try {
        const res = await taskApi.getActiveSprint()
        const sprints = Array.isArray(res.data) ? res.data : []
        // getActiveSprint returns array; pick first sprint matching our group
        const match = myGroupId
          ? sprints.find(s => s.group_id === myGroupId) ?? sprints[0] ?? null
          : sprints[0] ?? null
        if (match && isMounted) setSprint(match)
      } catch (err) {
        console.warn('[TeammatesPage] sprint fetch failed (non-fatal):', err)
      }

      if (isMounted) setLoading(false)
    }

    load()
    return () => { isMounted = false }
  }, [user])

  const filteredMembers = useMemo(() =>
    allMembers.filter(m =>
      !searchQuery || (m.name ?? '').toLowerCase().includes(searchQuery.toLowerCase())
    ), [allMembers, searchQuery])

  const sprintTasks = useMemo(() => {
    if (!sprint) return allTasks
    const linked = allTasks.filter(t => t.sprint_id === sprint.id)
    // Fallback to all tasks when sprint_id isn't populated yet
    return linked.length > 0 ? linked : allTasks
  }, [allTasks, sprint])

  const inProgressCount = allMembers.filter(m =>
    allTasks.some(t => t.assigned_to === (m.user_id || m.id) && t.status === 'in_progress')
  ).length

  const sprintStart = sprint?.start_date
    ? new Date(sprint.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null
  const sprintEnd = sprint?.end_date
    ? new Date(sprint.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null

  if (loading) return (
    <div className="flex items-center justify-center py-32 gap-3" style={{ color: 'var(--ink-muted)' }}>
      <div className="w-6 h-6 rounded-full border-2 animate-spin"
        style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      <span className="text-sm">Loading teammates…</span>
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-up">

      {/* ── Hero ── */}
      <div className="rounded-3xl p-6 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(91,79,255,0.07) 0%, transparent 100%)', border: '1px solid var(--border)' }}>
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-10 pointer-events-none"
          style={{ background: 'var(--accent)', filter: 'blur(60px)' }} />
        <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] mb-1 font-semibold capitalize" style={{ color: 'var(--accent)' }}>
              {teamRole || 'Intern'} · {groupName}
            </p>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>Teammates</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>
              Colleagues sharing your <span className="font-semibold capitalize">{teamRole}</span> role. Their tasks, their progress.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-start shrink-0">
            {[
              { label: 'Members',    value: allMembers.length,    color: 'var(--ink)' },
              { label: 'Active Now', value: inProgressCount,      color: '#3b82f6'    },
              { label: 'Tasks',      value: allTasks.length,      color: 'var(--ink)' },
            ].map(({ label, value, color }) => (
              <div key={label} className="px-3 py-2 rounded-xl text-center"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-muted)' }}>{label}</p>
                <p className="text-lg font-bold" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#ef444412', color: '#ef4444', border: '1px solid #ef444428' }}>
          {error}
        </div>
      )}

      {/* ── Sprint banner ── */}
      {sprint ? (
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: '#00c89618', color: '#00c896' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              Active Sprint
            </div>
            <p className="font-bold text-sm" style={{ color: 'var(--ink)' }}>{sprint.title}</p>
            {sprintStart && sprintEnd && (
              <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>{sprintStart} → {sprintEnd}</p>
            )}
          </div>
          {sprint.description && (
            <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--ink-soft)' }}>{sprint.description}</p>
          )}
          {sprintTasks.length > 0 && (
            <div className="pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              <SprintSummaryBar tasks={sprintTasks} members={allMembers.length} />
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl px-5 py-4 text-sm"
          style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)', border: '1px solid var(--border)' }}>
          ⏸ No active sprint for your group right now.
        </div>
      )}

      {/* ── Search bar ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          Your Team{' '}
          <span className="font-normal" style={{ color: 'var(--ink-muted)' }}>
            · {filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''}
          </span>
        </p>
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by name…"
          className="px-3 py-2 rounded-xl text-sm outline-none"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink)', width: 200 }}
        />
      </div>

      {/* ── Empty state ── */}
      {!error && filteredMembers.length === 0 && (
        <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <p className="text-3xl mb-3">👥</p>
          <p className="font-semibold mb-1" style={{ color: 'var(--ink)' }}>
            {searchQuery ? 'No teammates match your search.' : 'No teammates found yet.'}
          </p>
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            We only show interns with your same role in your group. More will appear as the team assembles.
          </p>
        </div>
      )}

      {/* ── Member list (vertical, full width) ── */}
      {filteredMembers.length > 0 && (
        <div className="flex flex-col gap-4">
          {filteredMembers.map((member, i) => (
            <TeammateCard
              key={member.user_id}
              member={member}
              isYou={member.user_id === currentUserId}
              allTasks={allTasks}
              index={i}
            />
          ))}
        </div>
      )}
    </div>
  )
}