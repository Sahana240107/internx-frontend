import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
})

// Request interceptor — reads token directly from localStorage
// instead of Zustand store to avoid hydration timing issues
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('internx-auth')
      if (stored) {
        const parsed = JSON.parse(stored)
        const token = parsed?.state?.token
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
      }
    } catch (e) {
      // ignore parse errors
    }
  }
  return config
})

// Response interceptor — redirect to login on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('internx-auth')
        window.location.href = '/auth/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api