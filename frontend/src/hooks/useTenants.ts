import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import type {
  PaginatedTenants,
  TenantCreatePayload,
  TenantDetailRead,
  TenantUpdatePayload,
} from '../types'

export interface TenantListParams {
  page: number
  per_page: number
  search: string
  is_active: boolean | null
}

export function useTenants(params: TenantListParams) {
  return useQuery({
    queryKey: ['tenants', params],
    queryFn: async () => {
      const { data } = await api.get<PaginatedTenants>('/tenants', {
        params: {
          page: params.page,
          per_page: params.per_page,
          search: params.search || undefined,
          is_active: params.is_active ?? undefined,
        },
      })
      return data
    },
  })
}

export function useTenant(id: number | string) {
  return useQuery({
    queryKey: ['tenant', id],
    queryFn: async () => {
      const { data } = await api.get<TenantDetailRead>(`/tenants/${id}`)
      return data
    },
  })
}

export function useCreateTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: TenantCreatePayload) => {
      const { data } = await api.post<TenantDetailRead>('/tenants', body)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] })
    },
  })
}

export function useUpdateTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: TenantUpdatePayload }) => {
      const { data } = await api.put<TenantDetailRead>(`/tenants/${id}`, body)
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['tenants'] })
      qc.invalidateQueries({ queryKey: ['tenant', variables.id] })
    },
  })
}

export function useDeleteTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/tenants/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] })
    },
  })
}

export function useToggleTenantStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.patch<TenantDetailRead>(`/tenants/${id}/status`)
      return data
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['tenants'] })
      qc.invalidateQueries({ queryKey: ['tenant', id] })
    },
  })
}
