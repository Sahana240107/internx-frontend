'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/lib/store/authStore'
import { taskApi } from '@/lib/taskApi'
import { toast } from 'sonner'
import Link from 'next/link'
import Image from 'next/image'
import api from '@/lib/api'
import NotificationBell from '@/components/NotificationBell'
// ─── Configs ────────────────────────────────────────────────────────────────

const ROLE_CONFIG = {
  frontend:  { label: 'Frontend',   color: '#5b4fff', bg: '#ede9ff',  icon: '⚡' },
  backend:   { label: 'Backend',    color: '#3b82f6', bg: '#eff6ff',  icon: '⚙️' },
  fullstack: { label: 'Full Stack', color: '#f59e0b', bg: '#fffbeb',  icon: '🔥' },
  devops:    { label: 'DevOps',     color: '#00c896', bg: '#e0fff7',  icon: '🚀' },
  design:    { label: 'Design',     color: '#ec4899', bg: '#fdf2f8',  icon: '✦'  },
  tester:    { label: 'QA/Tester',  color: '#8b5cf6', bg: '#f5f3ff',  icon: '🧪' },
}

const STATUS_CONFIG = {
  todo:        { label: 'To Do',       color: 'var(--ink-muted)', bg: 'var(--surface-2)',  dot: '#8888a0' },
  in_progress: { label: 'In Progress', color: '#3b82f6',          bg: 'var(--blue-soft)',  dot: '#3b82f6' },
  review:      { label: 'In Review',   color: 'var(--amber)',     bg: 'var(--amber-soft)', dot: '#f59e0b' },
  done:        { label: 'Done',        color: 'var(--green)',     bg: 'var(--green-soft)', dot: '#00c896' },
}

const PRIORITY_CONFIG = {
  low:    { label: 'Low',    color: 'var(--ink-muted)', bg: 'var(--surface-2)' },
  medium: { label: 'Medium', color: 'var(--amber)',     bg: 'var(--amber-soft)' },
  high:   { label: 'High',   color: 'var(--red)',       bg: 'var(--red-soft)' },
}

// ─── Side nav items ──────────────────────────────────────────────────────────

const SIDE_NAV = [
  {
    href: '/dashboard',
    label: 'Workspace',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="20" height="20">
        <rect x="2" y="2" width="7" height="7" rx="1.5" />
        <rect x="11" y="2" width="7" height="7" rx="1.5" />
        <rect x="2" y="11" width="7" height="7" rx="1.5" />
        <rect x="11" y="11" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    href: '/dashboard/guide',
    label: 'Guide',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="20" height="20">
        <path d="M4 4h12M4 8h8M4 12h10M4 16h6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/teammates',
    label: 'Team Progress',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="20" height="20">
        <circle cx="7" cy="7" r="3" />
        <circle cx="13" cy="7" r="3" />
        <path d="M1 17c0-3 2.5-5 6-5M13 12c3.5 0 6 2 6 5" strokeLinecap="round" />
        <path d="M7 12c3.5 0 6 2 6 5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/calendar',
    label: 'Calendar',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="20" height="20">
        <rect x="2" y="3" width="16" height="15" rx="2" />
        <path d="M6 2v2M14 2v2M2 8h16" strokeLinecap="round" />
        <circle cx="7" cy="12" r="1" fill="currentColor" />
        <circle cx="10" cy="12" r="1" fill="currentColor" />
        <circle cx="13" cy="12" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: '/dashboard/chat',
    label: 'Connect',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="20" height="20">
        <path d="M3 4h14a1 1 0 011 1v8a1 1 0 01-1 1H6l-4 3V5a1 1 0 011-1z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/standup',
    label: 'Standup',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ width: 20, height: 20 }}>
        <path d="M10 3v7l4 2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="10" cy="10" r="8" />
      </svg>
    ),
  },
  {
    href: '/dashboard/review',
    label: 'Review',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="20" height="20">
        <path d="M5 10l3.5 3.5L15 7" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="10" cy="10" r="8" />
      </svg>
    ),
  },
  {
    href: '/dashboard/ticket',
    label: 'Ticket',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="20" height="20">
        <path d="M2 7h16M2 13h16" strokeLinecap="round" />
        <rect x="2" y="4" width="16" height="12" rx="2" />
        <path d="M8 4v12" strokeLinecap="round" strokeDasharray="2 2" />
      </svg>
    ),
  },
]

