'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import api from '@/lib/api'

const POLL_MS = 30_000

const TYPE_STYLES = {
  chat:     { accent: '#5b4fff', bg: 'rgba(91,79,255,0.08)',  border: 'rgba(91,79,255,0.18)' },
  calendar: { accent: '#7c3aed', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.18)' },
  ticket:   { accent: '#00c896', bg: 'rgba(0,200,150,0.08)',  border: 'rgba(0,200,150,0.18)' },
}

function timeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 60_000)     return 'just now'
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

export default function NotificationBell() {
  const router              = useRouter()
  const [notifs, setNotifs] = useState([])
  const [open, setOpen]     = useState(false)
  const [loading, setLoading] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 })
  const bellRef = useRef(null)
  const dropRef = useRef(null)
  const pollRef = useRef(null)

  const fetchNotifs = useCallback(async () => {
    try {
      const { data } = await api.get('/api/notifications')
      setNotifs(data ?? [])
    } catch { /* silent — non-critical */ }
  }, [])

  // Initial load + poll
  useEffect(() => {
    fetchNotifs()
    pollRef.current = setInterval(fetchNotifs, POLL_MS)
    return () => clearInterval(pollRef.current)
  }, [fetchNotifs])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (bellRef.current?.contains(e.target)) return
      if (dropRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Pin dropdown position to bell on scroll / resize
  useEffect(() => {
    if (!open) return
    const reposition = () => {
      if (!bellRef.current) return
      const r = bellRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + 8, right: window.innerWidth - r.right })
    }
    reposition()
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open])

  const handleOpen = async () => {
    if (!open && bellRef.current) {
      const r = bellRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + 8, right: window.innerWidth - r.right })
    }
    setOpen(o => !o)
    if (!open) await fetchNotifs()
  }

  const handleClickNotif = async (notif) => {
    setLoading(true)
    // Optimistically remove from UI
    setNotifs(prev => prev.filter(n => n.id !== notif.id))

    try {
      await api.post('/api/notifications/mark-read', { ids: [notif.id] })
    } catch { /* non-fatal */ }
    finally { setLoading(false) }

    setOpen(false)
    router.push(notif.href)
  }

  const handleMarkAll = async () => {
    setLoading(true)
    const ids = notifs.map(n => n.id)
    // Optimistically clear UI
    setNotifs([])

    try {
      await api.post('/api/notifications/mark-read', { ids })
    } catch { /* non-fatal */ }
    finally { setLoading(false) }

    setOpen(false)
  }

  const count = notifs.length

  const dropdown = (
    <div
      ref={dropRef}
      style={{
        position: 'fixed',
        top: dropPos.top,
        right: dropPos.right,
        width: 340,
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 16,
        overflow: 'hidden',
        zIndex: 99999,
        boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)',
        animation: 'notif-drop 0.18s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      <style>{`
        @keyframes notif-drop {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '10px 16px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#f8f8fc',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>Notifications</span>
          {count > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 6px',
              borderRadius: 999, background: 'rgba(91,79,255,0.1)', color: '#5b4fff',
            }}>{count}</span>
          )}
        </div>
        {count > 0 && (
          <button onClick={handleMarkAll} disabled={loading} style={{
            fontSize: 11, fontWeight: 600, color: '#5b4fff',
            background: 'none', border: 'none', cursor: 'pointer',
            opacity: loading ? 0.4 : 1,
          }}>
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div style={{ maxHeight: 380, overflowY: 'auto', backgroundColor: '#ffffff' }}>
        {count === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '40px 24px', gap: 8,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, fontSize: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#f8f8fc',
            }}>🔔</div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#111', margin: 0 }}>All caught up!</p>
            <p style={{ fontSize: 11, color: '#888', margin: 0, textAlign: 'center' }}>
              No new notifications right now.
            </p>
          </div>
        ) : (
          notifs.map((n, i) => {
            const s = TYPE_STYLES[n.type] ?? TYPE_STYLES.chat
            return (
              <button
                key={n.id}
                onClick={() => handleClickNotif(n)}
                style={{
                  width: '100%', textAlign: 'left', padding: '12px 16px',
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  border: 'none',
                  borderBottom: i < notifs.length - 1 ? '1px solid #e5e7eb' : 'none',
                  backgroundColor: '#ffffff', cursor: 'pointer', transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9f9fb'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ffffff'}
              >
                <div style={{
                  flexShrink: 0, width: 36, height: 36, borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, marginTop: 2, background: s.bg, border: `1px solid ${s.border}`,
                }}>
                  {n.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#111', margin: '0 0 2px', lineHeight: 1.4 }}>
                    {n.title}
                  </p>
                  <p style={{
                    fontSize: 11, color: '#666', margin: 0, lineHeight: 1.5,
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>
                    {n.body}
                  </p>
                  <p style={{ fontSize: 10, marginTop: 4, fontWeight: 500, color: s.accent }}>
                    {timeAgo(n.created_at)}
                  </p>
                </div>
                {n.count > 1 && (
                  <span style={{
                    flexShrink: 0, alignSelf: 'center', fontSize: 10, fontWeight: 700,
                    padding: '2px 6px', borderRadius: 999,
                    background: s.bg, color: s.accent, border: `1px solid ${s.border}`,
                  }}>{n.count}</span>
                )}
              </button>
            )
          })
        )}
      </div>

      {/* Footer */}
      {count > 0 && (
        <div style={{
          padding: '8px 16px', textAlign: 'center',
          borderTop: '1px solid #e5e7eb', backgroundColor: '#f8f8fc',
        }}>
          <button onClick={() => { setOpen(false); router.push('/dashboard') }} style={{
            fontSize: 11, fontWeight: 600, color: '#888',
            background: 'none', border: 'none', cursor: 'pointer',
          }}>
            View dashboard →
          </button>
        </div>
      )}
    </div>
  )

  return (
    <>
      <button
        ref={bellRef}
        onClick={handleOpen}
        aria-label="Notifications"
        className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-105"
        style={{
          background: open ? 'rgba(91,79,255,0.1)' : 'var(--surface-2)',
          border: `1px solid ${open ? 'rgba(91,79,255,0.3)' : 'var(--border)'}`,
          color: open ? '#5b4fff' : 'var(--ink-muted)',
        }}
      >
        <svg viewBox="0 0 24 24" width={18} height={18} fill="none"
          stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {count > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full flex items-center justify-center text-white font-bold"
            style={{
              fontSize: 9, padding: '0 3px',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              boxShadow: '0 1px 4px rgba(239,68,68,0.5)',
            }}
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && typeof document !== 'undefined' && createPortal(dropdown, document.body)}
    </>
  )
}