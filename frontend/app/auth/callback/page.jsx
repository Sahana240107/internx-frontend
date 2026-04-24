'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/lib/store/authStore'
import api from '@/lib/api'

export default function CallbackPage() {
  const router  = useRouter()
  const params  = useSearchParams()
  const setAuth = useAuthStore((s) => s.setAuth)
  const called  = useRef(false)

  useEffect(() => {
    const code  = params.get('code')
    const error = params.get('error')

    if (error) { router.replace(`/auth/login?error=${error}`); return }
    if (!code) return
    if (called.current) return
    called.current = true

    const exchange = async () => {
      try {
        const { data } = await api.post('/api/auth/github/callback', { code })
        setAuth(data.user, data.access_token)
        localStorage.setItem("user_id", data.user.id)
        localStorage.setItem("internx_token", data.access_token)
        if (data.user.role === 'intern' && !data.user.intern_role) {
          router.replace('/auth/onboarding')
        } else {
          router.replace('/internship/project')
        }
      } catch (err) {
        console.error('Auth callback error:', err)
        router.replace('/auth/login?error=auth_failed')
      }
    }

    exchange()
  }, [params])

  return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface)' }}>
      <div className="text-center flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        <p className="font-medium" style={{ color: 'var(--ink)' }}>Signing you in...</p>
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Connecting your GitHub account</p>
      </div>
    </main>
  )
}