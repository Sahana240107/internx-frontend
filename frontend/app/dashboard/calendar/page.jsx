'use client'

import { useEffect, useState } from 'react'
import { taskApi } from '@/lib/taskApi'
import DashboardPanel from '@/components/team-hub/DashboardPanel'
import api from '@/lib/api'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const STATUS_CONFIG = {
  todo:        { label: 'To Do',       color: '#6b7280', bg: '#f3f4f6' },
  in_progress: { label: 'In Progress', color: '#3b82f6', bg: '#eff6ff' },
  review:      { label: 'Review',      color: '#f59e0b', bg: '#fffbeb' },
  done:        { label: 'Done',        color: '#00c896', bg: '#f0fdf4' },
}
const PRIORITY_CONFIG = {
  low:    { label: 'Low',    color: '#6b7280' },
  medium: { label: 'Medium', color: '#f59e0b' },
  high:   { label: 'High',   color: '#ef4444' },
}

// ── Event color theme (distinct purple/violet palette) ───────────────────────
const EVENT_COLOR   = '#7c3aed'
const EVENT_BG      = '#f5f3ff'
const EVENT_BORDER  = '#7c3aed30'

function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate() }
function getFirstDayOfMonth(year, month) { return new Date(year, month, 1).getDay() }
function toDateKey(isoString) { return isoString ? isoString.slice(0, 10) : null }

