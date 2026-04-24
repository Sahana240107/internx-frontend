'use client'

import { TaskCard } from './TaskCard'

const COLUMNS = [
  { id: 'todo',        label: 'To Do',       dot: '#8888a0' },
  { id: 'in_progress', label: 'In Progress', dot: '#3b82f6' },
  { id: 'review',      label: 'In Review',   dot: '#f59e0b' },
  { id: 'done',        label: 'Done',        dot: '#00c896' },
]

export function SprintBoard({ tasks }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {COLUMNS.map(col => {
        const colTasks = tasks.filter(t => t.status === col.id)
        return (
          <div key={col.id} className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: col.dot }} />
                <span className="text-sm font-semibold font-display" style={{ color: 'var(--ink)' }}>{col.label}</span>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
                style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>
                {colTasks.length}
              </span>
            </div>
            <div className="flex flex-col gap-2 min-h-[120px] p-3 rounded-2xl"
              style={{ background: 'var(--surface-2)', border: '1.5px dashed var(--border)' }}>
              {colTasks.length === 0 ? (
                <div className="flex items-center justify-center h-20">
                  <span className="text-xs" style={{ color: 'var(--border-strong)' }}>No tasks</span>
                </div>
              ) : (
                colTasks.map(task => <TaskCard key={task.id} task={task} />)
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
