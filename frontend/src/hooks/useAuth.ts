import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { useAuthStore } from '../store/auth'
import type { UserRead, UserUpdate } from '../types'

export function useMe() {
  const { login, logout } = useAuthStore()
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        const { data } = await api.get<UserRead>('/auth/me')
        login(data)
        return data
      } catch {
        logout()
        throw new Error('not authenticated')
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}

export function useLogin() {
  const { login } = useAuthStore()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { username: string; password: string }) => {
      const { data } = await api.post<UserRead>('/auth/login', body)
      return data
    },
    onSuccess: (data) => {
      login(data)
      qc.setQueryData(['me'], data)
    },
  })
}

export function useLogout() {
  const { logout } = useAuthStore()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout')
    },
    onSuccess: () => {
      logout()
      qc.clear()
    },
  })
}

export function useUpdateMe() {
  const setUser = useAuthStore((s) => s.setUser)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: UserUpdate) => {
      const { data } = await api.put<UserRead>('/auth/me', body)
      return data
    },
    onSuccess: (data) => {
      setUser(data)
      qc.setQueryData(['me'], data)
    },
  })
}
