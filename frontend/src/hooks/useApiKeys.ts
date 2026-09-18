import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import type { ApiKeyCreatedRead, ApiKeyRead } from '../types'

export function useApiKeys() {
  return useQuery({
    queryKey: ['apiKeys'],
    queryFn: async () => {
      const { data } = await api.get<ApiKeyRead[]>('/api-keys')
      return data
    },
  })
}

export function useCreateApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.post<ApiKeyCreatedRead>('/api-keys', { name })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['apiKeys'] })
    },
  })
}

export function useToggleApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.patch<ApiKeyRead>(`/api-keys/${id}/status`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['apiKeys'] })
    },
  })
}

export function useDeleteApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api-keys/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['apiKeys'] })
    },
  })
}
