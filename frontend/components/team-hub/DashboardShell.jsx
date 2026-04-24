'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { useAuthStore } from '@/lib/store/authStore'
import { createClient } from '@/lib/supabase/client'
import NotificationBell from '@/components/NotificationBell' 
// ─── Side nav items ───────────────────────────────────────────────────────────

const SIDE_NAV = [
  {
    href: '/dashboard',
    label: 'Workspace',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ width: 20, height: 20 }}>
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
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ width: 20, height: 20 }}>
        <path d="M4 4h12M4 8h8M4 12h10M4 16h6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/teammates',
    label: 'Team Progress',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ width: 20, height: 20 }}>
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
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ width: 20, height: 20 }}>
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
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ width: 20, height: 20 }}>
        <path d="M3 4h14a1 1 0 011 1v8a1 1 0 01-1 1H6l-4 3V5a1 1 0 011-1z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/review',
    label: 'Review',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ width: 20, height: 20 }}>
        <path d="M5 10l3.5 3.5L15 7" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="10" cy="10" r="8" />
      </svg>
    ),
  },
  {
    href: '/dashboard/ticket',
    label: 'Ticket',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ width: 20, height: 20 }}>
        <path d="M2 7h16M2 13h16" strokeLinecap="round" />
        <rect x="2" y="4" width="16" height="12" rx="2" />
        <path d="M8 4v12" strokeLinecap="round" strokeDasharray="2 2" />
      </svg>
    ),
  },
]

// ─── Top nav items ────────────────────────────────────────────────────────────

const TOP_NAV = [
  { label: 'Dashboard',  href: '/dashboard'          },
  { label: 'Tasks',      href: '/internship/tasks'   },
  { label: 'My Project', href: '/internship/project' },
  { label: 'My Team',    href: '/internship/team'    },
  { label: 'AI Mentor',  href: '/mentor'             },
]

// ─── Floating Side Panel ──────────────────────────────────────────────────────