// ─── InternX SVG Logo ────────────────────────────────────────────────────────

function InternXLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="28" height="28" rx="7" fill="url(#ix-grad)" />
      <path d="M8 8l12 12M20 8L8 20" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
      <defs>
        <linearGradient id="ix-grad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5b4fff" />
          <stop offset="1" stopColor="#8b7fff" />
        </linearGradient>
      </defs>
    </svg>
  )
}

// ─── Floating Side Panel ─────────────────────────────────────────────────────

function FloatingSidePanel() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <>
      <style>{`
        .side-panel-track {
          position: fixed;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          z-index: 50;
          display: flex;
          align-items: flex-start;
        }

        /* Icon strip — always visible, clear background */
        .side-panel-icons {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding: 10px 7px;
          border-radius: 0 18px 18px 0;
          background: rgba(255,255,255,0.55);
          backdrop-filter: blur(20px) saturate(1.5);
          -webkit-backdrop-filter: blur(20px) saturate(1.5);
          border: 1px solid rgba(91,79,255,0.08);
          border-left: none;
          box-shadow: 2px 0 20px rgba(91,79,255,0.07), 0 2px 12px rgba(0,0,0,0.04);
          transition: box-shadow 0.2s;
        }

        /* InternX logo toggle */
        .ix-toggle {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border: none;
          margin-bottom: 4px;
          background: transparent;
          transition: transform 0.18s, opacity 0.18s;
          padding: 0;
          flex-shrink: 0;
        }
        .ix-toggle:hover { transform: scale(1.08); }

        .side-divider {
          width: 22px;
          height: 1px;
          background: rgba(91,79,255,0.1);
          margin: 3px auto;
        }

        /* Individual nav icon buttons */
        .side-icon-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.14s, color 0.14s, transform 0.14s;
          cursor: pointer;
          border: none;
          outline: none;
          background: transparent;
          color: #9ea3ae;
          position: relative;
          text-decoration: none;
        }
        .side-icon-btn:hover {
          background: rgba(91,79,255,0.08);
          color: var(--accent);
          transform: translateX(2px);
        }
        .side-icon-btn.active {
          background: rgba(91,79,255,0.10);
          color: var(--accent);
        }
        .side-icon-btn.active::before {
          content: '';
          position: absolute;
          left: -7px;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 18px;
          border-radius: 2px;
          background: var(--accent);
        }

        /* Tooltip label on hover */
        .side-icon-btn .side-tooltip {
          position: absolute;
          left: calc(100% + 12px);
          top: 50%;
          transform: translateY(-50%);
          background: rgba(20,18,40,0.90);
          color: white;
          font-size: 11.5px;
          font-weight: 500;
          padding: 4px 9px;
          border-radius: 7px;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.15s;
          z-index: 200;
          letter-spacing: 0.01em;
        }
        .side-icon-btn:hover .side-tooltip { opacity: 1; }

        /* Expanded panel (slides in from left beside icon strip) */
        .side-panel-expanded {
          position: absolute;
          left: 52px;
          top: 50%;
          transform: translateY(-50%);
          width: 210px;
          padding: 10px 8px;
          border-radius: 16px;
          background: rgba(255,255,255,0.90);
          backdrop-filter: blur(24px) saturate(1.6);
          -webkit-backdrop-filter: blur(24px) saturate(1.6);
          border: 1px solid rgba(91,79,255,0.10);
          box-shadow: 6px 0 40px rgba(91,79,255,0.10), 0 4px 20px rgba(0,0,0,0.07);
          animation: slideInPanel 0.22s cubic-bezier(0.34,1.3,0.64,1);
          z-index: 49;
        }
        @keyframes slideInPanel {
          from { opacity: 0; transform: translateY(-50%) translateX(-10px); }
          to   { opacity: 1; transform: translateY(-50%) translateX(0); }
        }

        .panel-brand {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 4px 8px 10px;
          border-bottom: 1px solid rgba(91,79,255,0.08);
          margin-bottom: 6px;
        }

        .panel-nav-item {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 8px 10px;
          border-radius: 10px;
          text-decoration: none;
          color: #6b7280;
          font-size: 13px;
          font-weight: 500;
          transition: background 0.12s, color 0.12s;
          margin-bottom: 1px;
        }
        .panel-nav-item:hover {
          background: rgba(91,79,255,0.07);
          color: var(--accent);
        }
        .panel-nav-item.active {
          background: rgba(91,79,255,0.09);
          color: var(--accent);
          font-weight: 600;
        }
        .panel-nav-icon {
          flex-shrink: 0;
          opacity: 0.65;
        }
        .panel-nav-item.active .panel-nav-icon,
        .panel-nav-item:hover .panel-nav-icon { opacity: 1; }
      `}</style>

      <div className="side-panel-track" ref={panelRef}>
        {/* Icon strip */}
        <div className="side-panel-icons">
          {/* InternX logo toggle */}
          <button className="ix-toggle" onClick={() => setOpen(o => !o)} title="Toggle navigation">
            <InternXLogo size={30} />
          </button>
          <div className="side-divider" />
          {SIDE_NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`side-icon-btn ${pathname === item.href ? 'active' : ''}`}
            >
              {item.icon}
              <span className="side-tooltip">{item.label}</span>
            </Link>
          ))}
        </div>

        {/* Expanded label panel */}
        {open && (
          <div className="side-panel-expanded">
            <div className="panel-brand">
              <InternXLogo size={28} />
              <div>
                <p style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.2 }}>InternX</p>
                <p style={{ fontSize: 10.5, color: '#9ea3ae', lineHeight: 1.3 }}>Team workspace</p>
              </div>
            </div>
            {SIDE_NAV.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`panel-nav-item ${pathname === item.href ? 'active' : ''}`}
                onClick={() => setOpen(false)}
              >
                <span className="panel-nav-icon">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}





