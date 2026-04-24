// StatusBadge.jsx
const STATUS_CONFIG = {
  todo:        { label: 'To Do',       color: '#8888a0', bg: 'var(--surface-2)' },
  in_progress: { label: 'In Progress', color: '#3b82f6', bg: 'var(--blue-soft)' },
  review:      { label: 'In Review',   color: '#f59e0b', bg: 'var(--amber-soft)' },
  done:        { label: 'Done',        color: '#00c896', bg: 'var(--green-soft)' },
}

const PRIORITY_CONFIG = {
  low:    { color: '#8888a0', bg: 'var(--surface-2)' },
  medium: { color: '#f59e0b', bg: 'var(--amber-soft)' },
  high:   { color: '#ef4444', bg: 'var(--red-soft)' },
  urgent: { color: '#dc2626', bg: '#fff1f1' },
}

export function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.todo
  return (
    <span className="badge" style={{ color: cfg.color, background: cfg.bg }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block mr-1" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  )
}

export function PriorityBadge({ priority }) {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium
  return (
    <span className="badge capitalize" style={{ color: cfg.color, background: cfg.bg }}>
      {priority}
    </span>
  )
}