function FloatingSidePanel() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <>
      <style>{`
        .sp-track {
          position: fixed;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          z-index: 50;
          display: flex;
          align-items: flex-start;
        }
        .sp-strip {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding: 10px 6px;
          border-radius: 0 16px 16px 0;
          background: rgba(255,255,255,0.70);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(91,79,255,0.10);
          border-left: none;
          box-shadow: 4px 0 24px rgba(91,79,255,0.07), 0 2px 16px rgba(0,0,0,0.05);
          transition: box-shadow 0.2s;
        }
        .sp-strip:hover {
          box-shadow: 4px 0 32px rgba(91,79,255,0.12), 0 2px 20px rgba(0,0,0,0.07);
        }
        .sp-logo-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, var(--accent) 0%, #8b7fff 100%);
          color: white;
          font-weight: 800;
          font-size: 15px;
          cursor: pointer;
          border: none;
          margin-bottom: 6px;
          box-shadow: 0 2px 10px rgba(91,79,255,0.30);
          transition: transform 0.15s, box-shadow 0.15s;
          flex-shrink: 0;
        }
        .sp-logo-btn:hover {
          transform: scale(1.07);
          box-shadow: 0 4px 18px rgba(91,79,255,0.40);
        }
        .sp-divider {
          width: 22px;
          height: 1px;
          background: var(--border);
          margin: 3px auto;
          opacity: 0.6;
        }
        .sp-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.14s, color 0.14s, transform 0.14s;
          cursor: pointer;
          text-decoration: none;
          color: var(--ink-muted);
          position: relative;
          background: transparent;
        }
        .sp-icon:hover {
          background: var(--accent-soft);
          color: var(--accent);
          transform: translateX(2px);
        }
        .sp-icon.active {
          background: var(--accent-soft);
          color: var(--accent);
        }
        .sp-icon.active::before {
          content: '';
          position: absolute;
          left: -6px;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 18px;
          border-radius: 2px;
          background: var(--accent);
        }

        /* Expanded panel */
        .sp-expanded {
          position: absolute;
          left: 52px;
          top: 50%;
          transform: translateY(-50%);
          width: 210px;
          padding: 10px 8px;
          border-radius: 0 18px 18px 0;
          background: rgba(255,255,255,0.90);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(91,79,255,0.11);
          border-left: none;
          box-shadow: 6px 0 40px rgba(91,79,255,0.09), 0 4px 24px rgba(0,0,0,0.07);
          animation: spSlideIn 0.2s cubic-bezier(0.34,1.4,0.64,1);
          overflow: hidden;
        }
        @keyframes spSlideIn {
          from { opacity: 0; transform: translateY(-50%) translateX(-10px); }
          to   { opacity: 1; transform: translateY(-50%) translateX(0); }
        }
        .sp-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 8px 10px;
          border-bottom: 1px solid var(--border);
          margin-bottom: 6px;
        }
        .sp-brand-icon {
          width: 32px; height: 32px;
          border-radius: 9px;
          background: linear-gradient(135deg, var(--accent) 0%, #8b7fff 100%);
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 14px; color: white; flex-shrink: 0;
        }
        .sp-nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 10px;
          text-decoration: none;
          color: var(--ink-soft);
          font-size: 13px;
          font-weight: 500;
          transition: background 0.13s, color 0.13s;
          margin-bottom: 1px;
        }
        .sp-nav-item:hover { background: var(--accent-soft); color: var(--accent); }
        .sp-nav-item.active {
          background: var(--accent-soft); color: var(--accent); font-weight: 600;
        }
        .sp-nav-item .sp-nav-ico { opacity: 0.65; flex-shrink: 0; }
        .sp-nav-item.active .sp-nav-ico { opacity: 1; }
        .sp-nav-item:hover .sp-nav-ico { opacity: 1; }
      `}
      </style>

      <div className="sp-track" ref={panelRef}>
        {/* Always-visible icon strip */}
        <div className="sp-strip">
          <button className="sp-logo-btn" onClick={() => setOpen(o => !o)} title="Toggle navigation">
            X
          </button>
          <div className="sp-divider" />
          {SIDE_NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`sp-icon ${pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href + '/')) ? 'active' : ''}`}
            >
              {item.icon}
            </Link>
          ))}
        </div>

        {/* Expanded label panel (revealed on logo click) */}
        {open && (
          <div className="sp-expanded">
            <div className="sp-brand">
              <div className="sp-brand-icon">X</div>
              <div>
                <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', lineHeight: 1.2 }}>InternX</p>
                <p style={{ fontSize: 11, color: 'var(--ink-muted)', lineHeight: 1.4 }}>Team workspace</p>
              </div>
            </div>
            {SIDE_NAV.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`sp-nav-item ${pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href + '/')) ? 'active' : ''}`}
                onClick={() => setOpen(false)}
              >
                <span className="sp-nav-ico">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Notification Bell ────────────────────────────────────────────────────────



// ─── Profile Dropdown ─────────────────────────────────────────────────────────

function ProfileDropdown({ user, profile, onLogout }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function outside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    if (open) document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [open])

  const name     = profile?.name ?? user?.email?.split('@')[0] ?? 'Intern'
  const role     = profile?.intern_role ?? user?.intern_role ?? 'Intern'
  const github   = profile?.github_repo_url ?? user?.github_repo_url ?? null
  const avatar   = profile?.avatar_url ?? user?.avatar_url ?? null
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <style>{`
        .pd-avatar {
          width: 34px; height: 34px;
          border-radius: 50%;
          overflow: hidden;
          cursor: pointer;
          border: 2.5px solid transparent;
          transition: border-color 0.15s, box-shadow 0.15s;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 12px; color: white;
          outline: none;
        }
        .pd-avatar:hover, .pd-avatar.open {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(91,79,255,0.15);
        }
        .pd-menu {
          position: absolute;
          right: 0;
          top: calc(100% + 10px);
          width: 226px;
          border-radius: 16px;
          background: rgba(255,255,255,0.96);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(91,79,255,0.12);
          box-shadow: 0 8px 40px rgba(91,79,255,0.12), 0 2px 12px rgba(0,0,0,0.08);
          overflow: hidden;
          animation: pdDrop 0.18s cubic-bezier(0.34,1.4,0.64,1);
          z-index: 100;
        }
        @keyframes pdDrop {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .pd-header { padding: 13px 15px 11px; border-bottom: 1px solid var(--border); }
        .pd-item {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 15px;
          text-decoration: none;
          font-size: 13px; font-weight: 500;
          color: var(--ink-soft);
          transition: background 0.12s, color 0.12s;
          cursor: pointer; border: none; background: transparent;
          width: 100%; text-align: left;
        }
        .pd-item:hover { background: var(--accent-soft); color: var(--accent); }
        .pd-item.danger:hover { background: #fff1f2; color: #ef4444; }
        .pd-item svg { flex-shrink: 0; opacity: 0.6; }
        .pd-item:hover svg { opacity: 1; }
        .pd-divider { height: 1px; background: var(--border); margin: 3px 0; }
      `}</style>

      {/* Avatar trigger */}
      <button className={`pd-avatar ${open ? 'open' : ''}`} onClick={() => setOpen(o => !o)} title="Profile">
        {avatar
          ? <Image src={avatar} alt={name} width={34} height={34} style={{ borderRadius: '50%', objectFit: 'cover' }} />
          : initials
        }
      </button>

      {open && (
        <div className="pd-menu">
          {/* Mini profile overview */}
          <div className="pd-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 13, color: 'white',
              }}>
                {avatar
                  ? <Image src={avatar} alt={name} width={36} height={36} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                  : initials
                }
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
                <p style={{ fontSize: 11, color: 'var(--ink-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{role} intern</p>
              </div>
            </div>
            {github && (
              <a href={github} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, color: 'var(--accent)', textDecoration: 'none' }}
                onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
              >
                <svg viewBox="0 0 16 16" style={{ width: 13, height: 13 }} fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0016 8c0-6.63-5.37-12-12-12z"/>
                </svg>
                GitHub Profile ↗
              </a>
            )}
          </div>

          {/* Menu items */}
          <div style={{ paddingTop: 4, paddingBottom: 4 }}>
            <Link href="/dashboard/profile" className="pd-item" onClick={() => setOpen(false)}>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" style={{ width: 15, height: 15 }}>
                <circle cx="10" cy="7" r="3.5" /><path d="M3 17c0-3.5 3-6 7-6s7 2.5 7 6" strokeLinecap="round" />
              </svg>
              View Profile
            </Link>
            <Link href="/dashboard/analytics" className="pd-item" onClick={() => setOpen(false)}>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" style={{ width: 15, height: 15 }}>
                <path d="M3 15l4-5 3 3 4-6 3 2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Analytics
            </Link>
            <div className="pd-divider" />
            <Link href="/dashboard/report-user" className="pd-item" onClick={() => setOpen(false)}>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" style={{ width: 15, height: 15 }}>
                <path d="M10 7v4M10 13v.5" strokeLinecap="round" /><circle cx="10" cy="10" r="8" />
              </svg>
              Report User
            </Link>
            <div className="pd-divider" />
            <button className="pd-item danger" onClick={() => { setOpen(false); onLogout() }}>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" style={{ width: 15, height: 15 }}>
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

// ─── Top Navbar ───────────────────────────────────────────────────────────────

function TopNavbar({ user, profile, onLogout }) {
  const pathname = usePathname()

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        height: 60,
        paddingLeft: 76,   /* clears the floating side panel */
        paddingRight: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9,
          background: 'linear-gradient(135deg, var(--accent) 0%, #8b7fff 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 14, color: 'white',
        }}>X</div>
        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.01em' }}>InternX</span>
      </div>

      {/* Horizontal nav */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, justifyContent: 'center' }}>
        {TOP_NAV.map(item => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: '6px 14px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                color: active ? 'var(--accent)' : 'var(--ink-soft)',
                background: active ? 'var(--accent-soft)' : 'transparent',
                textDecoration: 'none',
                transition: 'background 0.13s, color 0.13s',
              }}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Right cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <NotificationBell />
        <ProfileDropdown user={user} profile={profile} onLogout={onLogout} />
      </div>
    </header>
  )
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export default function DashboardShell({ children }) {
  const router = useRouter()
  const { user, clearAuth } = useAuthStore()
  const supabase = createClient()
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('name, avatar_url, intern_role, github_repo_url')
      .eq('id', user.id)
      .single()
      .then(({ data }) => { if (data) setProfile(data) })
  }, [user])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    clearAuth()
    router.push('/auth/login')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      {/* Floating side panel — fixed, not in document flow */}
      <FloatingSidePanel />

      {/* Top navbar — sticky, clears the side panel via paddingLeft */}
      <TopNavbar user={user} profile={profile} onLogout={handleSignOut} />

      {/* Page content — offset left to avoid overlap with the 52px side strip */}
      <div style={{ paddingLeft: 68 }}>
        {children}
      </div>
    </div>
  )
}
