'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store/authStore'
import { taskApi } from '@/lib/taskApi'
import Link from 'next/link'

const STATUS_CONFIG = {
  todo:        { label: 'To Do',       color: '#8888a0', bg: 'var(--surface-2)',  dot: '#8888a0' },
  in_progress: { label: 'In Progress', color: '#3b82f6', bg: 'var(--blue-soft)',  dot: '#3b82f6' },
  review:      { label: 'In Review',   color: '#f59e0b', bg: 'var(--amber-soft)', dot: '#f59e0b' },
  done:        { label: 'Done',        color: '#00c896', bg: 'var(--green-soft)', dot: '#00c896' },
}

const PRIORITY_CONFIG = {
  low:    { label: 'Low',    color: '#8888a0', bg: 'var(--surface-2)'  },
  medium: { label: 'Medium', color: '#f59e0b', bg: 'var(--amber-soft)' },
  high:   { label: 'High',   color: '#ef4444', bg: 'var(--red-soft)'   },
}

const DIFFICULTY_CONFIG = {
  easy:   { label: 'Easy',   color: '#16a34a', bg: '#dcfce7' },
  medium: { label: 'Medium', color: '#d97706', bg: '#fef3c7' },
  hard:   { label: 'Hard',   color: '#dc2626', bg: '#fee2e2' },
}

// Status order for display: todo → in_progress → review → done
const STATUS_ORDER = ['todo', 'in_progress', 'review', 'done']

export default function TasksListPage() {
  const { user } = useAuthStore()
  const router   = useRouter()

  const [tasks,  setTasks]  = useState([])
  const [sprint, setSprint] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('all')

  const loadTasks = useCallback(async () => {
    try {
      const [tasksRes, sprintRes] = await Promise.all([
        taskApi.getMyTasks(),
        taskApi.getActiveSprint().catch(() => ({ data: [] })),
      ])

      const activeSprint = Array.isArray(sprintRes.data) ? (sprintRes.data[0] || null) : null
      const allTasks     = Array.isArray(tasksRes.data)  ? tasksRes.data : []

      setSprint(activeSprint)
      // my-tasks already filters to active sprint; double-filter client-side
      setTasks(
        activeSprint
          ? allTasks.filter(t => t.sprint_id === activeSprint.id)
          : allTasks
      )
    } catch (err) {
      console.error('Failed to load tasks', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) { router.push('/auth/login'); return }
    loadTasks()
  }, [user, loadTasks])

  // Only show the four canonical statuses
  const filtered = filter === 'all'
    ? tasks
    : tasks.filter(t => t.status === filter)

  // Sort by status order, then by created_at
  const sorted = [...filtered].sort((a, b) => {
    const si = STATUS_ORDER.indexOf(a.status)
    const sj = STATUS_ORDER.indexOf(b.status)
    if (si !== sj) return si - sj
    return new Date(a.created_at || 0) - new Date(b.created_at || 0)
  })

  const counts = {
    all:         tasks.length,
    todo:        tasks.filter(t => t.status === 'todo').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    review:      tasks.filter(t => t.status === 'review').length,
    done:        tasks.filter(t => t.status === 'done').length,
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface)' }}>
      <div className="w-8 h-8 rounded-full border-2 animate-spin"
        style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: 'var(--surface)' }}>
      {/* Navbar */}
      <header className="sticky top-0 z-40 px-6 h-16 flex items-center gap-4"
        style={{ background: 'rgba(248,248,252,0.8)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium"
          style={{ color: 'var(--ink-soft)' }}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Dashboard
        </Link>
        <div className="w-px h-4" style={{ background: 'var(--border)' }} />
        <span className="font-display font-bold" style={{ color: 'var(--ink)' }}>
          {sprint ? sprint.title : 'My Tasks'}
        </span>
        {sprint && (
          <span className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            🏃 ACTIVE SPRINT
          </span>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">

        {/* Sprint info banner */}
        {sprint && (
          <div className="card p-4 mb-6 flex items-center justify-between"
            style={{ background: 'linear-gradient(135deg, var(--accent-soft), white)', border: '1.5px solid var(--accent-light, rgba(91,79,255,0.2))' }}>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: 'var(--accent)' }}>
                Current Sprint
              </p>
              <p className="font-display font-bold text-sm" style={{ color: 'var(--ink)' }}>
                {sprint.title}
              </p>
              {sprint.start_date && sprint.end_date && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                  {new Date(sprint.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  {' → '}
                  {new Date(sprint.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-2xl font-display font-bold" style={{ color: 'var(--accent)' }}>
                {counts.done}/{counts.all}
              </p>
              <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>tasks done</p>
            </div>
          </div>
        )}

        {/* Filter tabs — only the four statuses + All */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit"
          style={{ background: 'var(--surface-2)' }}>
          {[
            { key: 'all',         label: `All (${counts.all})`                  },
            { key: 'todo',        label: `To Do (${counts.todo})`               },
            { key: 'in_progress', label: `In Progress (${counts.in_progress})`  },
            { key: 'review',      label: `Review (${counts.review})`            },
            { key: 'done',        label: `Done (${counts.done})`                },
          ].map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              className="px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200"
              style={{
                background: filter === tab.key ? 'white' : 'transparent',
                color:      filter === tab.key ? 'var(--ink)' : 'var(--ink-muted)',
                boxShadow:  filter === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Task list */}
        {sorted.length === 0 ? (
          <div className="card p-16 text-center">
            <div className="text-4xl mb-3">🎯</div>
            <h3 className="font-display font-bold mb-1" style={{ color: 'var(--ink)' }}>No tasks here</h3>
            <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
              {filter === 'all' ? 'No tasks assigned yet in this sprint' : `No "${filter.replace('_', ' ')}" tasks`}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sorted.map(task => {
              const status   = STATUS_CONFIG[task.status]     || STATUS_CONFIG.todo
              const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium
              const diff     = task.difficulty ? DIFFICULTY_CONFIG[task.difficulty] : null
              const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'
              const dueDate = task.due_date
                ? new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                : null

              return (
                <Link key={task.id} href={`/internship/tasks/${task.id}`}
                  className="card p-5 flex items-center gap-4 transition-all duration-200 hover:scale-[1.01]"
                  style={{ cursor: 'pointer' }}>

                  {/* Status dot */}
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: status.dot }} />

                  {/* Title + description */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--ink)' }}>{task.title}</p>
                    {task.description && (
                      <p className="text-xs truncate mt-0.5" style={{ color: 'var(--ink-muted)' }}>{task.description}</p>
                    )}
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {diff && (
                      <span className="text-xs px-2 py-0.5 rounded-lg font-semibold"
                        style={{ color: diff.color, background: diff.bg }}>
                        {diff.label}
                      </span>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded-lg font-semibold"
                      style={{ color: priority.color, background: priority.bg }}>
                      {priority.label}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-lg font-semibold"
                      style={{ color: status.color, background: status.bg }}>
                      {status.label}
                    </span>
                    {dueDate && (
                      <span className="text-xs font-medium"
                        style={{ color: isOverdue ? 'var(--red)' : 'var(--ink-muted)' }}>
                        {isOverdue ? '⚠ ' : ''}{dueDate}
                      </span>
                    )}
                    <svg className="w-4 h-4" style={{ color: 'var(--ink-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}