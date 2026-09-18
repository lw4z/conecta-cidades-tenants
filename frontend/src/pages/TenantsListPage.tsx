import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useTenants } from '../hooks/useTenants'
import api from '../api/client'

const PER_PAGE = 10

export default function TenantsListPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [filterActive, setFilterActive] = useState<boolean | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Import modal state
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<Record<string, unknown> | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null)

  const { data, isLoading } = useTenants({ page, per_page: PER_PAGE, search, is_active: filterActive })

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PER_PAGE)) : 1

  const handleSearch = () => {
    setSearch(searchInput)
    setPage(1)
  }

  const handleExport = async () => {
    const resp = await api.get('/tenants/export')
    const blob = new Blob([JSON.stringify(resp.data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tenants-export.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFile(file)
    setImportResult(null)
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string)
        if (typeof data !== 'object' || Array.isArray(data)) {
          alert('Arquivo JSON inválido. Esperado um objeto com tenants.')
          setImportFile(null)
          return
        }
        setImportPreview(data)
      } catch {
        alert('Arquivo JSON inválido.')
        setImportFile(null)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleImportConfirm = async () => {
    if (!importPreview) return
    setImporting(true)
    try {
      const resp = await api.post('/tenants/import', importPreview)
      setImportResult(resp.data)
      qc.invalidateQueries({ queryKey: ['tenants'] })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Erro ao importar.'
      setImportResult({ created: 0, updated: 0, errors: [msg] })
    } finally {
      setImporting(false)
    }
  }

  const tenantCount = importPreview ? Object.keys(importPreview).length : 0

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
          <p className="mt-1 text-sm text-gray-500">{data?.total ?? 0} tenant(s) cadastrado(s)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate('/tenants/new')}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo Tenant
          </button>
          <button
            onClick={() => {
              const text = `curl -H "X-API-Key: $CONECTA_TENANTS_API_KEY" ${window.location.origin}/api/v1/tenants`
              void navigator.clipboard.writeText(text)
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
            title="Copiar curl para GET /api/v1/tenants"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copiar curl
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Exportar
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Importar
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFileSelect}
            className="hidden"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Buscar por slug ou nome..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 pl-9 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
          <svg className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <select
          value={filterActive === null ? '' : String(filterActive)}
          onChange={(e) => {
            const v = e.target.value
            setFilterActive(v === '' ? null : v === 'true')
            setPage(1)
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">Todos</option>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Slug</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Nome</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Criado em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">Carregando...</td>
              </tr>
            ) : data?.items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">Nenhum tenant encontrado.</td>
              </tr>
            ) : (
              data?.items.map((tenant) => (
                <tr
                  key={tenant.id}
                  onClick={() => navigate(`/tenants/${tenant.id}`)}
                  className="cursor-pointer transition-colors hover:bg-gray-50"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-gray-900">{tenant.tenant_slug}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{tenant.display_name || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        tenant.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {tenant.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                    {new Date(tenant.created_at).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.total > PER_PAGE && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Página {data.page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {importPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            {importResult ? (
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Resultado da importação</h3>
                <div className="mt-4 space-y-2">
                  {importResult.created > 0 && (
                    <p className="text-sm text-emerald-700">✓ {importResult.created} tenant(s) criado(s)</p>
                  )}
                  {importResult.updated > 0 && (
                    <p className="text-sm text-blue-700">↻ {importResult.updated} tenant(s) atualizado(s)</p>
                  )}
                  {importResult.errors.length > 0 && (
                    <div className="rounded-lg bg-red-50 p-3">
                      <p className="text-sm font-medium text-red-800">Erros:</p>
                      {importResult.errors.map((e, i) => (
                        <p key={i} className="text-sm text-red-600">{e}</p>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { setImportPreview(null); setImportFile(null); setImportResult(null) }}
                  className="mt-5 w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Importar tenants</h3>
                <p className="mt-1 text-sm text-gray-500">Arquivo: {importFile?.name}</p>
                <div className="mt-4 rounded-lg bg-gray-50 p-4">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">{tenantCount}</span> tenant(s) encontrado(s) no arquivo:
                  </p>
                  <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-sm text-gray-600">
                    {Object.keys(importPreview).map((slug) => (
                      <li key={slug} className="font-mono">{slug}</li>
                    ))}
                  </ul>
                </div>
                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => { setImportPreview(null); setImportFile(null) }}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleImportConfirm}
                    disabled={importing}
                    className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {importing ? 'Importando...' : 'Confirmar importação'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
