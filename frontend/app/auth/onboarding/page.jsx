'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store/authStore'
import api from '@/lib/api'
import { toast } from 'sonner'

const roles = [
  {
    id: 'frontend',
    title: 'Frontend',
    icon: '⚡',
    description: 'React, TypeScript, CSS, component libraries',
    color: '#5b4fff',
    bg: '#ede9ff',
    tag: 'UI Engineer',
  },
  {
    id: 'backend',
    title: 'Backend',
    icon: '⚙️',
    description: 'APIs, databases, auth, system design',
    color: '#3b82f6',
    bg: '#eff6ff',
    tag: 'API Engineer',
  },
  {
    id: 'fullstack',
    title: 'Full Stack',
    icon: '🔥',
    description: 'End-to-end, owns features top-to-bottom',
    color: '#f59e0b',
    bg: '#fffbeb',
    tag: 'Product Engineer',
  },
  {
    id: 'devops',
    title: 'DevOps',
    icon: '🚀',
    description: 'CI/CD, Docker, cloud infra, monitoring',
    color: '#00c896',
    bg: '#e0fff7',
    tag: 'Platform Engineer',
  },
  {
    id: 'design',
    title: 'Design',
    icon: '✦',
    description: 'Figma, design systems, UX research',
    color: '#ec4899',
    bg: '#fdf2f8',
    tag: 'Product Designer',
  },
  {
    id: 'tester',
    title: 'QA / Tester',
    icon: '🧪',
    description: 'Playwright, pytest, test strategy, QA automation',
    color: '#8b5cf6',
    bg: '#f5f3ff',
    tag: 'QA Engineer',
  },
]

export default function OnboardingPage() {
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const router = useRouter()
  const { user, token, setAuth } = useAuthStore()

  const handleSubmit = async () => {
    if (!selected) return
    setLoading(true)
    try {
      // Step 1: Save the selected role
      setLoadingStep('Saving your role...')
      await api.put('/api/auth/me', { intern_role: selected })
      setAuth({ ...user, intern_role: selected }, token)
      document.cookie = `internx-token=${token}; path=/; max-age=604800; SameSite=Lax`

      // Step 2: Auto-assign a random matching project immediately
      setLoadingStep('Finding your project...')
      try {
        await api.post('/api/projects/join', {})
        toast.success('Welcome to InternX! 🎉 You\'ve been matched to a project.')
      } catch (joinErr) {
        // No open slots right now — user will see the lobby on the project page
        console.warn('Auto-join failed, will show lobby:', joinErr?.response?.data?.detail)
        toast.success('Welcome to InternX! 🎉 Let\'s find you a team.')
      }

      setTimeout(() => {
        window.location.href = '/internship/project'
      }, 500)
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
      setLoadingStep('')
    }
  }

  const selectedRole = roles.find(r => r.id === selected)

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--surface)' }}>
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full opacity-30"
          style={{ background: 'radial-gradient(circle, #5b4fff20 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #ec489920 0%, transparent 70%)', filter: 'blur(60px)' }} />
      </div>

      <div className="relative flex-1 flex flex-col items-center justify-center p-8">
        {/* Logo */}
        <div className="mb-10 animate-fade-up">
          <div className="flex items-center gap-3 justify-center mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-black text-white text-lg"
              style={{ background: 'var(--accent)' }}>X</div>
            <span className="font-display font-bold text-xl" style={{ color: 'var(--ink)' }}>InternX</span>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid rgba(91,79,255,0.2)' }}>
              ✦ Choose your specialisation
            </div>
            <h1 className="text-4xl font-display mb-2" style={{ color: 'var(--ink)' }}>
              What kind of intern<br />are you?
            </h1>
            <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
              This determines which projects you're matched to and your tasks within the team.
            </p>
          </div>
        </div>

        {/* Role grid */}
        <div className="w-full max-w-2xl grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8 animate-fade-up stagger-1">
          {roles.map((role, i) => (
            <button
              key={role.id}
              onClick={() => setSelected(role.id)}
              className="relative p-5 rounded-2xl text-left transition-all duration-200"
              style={{
                animationDelay: `${i * 0.06}s`,
                background: selected === role.id ? role.bg : 'white',
                border: selected === role.id ? `2px solid ${role.color}` : '2px solid var(--border)',
                transform: selected === role.id ? 'scale(1.03)' : 'scale(1)',
                boxShadow: selected === role.id
                  ? `0 8px 32px ${role.color}25`
                  : '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              {/* New badge for tester */}
              {role.id === 'tester' && (
                <div className="absolute top-3 right-3 px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                  style={{ background: '#f0fdf4', color: '#16a34a' }}>NEW</div>
              )}
              <div className="text-2xl mb-3">{role.icon}</div>
              <div className="font-display font-bold text-sm mb-0.5"
                style={{ color: selected === role.id ? role.color : 'var(--ink)' }}>
                {role.title}
              </div>
              <div className="text-[10px] font-semibold mb-2 uppercase tracking-wide"
                style={{ color: selected === role.id ? role.color + 'cc' : 'var(--ink-muted)' }}>
                {role.tag}
              </div>
              <div className="text-xs leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
                {role.description}
              </div>
              {selected === role.id && (
                <div className="mt-3 flex items-center gap-1">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: role.color }}>
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold" style={{ color: role.color }}>Selected</span>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* CTA */}
        <div className="w-full max-w-2xl animate-fade-up stagger-2">
          {selectedRole && (
            <div className="mb-4 flex items-center gap-3 p-4 rounded-2xl"
              style={{ background: selectedRole.bg, border: `1px solid ${selectedRole.color}30` }}>
              <span className="text-xl">{selectedRole.icon}</span>
              <div>
                <p className="text-sm font-semibold" style={{ color: selectedRole.color }}>
                  {selectedRole.title} track selected
                </p>
                <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
                  You'll be instantly matched to a project that needs a {selectedRole.tag.toLowerCase()}.
                  {selectedRole.id === 'tester' ? ' Great choice — QA is critical in team projects!' : ''}
                </p>
              </div>
            </div>
          )}
          <button
            onClick={handleSubmit}
            disabled={!selected || loading}
            className="w-full btn-primary py-4 text-base flex items-center justify-center gap-2"
            style={{ opacity: (!selected || loading) ? 0.4 : 1, cursor: (!selected || loading) ? 'not-allowed' : 'pointer' }}
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {loadingStep || 'Setting up your profile...'}
              </>
            ) : (
              <>Find My Team →</>
            )}
          </button>
          <p className="text-xs text-center mt-3" style={{ color: 'var(--ink-muted)' }}>
            You'll be automatically matched to a project with an open slot for your role.
          </p>
        </div>
      </div>
    </div>
  )
}