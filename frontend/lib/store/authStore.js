import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user:  null,
      token: null,

      setAuth: (user, token) => {
        set({ user, token })
        if (typeof window !== 'undefined') {
          document.cookie = `internx-token=${token}; path=/; max-age=604800; SameSite=Lax`
        }
      },

      clearAuth: () => {
        set({ user: null, token: null })
        if (typeof window !== 'undefined') {
          document.cookie = 'internx-token=; path=/; max-age=0'
        }
      },

      isLoggedIn: () => get().token !== null && get().user !== null,
    }),
    {
      name: 'internx-auth',
    }
  )
)