// ── Add-Event Modal ───────────────────────────────────────────────────────────
function AddEventModal({ defaultDate, onSave, onClose }) {
  const [title, setTitle]   = useState('')
  const [date,  setDate]    = useState(defaultDate || '')
  const [time,  setTime]    = useState('')
  const [notes, setNotes]   = useState('')
  const [err,   setErr]     = useState('')

  const handleSave = () => {
    if (!title.trim()) { setErr('Event title is required.'); return }
    if (!date)         { setErr('Please pick a date.'); return }
    onSave({ id: `evt-${Date.now()}`, title: title.trim(), date, time, notes })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="rounded-2xl p-6 shadow-2xl w-full max-w-sm mx-4"
        style={{ background: 'white', border: `2px solid ${EVENT_COLOR}40` }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: EVENT_COLOR }} />
            <h3 className="font-bold text-sm" style={{ color: 'var(--ink)' }}>New Event</h3>
          </div>
          <button onClick={onClose} className="text-sm" style={{ color: 'var(--ink-muted)' }}>✕</button>
        </div>

        <div className="space-y-3">
          {/* Title */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1"
              style={{ color: 'var(--ink-muted)' }}>Title *</label>
            <input
              value={title}
              onChange={e => { setTitle(e.target.value); setErr('') }}
              placeholder="e.g. Team standup, Doctor appt…"
              className="w-full text-sm px-3 py-2 rounded-xl outline-none"
              style={{
                border: `1.5px solid ${err && !title.trim() ? '#ef4444' : EVENT_COLOR + '50'}`,
                background: EVENT_BG,
                color: 'var(--ink)',
              }}
            />
          </div>

          {/* Date */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1"
              style={{ color: 'var(--ink-muted)' }}>Date *</label>
            <input
              type="date"
              value={date}
              onChange={e => { setDate(e.target.value); setErr('') }}
              className="w-full text-sm px-3 py-2 rounded-xl outline-none"
              style={{
                border: `1.5px solid ${EVENT_COLOR}50`,
                background: EVENT_BG,
                color: 'var(--ink)',
              }}
            />
          </div>

          {/* Time (optional) */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1"
              style={{ color: 'var(--ink-muted)' }}>Time <span className="font-normal normal-case">(optional)</span></label>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-xl outline-none"
              style={{ border: `1.5px solid ${EVENT_COLOR}50`, background: EVENT_BG, color: 'var(--ink)' }}
            />
          </div>

          {/* Notes (optional) */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1"
              style={{ color: 'var(--ink-muted)' }}>Notes <span className="font-normal normal-case">(optional)</span></label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Any extra details…"
              className="w-full text-sm px-3 py-2 rounded-xl outline-none resize-none"
              style={{ border: `1.5px solid ${EVENT_COLOR}50`, background: EVENT_BG, color: 'var(--ink)' }}
            />
          </div>

          {err && <p className="text-[11px] font-semibold" style={{ color: '#ef4444' }}>{err}</p>}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2 rounded-xl text-xs font-semibold hover:opacity-80"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink)' }}>
              Cancel
            </button>
            <button onClick={handleSave}
              className="flex-1 py-2 rounded-xl text-xs font-bold hover:opacity-90 transition-opacity"
              style={{ background: EVENT_COLOR, color: 'white' }}>
              Add Event
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Event Detail Modal ────────────────────────────────────────────────────────
function EventDetailModal({ event, onClose, onDelete }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="rounded-2xl p-6 shadow-2xl w-full max-w-sm mx-4"
        style={{ background: 'white', border: `2px solid ${EVENT_COLOR}40` }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3 gap-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: EVENT_COLOR }} />
            <h3 className="font-bold text-sm leading-snug" style={{ color: 'var(--ink)' }}>{event.title}</h3>
          </div>
          <button onClick={onClose} style={{ color: 'var(--ink-muted)' }}>✕</button>
        </div>
        <div className="ml-5 space-y-2">
          <span className="inline-block text-[11px] px-2 py-0.5 rounded-md font-bold"
            style={{ background: EVENT_BG, color: EVENT_COLOR, border: `1px solid ${EVENT_COLOR}40` }}>
            📅 Event
          </span>
          <div className="flex items-center gap-3">
            <span className="text-xs w-16 flex-shrink-0" style={{ color: 'var(--ink-muted)' }}>Date</span>
            <span className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
              {new Date(event.date + 'T00:00:00').toLocaleDateString('en-IN', {
                weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
              })}
            </span>
          </div>
          {event.time && (
            <div className="flex items-center gap-3">
              <span className="text-xs w-16 flex-shrink-0" style={{ color: 'var(--ink-muted)' }}>Time</span>
              <span className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{event.time}</span>
            </div>
          )}
          {event.notes && (
            <div className="flex items-start gap-3">
              <span className="text-xs w-16 flex-shrink-0" style={{ color: 'var(--ink-muted)' }}>Notes</span>
              <span className="text-xs leading-relaxed" style={{ color: 'var(--ink)' }}>{event.notes}</span>
            </div>
          )}
        </div>
        <div className="flex justify-end mt-4">
          <button onClick={() => { onDelete(event.id); onClose() }}
            className="text-xs px-3 py-1.5 rounded-xl font-semibold hover:opacity-80"
            style={{ background: '#fff5f5', color: '#ef4444', border: '1px solid #fca5a530' }}>
            Delete event
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const today = new Date()

  const [viewYear,    setViewYear]    = useState(today.getFullYear())
  const [viewMonth,   setViewMonth]   = useState(today.getMonth())
  const [tasks,       setTasks]       = useState([])
  const [events,      setEvents]      = useState(() => {
    try {
      const saved = localStorage.getItem('calendar_events')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })          // ← manual events, persisted to localStorage
  const [selected,    setSelected]    = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [detail,      setDetail]      = useState(null)        // task detail
  const [eventDetail, setEventDetail] = useState(null)        // event detail
  const [showAddEvt,  setShowAddEvt]  = useState(false)       // add-event modal

  // Persist events to localStorage whenever they change
  useEffect(() => {
    try { localStorage.setItem('calendar_events', JSON.stringify(events)) } catch { /* ignore */ }
  }, [events])

  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true); setError(null)
      try {
        const res  = await taskApi.getMyTasks()
        const raw  = res.data
        const list = Array.isArray(raw) ? raw : (raw?.tasks || raw?.data || [])
        setTasks(list.filter(t => t.due_date))
      } catch (err) {
        console.error('Failed to load tasks:', err)
        setError('Could not load tasks. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    fetchTasks()
  }, [])

  // Group tasks by date key
  const tasksByDate = tasks.reduce((acc, t) => {
    const key = toDateKey(t.due_date)
    if (!key) return acc
    acc[key] = acc[key] ? [...acc[key], t] : [t]
    return acc
  }, {})

  // Group events by date key
  const eventsByDate = events.reduce((acc, e) => {
    if (!e.date) return acc
    acc[e.date] = acc[e.date] ? [...acc[e.date], e] : [e]
    return acc
  }, {})

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }
  const goToday = () => {
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
    setSelected(today.toISOString().slice(0, 10))
  }

  const dateKey = (day) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const isToday = (day) =>
    today.getFullYear() === viewYear &&
    today.getMonth()    === viewMonth &&
    today.getDate()     === day

  // Build grid
  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDayIdx = getFirstDayOfMonth(viewYear, viewMonth)
  const cells = []
  for (let i = 0; i < firstDayIdx; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const selectedTasks  = selected ? (tasksByDate[selected]  || []) : []
  const selectedEvents = selected ? (eventsByDate[selected] || []) : []
  const monthPrefix    = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`
  const monthTasks     = tasks.filter(t => toDateKey(t.due_date)?.startsWith(monthPrefix))
  const monthEvents    = events.filter(e => e.date?.startsWith(monthPrefix))
  const statusCounts   = monthTasks.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1; return acc
  }, {})
  const todayKey     = today.toISOString().slice(0, 10)
  const overdueTasks = tasks.filter(t => {
    const d = toDateKey(t.due_date)
    return d && d < todayKey && t.status !== 'done'
  })

  const handleAddEvent = async (evt) => {
    // 1. Save to local state + localStorage (existing behaviour)
    const updatedEvents = [...events, evt]
    setEvents(updatedEvents)
    setShowAddEvt(false)
    setSelected(evt.date)

    // 2. Push a notification to the backend so the bell lights up
    const today = new Date().toISOString().slice(0, 10)
    if (evt.date === today) {
      // Count all today's events after adding this one
      const todayCount = updatedEvents.filter(e => e.date === today).length
      try {
        await api.post('/api/notifications/push', {
          user_id: null,   // backend will use current_user from the auth token
          key:     'calendar',
          type_:   'calendar',
          title:   `${todayCount} event${todayCount > 1 ? 's' : ''} today`,
          body:    evt.title + (todayCount > 1 ? ` and ${todayCount - 1} more` : ''),
          icon:    '📅',
          href:    '/dashboard/calendar',
          count:   todayCount,
        })
      } catch (e) {
        console.warn('Failed to push calendar notification:', e)
      }
    }
  }

  const handleDeleteEvent = (id) => {
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <DashboardPanel
        title="Calendar"
        description="Your assigned tasks plotted by due date. Click any date to see details."
      >
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <div className="w-5 h-5 rounded-full border-2 animate-spin"
              style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
            <span className="text-sm" style={{ color: 'var(--ink-muted)' }}>Loading your tasks…</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-sm font-semibold" style={{ color: '#ef4444' }}>{error}</p>
          </div>
        ) : (
          <div className="flex gap-5 flex-col lg:flex-row">

            {/* ── Calendar grid ──────────────────────────────────────────── */}
            <div className="flex-1 min-w-0">

              {/* Nav */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <button onClick={prevMonth}
                    className="w-8 h-8 rounded-xl flex items-center justify-center hover:opacity-70 transition-opacity"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink)' }}>
                    ‹
                  </button>
                  <h2 className="text-base font-bold min-w-[150px] text-center" style={{ color: 'var(--ink)' }}>
                    {MONTHS[viewMonth]} {viewYear}
                  </h2>
                  <button onClick={nextMonth}
                    className="w-8 h-8 rounded-xl flex items-center justify-center hover:opacity-70 transition-opacity"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink)' }}>
                    ›
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowAddEvt(true)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold hover:opacity-80 flex items-center gap-1"
                    style={{ background: EVENT_BG, border: `1.5px solid ${EVENT_COLOR}50`, color: EVENT_COLOR }}>
                    + Event
                  </button>
                  <button onClick={goToday}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold hover:opacity-80"
                    style={{ background: 'var(--accent)', color: 'white' }}>
                    Today
                  </button>
                </div>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {DAYS.map(d => (
                  <div key={d} className="text-center text-[11px] font-bold uppercase tracking-wider pb-2"
                    style={{ color: 'var(--ink-muted)' }}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Cells */}
              <div className="grid grid-cols-7 gap-1">
                {cells.map((day, idx) => {
                  if (!day) return <div key={`blank-${idx}`} className="min-h-[76px]" />
                  const key       = dateKey(day)
                  const dayTasks  = tasksByDate[key]  || []
                  const dayEvents = eventsByDate[key] || []
                  const isTd      = isToday(day)
                  const isSel     = selected === key

                  // Combined visible items: tasks first (up to 2), then events, capped at 3 total
                  const maxVisible = 3
                  const visibleTasks  = dayTasks.slice(0, Math.min(2, maxVisible))
                  const remainSlots   = maxVisible - visibleTasks.length
                  const visibleEvents = dayEvents.slice(0, remainSlots)
                  const extraCount    = (dayTasks.length - visibleTasks.length) + (dayEvents.length - visibleEvents.length)

                  return (
                    <div key={key}
                      onClick={() => setSelected(isSel ? null : key)}
                      className="min-h-[76px] rounded-xl p-1.5 cursor-pointer transition-all"
                      style={{
                        background: isSel ? '#ede9fe' : isTd ? '#f0fdf4' : 'var(--surface-2)',
                        border:     isSel ? '1.5px solid #5b4fff'
                                  : isTd ? '1.5px solid #00c896'
                                  : '1px solid var(--border)',
                      }}>
                      <span className="text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full mb-1"
                        style={{
                          background: isTd ? '#00c896' : 'transparent',
                          color:      isTd ? 'white' : isSel ? '#5b4fff' : 'var(--ink)',
                        }}>
                        {day}
                      </span>
                      <div className="space-y-0.5">
                        {/* Task chips */}
                        {visibleTasks.map(t => {
                          const sc = STATUS_CONFIG[t.status] || STATUS_CONFIG.todo
                          return (
                            <div key={t.id}
                              onClick={e => { e.stopPropagation(); setDetail(t) }}
                              className="text-[10px] px-1.5 py-0.5 rounded-md truncate leading-tight font-medium"
                              style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.color}30` }}>
                              {t.title}
                            </div>
                          )
                        })}
                        {/* Event chips — distinct purple style */}
                        {visibleEvents.map(ev => (
                          <div key={ev.id}
                            onClick={e => { e.stopPropagation(); setEventDetail(ev) }}
                            className="text-[10px] px-1.5 py-0.5 rounded-md truncate leading-tight font-medium flex items-center gap-0.5"
                            style={{ background: EVENT_BG, color: EVENT_COLOR, border: `1px solid ${EVENT_COLOR}30` }}>
                            <span className="text-[9px]">●</span>
                            {ev.title}
                          </div>
                        ))}
                        {extraCount > 0 && (
                          <div className="text-[9px] font-semibold" style={{ color: 'var(--ink-muted)' }}>
                            +{extraCount} more
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-3 mt-3 items-center">
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: v.bg, border: `1px solid ${v.color}50` }} />
                    <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{v.label}</span>
                  </div>
                ))}
                {/* Event legend entry */}
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: EVENT_BG, border: `1px solid ${EVENT_COLOR}50` }} />
                  <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>Event</span>
                </div>
              </div>

              {tasks.length === 0 && events.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 gap-2 mt-4 rounded-2xl"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <p className="text-2xl">📋</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>No tasks assigned yet</p>
                  <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>Tasks assigned to you with a due date will appear here.</p>
                </div>
              )}
            </div>

            {/* ── Sidebar ────────────────────────────────────────────────── */}
            <div className="w-full lg:w-72 flex-shrink-0 space-y-4">

              {/* Selected day panel */}
              <div className="rounded-2xl p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--ink-muted)' }}>
                    {selected
                      ? new Date(selected + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
                      : 'Select a date'}
                  </p>
                  {selected && (
                    <button
                      onClick={() => setShowAddEvt(true)}
                      className="text-[11px] font-semibold px-2 py-1 rounded-lg hover:opacity-80 flex items-center gap-1"
                      style={{ background: EVENT_BG, color: EVENT_COLOR, border: `1px solid ${EVENT_COLOR}40` }}>
                      + Event
                    </button>
                  )}
                </div>

                {!selected && (
                  <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>Click a calendar date to view its tasks.</p>
                )}
                {selected && selectedTasks.length === 0 && selectedEvents.length === 0 && (
                  <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>No tasks or events on this date.</p>
                )}

                <div className="space-y-2">
                  {/* Task items */}
                  {selectedTasks.map(task => {
                    const sc = STATUS_CONFIG[task.status]     || STATUS_CONFIG.todo
                    const pc = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium
                    return (
                      <div key={task.id}
                        onClick={() => setDetail(task)}
                        className="rounded-xl px-3 py-2.5 cursor-pointer hover:opacity-80 transition-opacity"
                        style={{ background: 'white', border: `1.5px solid ${sc.color}30` }}>
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: sc.color }} />
                          <p className="flex-1 text-xs font-semibold leading-snug" style={{ color: 'var(--ink)' }}>
                            {task.title}
                          </p>
                        </div>
                        <div className="flex gap-1.5 mt-1.5 ml-4">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
                            style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
                            style={{ background: pc.color + '15', color: pc.color }}>{pc.label}</span>
                        </div>
                      </div>
                    )
                  })}

                  {/* Event items — purple style */}
                  {selectedEvents.map(ev => (
                    <div key={ev.id}
                      onClick={() => setEventDetail(ev)}
                      className="rounded-xl px-3 py-2.5 cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ background: EVENT_BG, border: `1.5px solid ${EVENT_COLOR}30` }}>
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: EVENT_COLOR }} />
                        <p className="flex-1 text-xs font-semibold leading-snug" style={{ color: EVENT_COLOR }}>
                          {ev.title}
                        </p>
                      </div>
                      <div className="flex gap-1.5 mt-1.5 ml-4 items-center">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
                          style={{ background: 'white', color: EVENT_COLOR, border: `1px solid ${EVENT_COLOR}30` }}>
                          📅 Event
                        </span>
                        {ev.time && (
                          <span className="text-[10px] font-medium" style={{ color: EVENT_COLOR + 'cc' }}>
                            {ev.time}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Month summary */}
              <div className="rounded-2xl p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--ink-muted)' }}>
                  {MONTHS[viewMonth]} · {monthTasks.length} task{monthTasks.length !== 1 ? 's' : ''}
                  {monthEvents.length > 0 && `, ${monthEvents.length} event${monthEvents.length !== 1 ? 's' : ''}`}
                </p>
                {monthTasks.length === 0 && monthEvents.length === 0
                  ? <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>No tasks or events this month.</p>
                  : <>
                      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                        const count = statusCounts[key] || 0
                        if (!count) return null
                        return (
                          <div key={key} className="flex items-center gap-2 mb-1.5">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                            <span className="text-xs flex-1" style={{ color: 'var(--ink)' }}>{cfg.label}</span>
                            <span className="text-xs font-bold" style={{ color: cfg.color }}>{count}</span>
                          </div>
                        )
                      })}
                      {monthEvents.length > 0 && (
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: EVENT_COLOR }} />
                          <span className="text-xs flex-1" style={{ color: 'var(--ink)' }}>Events</span>
                          <span className="text-xs font-bold" style={{ color: EVENT_COLOR }}>{monthEvents.length}</span>
                        </div>
                      )}
                    </>
                }
              </div>

              {/* Overdue */}
              {overdueTasks.length > 0 && (
                <div className="rounded-2xl p-4" style={{ background: '#fff5f5', border: '1px solid #fca5a5' }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#ef4444' }}>
                    ⚠ Overdue · {overdueTasks.length}
                  </p>
                  <div className="space-y-1.5">
                    {overdueTasks.slice(0, 5).map(t => (
                      <div key={t.id} onClick={() => setDetail(t)}
                        className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#ef4444' }} />
                        <span className="text-xs flex-1 truncate font-medium" style={{ color: '#1a1a2e' }}>{t.title}</span>
                        <span className="text-[10px] flex-shrink-0" style={{ color: '#ef4444' }}>
                          {new Date(t.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </DashboardPanel>

      {/* ── Task detail modal ─────────────────────────────────────────────── */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={() => setDetail(null)}>
          <div className="rounded-2xl p-6 shadow-2xl w-full max-w-sm mx-4"
            style={{ background: 'white', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3 gap-3">
              <h3 className="font-bold text-sm leading-snug" style={{ color: 'var(--ink)' }}>{detail.title}</h3>
              <button onClick={() => setDetail(null)} style={{ color: 'var(--ink-muted)' }}>✕</button>
            </div>
            {detail.description && (
              <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--ink-muted)' }}>{detail.description}</p>
            )}
            <div className="space-y-2.5">
              {[
                { label: 'Status',   cfg: STATUS_CONFIG[detail.status],       isBg: true  },
                { label: 'Priority', cfg: PRIORITY_CONFIG[detail.priority],   isBg: false },
              ].map(row => (
                <div key={row.label} className="flex items-center gap-3">
                  <span className="text-xs w-16 flex-shrink-0" style={{ color: 'var(--ink-muted)' }}>{row.label}</span>
                  <span className="text-xs px-2 py-0.5 rounded-lg font-semibold"
                    style={{ background: row.isBg ? row.cfg?.bg : row.cfg?.color + '18', color: row.cfg?.color }}>
                    {row.cfg?.label}
                  </span>
                </div>
              ))}
              {detail.due_date && (
                <div className="flex items-center gap-3">
                  <span className="text-xs w-16 flex-shrink-0" style={{ color: 'var(--ink-muted)' }}>Due</span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                    {new Date(detail.due_date).toLocaleDateString('en-IN', {
                      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Event detail modal ────────────────────────────────────────────── */}
      {eventDetail && (
        <EventDetailModal
          event={eventDetail}
          onClose={() => setEventDetail(null)}
          onDelete={handleDeleteEvent}
        />
      )}

      {/* ── Add event modal ───────────────────────────────────────────────── */}
      {showAddEvt && (
        <AddEventModal
          defaultDate={selected || ''}
          onSave={handleAddEvent}
          onClose={() => setShowAddEvt(false)}
        />
      )}
    </div>
  )
}