'use client'

import { useRouter } from 'next/navigation'
import { StatusBadge, PriorityBadge } from './StatusBadge'
import { MidSprintChangeTag } from './MidSprintChangeBanner'

export function TaskCard({ task }) {
  const router = useRouter()
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'

  return (
    <div
      onClick={() => router.push(`/internship/tasks/${task.id}`)}
      className="p-4 rounded-2xl cursor-pointer transition-all duration-200"
      style={{
        background: task.mid_sprint_changed ? '#fff7ed' : 'white',
        border: `1.5px solid ${task.mid_sprint_changed ? '#fb923c' : 'var(--border)'}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = task.mid_sprint_changed ? '#ea580c' : 'var(--accent)'
        e.currentTarget.style.transform   = 'translateY(-2px)'
        e.currentTarget.style.boxShadow   = '0 4px 16px rgba(91,79,255,0.1)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = task.mid_sprint_changed ? '#fb923c' : 'var(--border)'
        e.currentTarget.style.transform   = 'translateY(0)'
        e.currentTarget.style.boxShadow   = '0 1px 3px rgba(0,0,0,0.04)'
      }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-sm leading-snug line-clamp-2"
          style={{ color: 'var(--ink)', fontFamily: 'Syne, sans-serif' }}>
          {task.title}
        </h3>
        <div className="flex items-center gap-1 flex-shrink-0">
          {task.mid_sprint_changed && <MidSprintChangeTag />}
          <StatusBadge status={task.status} />
        </div>
      </div>
      <p className="text-xs line-clamp-2 mb-3" style={{ color: 'var(--ink-muted)' }}>{task.description}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PriorityBadge priority={task.priority} />
          <span className="text-xs capitalize" style={{ color: 'var(--ink-muted)' }}>{task.intern_role}</span>
        </div>
        <div className="flex items-center gap-2">
          {task.score != null && (
            <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>{task.score}/100</span>
          )}
          {task.due_date && (
            <span className="text-xs" style={{ color: isOverdue ? 'var(--red)' : 'var(--ink-muted)' }}>
              {isOverdue ? '⚠ ' : ''}{new Date(task.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}