// ─── Profile Dropdown ────────────────────────────────────────────────────────

function ProfileDropdown({ user, onLogout }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const initials = (user?.name ?? user?.email ?? '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const githubUrl = user?.github_url || user?.github || null

  return (
    <div className="relative" ref={ref}>
      <style>{`
        .profile-avatar-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          overflow: hidden;
          cursor: pointer;
          border: 2.5px solid transparent;
          transition: border-color 0.15s, box-shadow 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 13px;
          color: white;
          outline: none;
        }
        .profile-avatar-btn:hover,
        .profile-avatar-btn.open {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(91,79,255,0.15);
        }

        .profile-dropdown {
          position: absolute;
          right: 0;
          top: calc(100% + 10px);
          width: 236px;
          border-radius: 16px;
          background: rgba(255,255,255,0.96);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(91,79,255,0.10);
          box-shadow: 0 8px 40px rgba(91,79,255,0.12), 0 2px 12px rgba(0,0,0,0.07);
          overflow: hidden;
          animation: dropIn 0.18s cubic-bezier(0.34,1.4,0.64,1);
          z-index: 100;
        }
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .dropdown-header {
          padding: 14px 16px 12px;
          border-bottom: 1px solid rgba(91,79,255,0.07);
        }

        .dropdown-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          text-decoration: none;
          font-size: 13px;
          font-weight: 500;
          color: var(--ink-soft);
          transition: background 0.12s, color 0.12s;
          cursor: pointer;
          border: none;
          background: transparent;
          width: 100%;
          text-align: left;
        }
        .dropdown-item:hover {
          background: rgba(91,79,255,0.06);
          color: var(--accent);
        }
        .dropdown-item.danger:hover {
          background: #fff1f2;
          color: #ef4444;
        }
        .dropdown-item svg { flex-shrink: 0; opacity: 0.55; }
        .dropdown-item:hover svg { opacity: 1; }

        .dropdown-divider {
          height: 1px;
          background: rgba(91,79,255,0.07);
          margin: 3px 0;
        }
      `}</style>

      {/* Avatar button */}
      <button
        className={`profile-avatar-btn ${open ? 'open' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Profile"
      >
        {user?.avatar_url ? (
          <Image src={user.avatar_url} alt={user.name || 'User'} width={36} height={36} style={{  objectFit: 'cover' }} />
        ) : (
          initials
        )}
      </button>

      {open && (
        <div className="profile-dropdown">
          {/* Mini profile overview */}
          <div className="dropdown-header">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, var(--accent) 0%, #8b7fff 100%)' }}>
                {user?.avatar_url ? (
                  <Image src={user.avatar_url} alt="" width={36} height={36} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                ) : initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>
                  {user?.name ?? user?.email?.split('@')[0] ?? 'Intern'}
                </p>
                <p className="text-xs truncate" style={{ color: '#9ea3ae' }}>
                  {user?.intern_role ? `${user.intern_role} intern` : 'Intern'}
                </p>
              </div>
            </div>
            {githubUrl && (
              <a href={githubUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-medium hover:underline"
                style={{ color: 'var(--accent)' }}>
                <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                GitHub Profile ↗
              </a>
            )}
          </div>

          {/* Menu items */}
          <div className="py-1">
            <Link href="/dashboard/profile" className="dropdown-item" onClick={() => setOpen(false)}>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" width="16" height="16">
                <circle cx="10" cy="7" r="3.5" />
                <path d="M3 17c0-3.5 3-6 7-6s7 2.5 7 6" strokeLinecap="round" />
              </svg>
              View Profile
            </Link>
            <Link href="/dashboard/analytics" className="dropdown-item" onClick={() => setOpen(false)}>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" width="16" height="16">
                <path d="M3 15l4-5 3 3 4-6 3 2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Analytics
            </Link>
            <div className="dropdown-divider" />
            <Link href="/dashboard/report-user" className="dropdown-item" onClick={() => setOpen(false)}>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" width="16" height="16">
                <path d="M10 7v4M10 13v.5" strokeLinecap="round" />
                <circle cx="10" cy="10" r="8" />
              </svg>
              Report User
            </Link>
            <div className="dropdown-divider" />
            <button className="dropdown-item danger" onClick={() => { setOpen(false); onLogout() }}>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" width="16" height="16">
                <path d="M13 10H3m0 0l3-3m-3 3l3 3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 5V4a1 1 0 011-1h7a1 1 0 011 1v12a1 1 0 01-1 1H9a1 1 0 01-1-1v-1" strokeLinecap="round" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Top Navbar ──────────────────────────────────────────────────────────────



// ─── Subcomponents ────────────────────────────────────────────────────────────

function TaskCard({ task }) {
  const router   = useRouter()
  const status   = STATUS_CONFIG[task.status]   || STATUS_CONFIG.todo
  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'
  const dueDate = task.due_date
    ? new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : null

  return (
    <div
      onClick={() => router.push(`/internship/tasks/${task.id}`)}
      className="p-4 rounded-2xl cursor-pointer transition-all duration-200"
      style={{ background: 'white', border: '1.5px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(91,79,255,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-semibold leading-snug line-clamp-2 font-display" style={{ color: 'var(--ink)' }}>
          {task.title}
        </h4>
        <span className="badge shrink-0 text-xs" style={{ color: status.color, background: status.bg }}>
          <span className="w-1.5 h-1.5 rounded-full inline-block mr-1" style={{ background: status.dot }} />
          {status.label}
        </span>
      </div>
      {task.description && (
        <p className="text-xs mb-3 line-clamp-2" style={{ color: 'var(--ink-muted)' }}>{task.description}</p>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="badge" style={{ color: priority.color, background: priority.bg, fontSize: '10px' }}>
            {priority.label}
          </span>
          {task.intern_role && (() => {
            const rc = ROLE_CONFIG[task.intern_role]
            return rc ? (
              <span className="text-xs px-2 py-0.5 rounded-lg font-medium" style={{ color: rc.color, background: rc.bg }}>
                {rc.icon} {rc.label}
              </span>
            ) : null
          })()}
        </div>
        {dueDate && (
          <span className="text-xs font-medium" style={{ color: isOverdue ? 'var(--red)' : 'var(--ink-muted)' }}>
            {isOverdue ? '⚠ ' : ''}{dueDate}
          </span>
        )}
      </div>
    </div>
  )
}

function KanbanColumn({ title, tasks, dot }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: dot }} />
          <span className="text-sm font-semibold font-display" style={{ color: 'var(--ink)' }}>{title}</span>
        </div>
        <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>
          {tasks.length}
        </span>
      </div>
      <div className="flex flex-col gap-2 min-h-[120px] p-3 rounded-2xl"
        style={{ background: 'var(--surface-2)', border: '1.5px dashed var(--border)' }}>
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-20">
            <span className="text-xs" style={{ color: 'var(--border-strong)' }}>No tasks</span>
          </div>
        ) : (
          tasks.map(task => <TaskCard key={task.id} task={task} />)
        )}
      </div>
    </div>
  )
}

function TeamWidget({ projectId }) {
  const [teamData, setTeamData] = useState(null)

  useEffect(() => {
    if (!projectId) return
    api.get(`/api/projects/${projectId}/team`)
      .then(r => setTeamData(r.data))
      .catch(() => {})
  }, [projectId])

  if (!teamData) return null

  const isActive = teamData.project_status === 'active'
  const total = (teamData.slots || []).reduce((a, s) => a + s.total_slots, 0)
  const filled = teamData.team?.length || 0

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-bold text-sm" style={{ color: 'var(--ink)' }}>
          {isActive ? '✅ My Team' : '⏳ Team Forming'}
        </h3>
        <Link href="/internship/team" className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
          View all →
        </Link>
      </div>
      <div className="flex -space-x-1.5 mb-3">
        {(teamData.team || []).map(m => {
          const rc = ROLE_CONFIG[m.intern_role] || { color: '#5b4fff' }
          return (
            <div key={m.user_id}
              title={`${m.name} · ${m.intern_role}`}
              className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold text-white"
              style={{ background: rc.color, borderColor: 'white' }}>
              {m.name?.[0]?.toUpperCase() || '?'}
            </div>
          )
        })}
        {total - filled > 0 && (
          <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-bold animate-pulse"
            style={{ background: 'var(--border)', borderColor: 'white', color: 'var(--ink-muted)' }}>
            +{total - filled}
          </div>
        )}
      </div>
      <div className="text-xs mb-2" style={{ color: 'var(--ink-muted)' }}>{filled}/{total} members joined</div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${total > 0 ? (filled / total) * 100 : 0}%`, background: isActive ? 'var(--green)' : 'var(--amber)' }} />
      </div>
      {teamData.internx_repo && (
        <a href={teamData.internx_repo} target="_blank" rel="noopener noreferrer"
          className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold hover:opacity-80 transition-opacity"
          style={{ background: '#24292e', color: 'white' }}>
          <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          Team Repo ↗
        </a>
      )}
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, clearAuth } = useAuthStore()
  const router = useRouter()

  const [tasks,   setTasks]   = useState([])
  const [sprint,  setSprint]  = useState(null)
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!user) { router.push('/auth/login'); return }

      try {
        const res = await api.get('/api/auth/me')
        const me = res.data

        if (!me.intern_role) {
          router.push('/auth/onboarding')
          return
        }

        if (!me.project_id) {
          router.push('/internship/project')
          return
        }

        const projectRes = await api.get(`/api/projects/${me.project_id}`)
        setProject(projectRes.data)
      } catch (err) {
        console.error('Failed to load user/project:', err)
      }

      await loadData()
    }, 100)
    return () => clearTimeout(timer)
  }, [user])

  const loadData = async (opts = {}) => {
    const { silent = false } = opts
    try {
      // Fetch sprint first — my-tasks now returns only the active sprint's tasks
      const [sprintRes, tasksRes] = await Promise.all([
        taskApi.getActiveSprint().catch(() => ({ data: [] })),
        taskApi.getMyTasks(),
      ])

      const activeSprint = Array.isArray(sprintRes.data) ? (sprintRes.data[0] || null) : null
      const allTasks     = Array.isArray(tasksRes.data)  ? tasksRes.data : []

      // my-tasks already filters to the active sprint on the backend,
      // but we double-filter client-side as a safety net.
      const sprintTasks = activeSprint
        ? allTasks.filter(t => t.sprint_id === activeSprint.id)
        : allTasks

      // Notify when the sprint changes (backend advanced the team to a new sprint)
      setSprint(prev => {
        if (prev && activeSprint && prev.id !== activeSprint.id) {
          toast.success(`🚀 New sprint unlocked: ${activeSprint.title}`, { duration: 6000 })
        }
        return activeSprint
      })

      setTasks(sprintTasks)
    } catch {
      if (!silent) toast.error('Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }

  // Poll every 30 s so the frontend learns when the backend advances the sprint
  // (the engine runs in a background task after the last task is marked done).
  useEffect(() => {
    const pollInterval = setInterval(() => { loadData({ silent: true }) }, 30000)
    return () => clearInterval(pollInterval)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = () => {
    clearAuth()
    router.push('/auth/login')
  }

  const stats = {
    total:     tasks.length,
    completed: tasks.filter(t => t.status === 'done').length,
    review:    tasks.filter(t => t.status === 'review').length,
    overdue:   tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').length,
  }
  const progress = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
  const userRc = ROLE_CONFIG[user?.intern_role]
  const columns = [
    { key: 'todo',        title: 'To Do',      dot: '#8888a0' },
    { key: 'in_progress', title: 'In Progress', dot: '#3b82f6' },
    { key: 'review',      title: 'In Review',   dot: '#f59e0b' },
    { key: 'done',        title: 'Done',        dot: '#00c896' },
  ]

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface)' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        <span className="text-sm" style={{ color: 'var(--ink-muted)' }}>Loading your workspace...</span>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: 'var(--surface)' }}>
      {/* Floating side panel — fixed, not in layout flow */}
      <FloatingSidePanel />

      {/* Top navbar */}

      {/* Main content — left padding clears the icon strip (52px wide) */}
      <main className="max-w-7xl mx-auto px-6 py-8" style={{ paddingLeft: '72px' }}>

        {/* Project banner */}
        {project && (
          <Link href="/internship/project"
            className="flex items-center justify-between p-4 rounded-2xl mb-6 animate-fade-up transition-all hover:scale-[1.01]"
            style={{ background: `linear-gradient(135deg, ${project.company_color}12, ${project.company_color}06)`, border: `1px solid ${project.company_color}30` }}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{project.company_emoji}</span>
              <div>
                <p className="text-xs font-semibold" style={{ color: project.company_color }}>
                  Currently interning at
                  {project.project_status === 'active' && <span className="ml-2 px-1.5 py-0.5 rounded-md text-[10px] font-bold" style={{ background: '#dcfce7', color: '#16a34a' }}>TEAM ACTIVE</span>}
                  {project.project_status === 'open' && <span className="ml-2 px-1.5 py-0.5 rounded-md text-[10px] font-bold" style={{ background: '#fef3c7', color: '#92400e' }}>FORMING</span>}
                </p>
                <p className="font-display font-bold text-sm" style={{ color: 'var(--ink)' }}>
                  {project.company_name} — {project.project_title}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: project.company_color, color: 'white' }}>
              View Project →
            </div>
          </Link>
        )}

        {/* No project nudge */}
        {!project && (
          <div className="flex items-center justify-between p-4 rounded-2xl mb-6 animate-fade-up"
            style={{ background: 'var(--accent-soft)', border: '1px solid rgba(91,79,255,0.2)' }}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏢</span>
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>No project assigned yet</p>
                <p className="font-display font-bold text-sm" style={{ color: 'var(--ink)' }}>Join a project to get started</p>
              </div>
            </div>
            <Link href="/internship/project"
              className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: 'var(--accent)', color: 'white' }}>
              Find a Project →
            </Link>
          </div>
        )}

        {/* Welcome */}
        <div className="mb-8 animate-fade-up">
          <h1 className="text-3xl font-display mb-1" style={{ color: 'var(--ink)' }}>
            Good to see you, {user?.name?.split(' ')[0]}! 👋
          </h1>
          <div className="flex items-center gap-2">
            {userRc && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: userRc.bg, color: userRc.color }}>
                {userRc.icon} {userRc.label} Intern
              </span>
            )}
            {sprint && <span className="text-sm" style={{ color: 'var(--ink-muted)' }}>· {sprint.title}</span>}
          </div>
        </div>

        {/* Role card */}
        {userRc && (
          <div className="card p-5 mb-6 animate-fade-up stagger-2"
            style={{ background: `linear-gradient(135deg, ${userRc.bg}, white)`, border: `1.5px solid ${userRc.color}30` }}>
            <div className="text-2xl mb-2">{userRc.icon}</div>
            <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: userRc.color }}>Your Role</p>
            <p className="font-display font-bold text-base" style={{ color: 'var(--ink)' }}>{userRc.label} Intern</p>
            <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
              Assigned to {userRc.label.toLowerCase()} tasks in your project
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Main — 3 cols */}
          <div className="xl:col-span-3 space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-fade-up stagger-1">
              {[
                { label: 'Total tasks', value: stats.total,     color: 'var(--ink)'   },
                { label: 'Completed',   value: stats.completed, color: 'var(--green)' },
                { label: 'In review',   value: stats.review,    color: 'var(--amber)' },
                { label: 'Overdue',     value: stats.overdue,   color: 'var(--red)'   },
              ].map(stat => (
                <div key={stat.label} className="card p-5">
                  <div className="text-xs font-medium mb-2" style={{ color: 'var(--ink-muted)' }}>{stat.label}</div>
                  <div className="text-3xl font-display font-bold" style={{ color: stat.color }}>{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Sprint card — always shown (shows "no sprint" nudge when null) */}
            <div className="card p-5 animate-fade-up stagger-2">
              {sprint ? (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🏃</span>
                      <span className="text-sm font-bold font-display" style={{ color: 'var(--ink)' }}>
                        {sprint.title}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                        ACTIVE
                      </span>
                    </div>
                    <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{progress}%</span>
                  </div>
                  {sprint.description && (
                    <p className="text-xs mb-3 line-clamp-1" style={{ color: 'var(--ink-muted)' }}>
                      {sprint.description}
                    </p>
                  )}
                  <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: 'var(--surface-2)' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${progress}%`, background: 'linear-gradient(90deg, var(--accent) 0%, #a78bfa 100%)' }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
                      📅 {sprint.start_date
                        ? new Date(sprint.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                        : '—'}
                    </span>
                    <span className="text-xs font-medium" style={{ color: 'var(--ink-muted)' }}>
                      {stats.completed}/{stats.total} tasks done
                    </span>
                    <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
                      {sprint.end_date
                        ? new Date(sprint.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                        : '—'} 📅
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⏳</span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>No active sprint yet</p>
                    <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
                      {project
                        ? project.project_status === 'open'
                          ? 'Sprint starts once your full team has joined the project.'
                          : 'Sprint will be created shortly — check back in a moment.'
                        : 'Join a project to get your first sprint assigned.'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Kanban */}
            <div className="animate-fade-up stagger-3">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-display" style={{ color: 'var(--ink)' }}>
                  {sprint?.title || 'My Tasks'}
                </h2>
                <Link href="/internship/tasks" className="text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
                  View all
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>

              {tasks.length === 0 ? (
                <div className="card p-16 text-center">
                  <div className="text-4xl mb-3">🎯</div>
                  <h3 className="font-display font-bold mb-1" style={{ color: 'var(--ink)' }}>No tasks yet</h3>
                  <p className="text-sm mb-4" style={{ color: 'var(--ink-muted)' }}>
                    {!project
                      ? 'Join a project first to get tasks assigned to you.'
                      : project?.project_status === 'open'
                        ? 'Tasks will appear once your full team is assembled.'
                        : 'Head to your project page to get started.'}
                  </p>
                  <Link href="/internship/project" className="btn-primary px-6 py-2.5 text-sm inline-flex items-center gap-2">
                    🏢 {project ? 'View My Project' : 'Find a Project'}
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {columns.map(col => (
                    <KanbanColumn
                      key={col.key}
                      title={col.title}
                      tasks={tasks.filter(t => t.status === col.key)}
                      dot={col.dot}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          
        </div>
      </main>
    </div>
  )
}