'use client'

import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--surface)' }}>
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #0a0a1a 0%, #1a1040 50%, #0f0f2e 100%)' }}>
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }} />
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #5b4fff 0%, transparent 70%)', filter: 'blur(40px)' }} />
        <div className="absolute bottom-1/3 right-1/4 w-48 h-48 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #a78bfa 0%, transparent 70%)', filter: 'blur(30px)' }} />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-bold text-white text-lg"
            style={{ background: 'var(--accent)' }}>X</div>
          <span className="font-display font-bold text-white text-xl">InternX</span>
        </div>

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6"
            style={{ background: 'rgba(91,79,255,0.2)', color: '#a78bfa', border: '1px solid rgba(91,79,255,0.3)' }}>
            ✦ AI-Powered Virtual Internship
          </div>
          <h1 className="text-5xl font-display text-white leading-tight mb-4">
            Real work.<br/>Real skills.<br/>
            <span style={{ color: '#a78bfa' }}>Zero barriers.</span>
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Experience corporate internship workflows powered by AI mentorship, real code review, and portfolio generation.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-4">
          {[
            { value: '500+', label: 'Interns trained' },
            { value: '98%', label: 'Satisfaction rate' },
            { value: '6', label: 'Modules' },
          ].map((stat) => (
            <div key={stat.label} className="p-4 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="text-2xl font-display font-bold text-white">{stat.value}</div>
              <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-display font-bold text-white"
              style={{ background: 'var(--accent)' }}>X</div>
            <span className="font-display font-bold text-xl" style={{ color: 'var(--ink)' }}>InternX</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-display mb-2" style={{ color: 'var(--ink)' }}>Welcome to InternX</h2>
            <p style={{ color: 'var(--ink-muted)' }}>Your gateway to real internship experience</p>
          </div>

          <button onClick={() => router.push('/auth/role-select')}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-xl font-semibold text-sm transition-all duration-200"
            style={{ background: 'var(--accent)', color: 'white', boxShadow: '0 4px 16px rgba(91,79,255,0.3)' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Start Internship / Sign In
          </button>

          <div className="mt-6 p-4 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <p className="text-xs text-center" style={{ color: 'var(--ink-muted)' }}>
              By signing in, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>

          <div className="mt-8 flex items-center gap-6 justify-center">
            {['AI Mentor', 'Code Review', 'Portfolio Gen'].map((feature) => (
              <div key={feature} className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--green)' }} />
                <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}