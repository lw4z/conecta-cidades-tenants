import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserRead } from '../types'

interface AuthState {
  user: UserRead | null
  isAuthenticated: boolean
  login: (user: UserRead) => void
  logout: () => void
  setUser: (user: UserRead) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: (user) => set({ user, isAuthenticated: true }),
      logout: () => set({ user: null, isAuthenticated: false }),
      setUser: (user) => set({ user }),
    }),
    { name: 'auth-storage' },
  ),
)
