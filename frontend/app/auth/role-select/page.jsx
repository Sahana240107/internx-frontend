'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

const roles = [
  {
    id: 'student',
    label: 'Student / Intern',
    icon: (
      <svg width="32" height="32" fill="none" viewBox="0 0 32 32">
        <rect x="4" y="20" width="24" height="3" rx="1.5" fill="currentColor" opacity=".2"/>
        <path d="M16 4L28 10l-12 6L4 10z" fill="currentColor"/>
        <path d="M8 13v7c0 2.21 3.58 4 8 4s8-1.79 8-4v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="28" cy="10" r="1.5" fill="currentColor"/>
        <line x1="28" y1="11.5" x2="28" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    description: 'Access your internship dashboard, tasks, and AI mentor',
    cta: 'Continue with GitHub',
    color: '#5b4fff',
    bg: 'rgba(91,79,255,0.08)',
    border: 'rgba(91,79,255,0.2)',
  },
  {
    id: 'recruiter',
    label: 'Recruiter',
    icon: (
      <svg width="32" height="32" fill="none" viewBox="0 0 32 32">
        <circle cx="13" cy="11" r="5" stroke="currentColor" strokeWidth="2"/>
        <path d="M4 26c0-4.42 4.03-8 9-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <path d="M22 18l1.5 3 3.5.5-2.5 2.5.5 3.5L22 26l-3 1.5.5-3.5L17 21.5l3.5-.5z" fill="currentColor" opacity=".8"/>
      </svg>
    ),
    description: 'Browse top-ranked interns, view activity reports, and hire talent',
    cta: 'Sign in as Recruiter',
    color: '#00c896',
    bg: 'rgba(0,200,150,0.08)',
    border: 'rgba(0,200,150,0.2)',
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: (
      <svg width="32" height="32" fill="none" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="4" fill="currentColor"/>
        <path d="M16 4v4M16 24v4M4 16h4M24 16h4M7.03 7.03l2.83 2.83M22.14 22.14l2.83 2.83M7.03 24.97l2.83-2.83M22.14 9.86l2.83-2.83" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    description: 'Manage users, reports, platform settings, and analytics',
    cta: 'Sign in as Admin',
    color: '#875603',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.2)',
  },
]

export default function RoleSelectPage() {
  const router = useRouter()
  const [hovered, setHovered] = useState(null)

  const handleSelect = (roleId) => {
    if (roleId === 'student') {
      const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID
      const redirectUri = `${window.location.origin}/auth/callback`
      window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=user:email`
    } else if (roleId === 'recruiter') {
      router.push('/auth/recruiter-login')
    } else if (roleId === 'admin') {
      router.push('/auth/admin-login')
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--surface)' }}>
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-2/5 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #0a0a1a 0%, #1a1040 50%, #0f0f2e 100%)' }}>
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }} />
        <div className="absolute top-1/3 left-1/4 w-72 h-72 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #5b4fff 0%, transparent 70%)', filter: 'blur(50px)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #00c896 0%, transparent 70%)', filter: 'blur(35px)' }} />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-lg"
            style={{ background: 'var(--accent)', fontFamily: 'Syne, sans-serif' }}>X</div>
          <span className="font-bold text-white text-xl" style={{ fontFamily: 'Syne, sans-serif' }}>InternX</span>
        </div>

        <div className="relative z-10">
          <h1 className="text-4xl font-bold text-white leading-tight mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
            Who are<br/>you today?
          </h1>
          <p className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
            InternX serves students, recruiters, and platform admins — each with a tailored experience.
          </p>
        </div>

        <div className="relative z-10 space-y-3">
          {['AI-powered intern scoring', 'Real GitHub commit tracking', 'Recruiter talent discovery'].map(f => (
            <div key={f} className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#00c896' }} />
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-lg">
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-8 lg:hidden">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white"
                style={{ background: 'var(--accent)', fontFamily: 'Syne, sans-serif' }}>X</div>
              <span className="font-bold text-xl" style={{ color: 'var(--ink)', fontFamily: 'Syne, sans-serif' }}>InternX</span>
            </div>
            <h2 className="text-3xl font-bold mb-2" style={{ color: 'var(--ink)', fontFamily: 'Syne, sans-serif' }}>
              Select your role
            </h2>
            <p style={{ color: 'var(--ink-muted)' }}>Choose how you'd like to access InternX</p>
          </div>

          <div className="space-y-4">
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => handleSelect(role.id)}
                onMouseEnter={() => setHovered(role.id)}
                onMouseLeave={() => setHovered(null)}
                className="w-full text-left p-5 rounded-2xl transition-all duration-200 flex items-center gap-5"
                style={{
                  background: hovered === role.id ? role.bg : 'var(--surface-2)',
                  border: `1.5px solid ${hovered === role.id ? role.border : 'var(--border)'}`,
                  transform: hovered === role.id ? 'translateY(-2px)' : 'none',
                  boxShadow: hovered === role.id ? `0 8px 24px ${role.bg}` : 'none',
                }}
              >
                <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200"
                  style={{
                    background: hovered === role.id ? role.bg : 'var(--surface-3)',
                    color: hovered === role.id ? role.color : 'var(--ink-muted)',
                    border: `1px solid ${hovered === role.id ? role.border : 'var(--border)'}`,
                  }}>
                  {role.icon}
                </div>
                <div className="flex-1">
                  <div className="font-semibold mb-0.5" style={{ color: 'var(--ink)', fontFamily: 'Syne, sans-serif' }}>
                    {role.label}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--ink-muted)' }}>
                    {role.description}
                  </div>
                </div>
                <div className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
                  style={{
                    background: hovered === role.id ? role.color : 'var(--surface-3)',
                    color: hovered === role.id ? '#fff' : 'var(--ink-muted)',
                  }}>
                  →
                </div>
              </button>
            ))}
          </div>

          <p className="mt-8 text-xs text-center" style={{ color: 'var(--ink-muted)' }}>
            Need help? Contact{' '}
            <a href="mailto:support@internx.io" style={{ color: 'var(--accent)' }}>support@internx.io</a>
          </p>
        </div>
      </div>
    </div>
  )
}