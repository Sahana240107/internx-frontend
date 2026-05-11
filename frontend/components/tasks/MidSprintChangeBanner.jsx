'use client'

/**
 * MidSprintChangeBanner
 * ──────────────────────
 * Shows a prominent warning banner when a task has been updated
 * due to a mid-sprint requirement change.
 *
 * Usage:
 *   <MidSprintChangeBanner task={task} />
 *
 * Shows only when task.mid_sprint_changed === true.
 */

import { useState } from 'react'

export function MidSprintChangeBanner({ task }) {
  const [dismissed, setDismissed] = useState(false)

  if (!task?.mid_sprint_changed || dismissed) return null

  const changedAt = task.mid_sprint_changed_at
    ? new Date(task.mid_sprint_changed_at).toLocaleString('en-IN', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    : null

  return (
    <div
      role="alert"
      style={{
        background: 'linear-gradient(135deg, #fff7ed 0%, #fff3e0 100%)',
        border: '2px solid #fb923c',
        borderRadius: '14px',
        padding: '16px 20px',
        marginBottom: '20px',
        position: 'relative',
      }}
    >
      {/* Dismiss button */}
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        style={{
          position: 'absolute', top: '12px', right: '14px',
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '18px', color: '#9a3412', lineHeight: 1,
        }}
      >
        ×
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <span style={{ fontSize: '22px' }}>⚠️</span>
        <div>
          <p style={{
            fontFamily: 'Syne, sans-serif', fontWeight: 700,
            fontSize: '15px', color: '#9a3412', margin: 0,
          }}>
            Mid-Sprint Requirement Change
          </p>
          {changedAt && (
            <p style={{ fontSize: '11px', color: '#c2410c', margin: 0 }}>
              Updated {changedAt}
            </p>
          )}
        </div>
      </div>

      {/* Body */}
      <p style={{ fontSize: '13px', color: '#7c2d12', margin: '0 0 8px', lineHeight: 1.5 }}>
        This task was <strong>completed</strong> but new requirements have been added by your team.
        Please re-read the updated description below and resume work.
      </p>

      {task.mid_sprint_change_reason && (
        <div style={{
          background: '#fed7aa', borderRadius: '8px',
          padding: '8px 12px', fontSize: '12px', color: '#7c2d12',
        }}>
          <strong>Reason:</strong> {task.mid_sprint_change_reason}
        </div>
      )}
    </div>
  )
}


/**
 * MidSprintChangeTag
 * ──────────────────
 * Small inline badge for task lists/cards to flag changed tasks.
 *
 * Usage:
 *   {task.mid_sprint_changed && <MidSprintChangeTag />}
 */
export function MidSprintChangeTag() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      background: '#fff7ed', border: '1.5px solid #fb923c',
      borderRadius: '20px', padding: '2px 8px',
      fontSize: '10px', fontWeight: 700, color: '#c2410c',
      whiteSpace: 'nowrap',
    }}>
      ⚠️ Changed
    </span>
  )
}