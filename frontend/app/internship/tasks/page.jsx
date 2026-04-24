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
  urgent: { label: 'Urgent', color: '#dc2626', bg: '#fff1f1'           },
}

export default function TasksListPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [tasks,   setTasks]   = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('all')

  const loadTasks = useCallback(async (signal) => {
    try {
      const res = await taskApi.getMyTasks()
      if (signal?.aborted) return
      setTasks(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      if (err?.name === 'AbortError') return
      console.error('Failed to load tasks', err)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) { router.push('/auth/login'); return }

    const controller = new AbortController()
    loadTasks(controller.signal)

    return () => controller.abort()
  }, [user, loadTasks])

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter)

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
        <span className="font-display font-bold" style={{ color: 'var(--ink)' }}>All Tasks</span>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">

        {/* Filter tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit"
          style={{ background: 'var(--surface-2)' }}>
          {[
            { key: 'all',        label: `All (${counts.all})`                     },
            { key: 'todo',       label: `To Do (${counts.todo})`                  },
            { key: 'in_progress',label: `In Progress (${counts.in_progress})`     },
            { key: 'review',     label: `Review (${counts.review})`               },
            { key: 'done',       label: `Done (${counts.done})`                   },
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
        {filtered.length === 0 ? (
          <div className="card p-16 text-center">
            <div className="text-4xl mb-3">🎯</div>
            <h3 className="font-display font-bold mb-1" style={{ color: 'var(--ink)' }}>No tasks here</h3>
            <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
              {filter === 'all' ? 'No tasks assigned yet' : `No tasks with status "${filter}"`}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(task => {
              const status   = STATUS_CONFIG[task.status]     || STATUS_CONFIG.todo
              const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium
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