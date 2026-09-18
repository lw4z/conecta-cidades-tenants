import { useState } from 'react'
import { useApiKeys, useCreateApiKey, useToggleApiKey, useDeleteApiKey } from '../hooks/useApiKeys'
import ConfirmModal from '../components/ConfirmModal'

export default function ApiKeysPage() {
  const { data: keys, isLoading } = useApiKeys()
  const createMutation = useCreateApiKey()
  const toggleMutation = useToggleApiKey()
  const deleteMutation = useDeleteApiKey()

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null)
  const [error, setError] = useState('')

  const handleCreate = () => {
    setError('')
    if (!newName.trim()) {
      setError('Nome é obrigatório.')
      return
    }
    createMutation.mutate(newName.trim(), {
      onSuccess: (data) => {
        setCreatedKey(data.key)
        setNewName('')
      },
      onError: (err: Error & { response?: { data?: { detail?: string; error?: { message: string } } } }) => {
        setError(
          err.response?.data?.detail || err.response?.data?.error?.message || 'Erro ao criar chave.',
        )
      },
    })
  }

  const handleCopyKey = async () => {
    if (!createdKey) return
    await navigator.clipboard.writeText(createdKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    })
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
          <p className="mt-1 text-sm text-gray-500">Gerencie as chaves de integração</p>
        </div>
        <button
          onClick={() => {
            setShowCreate(true)
            setCreatedKey(null)
            setError('')
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Criar chave
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Criar API Key</h3>
            {error && (
              <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}
            {createdKey ? (
              <div className="mt-4">
                <p className="text-sm text-gray-600">
                  Sua chave foi criada. <strong>Salve-a agora</strong> — ela não será exibida novamente.
                </p>
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-gray-50 p-3">
                  <code className="flex-1 break-all text-xs text-gray-800">{createdKey}</code>
                  <button
                    onClick={handleCopyKey}
                    className="shrink-0 rounded-md bg-gray-700 px-2 py-1 text-xs text-white hover:bg-gray-600"
                  >
                    {copied ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <button
                  onClick={() => {
                    setShowCreate(false)
                    setCreatedKey(null)
                  }}
                  className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Nome da integração
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    placeholder="ex: n8n-producao"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setShowCreate(false)
                      setNewName('')
                      setError('')
                    }}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={createMutation.isPending}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {createMutation.isPending ? 'Criando...' : 'Criar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Nome</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Último uso</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">Carregando...</td>
              </tr>
            ) : keys?.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">Nenhuma chave criada.</td>
              </tr>
            ) : (
              keys?.map((key) => (
                <tr key={key.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{key.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        key.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {key.is_active ? 'Ativa' : 'Revogada'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                    {key.last_used_at
                      ? new Date(key.last_used_at).toLocaleString('pt-BR')
                      : 'Nunca'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      onClick={() => toggleMutation.mutate(key.id)}
                      disabled={toggleMutation.isPending}
                      className="mr-2 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                    >
                      {key.is_active ? 'Revogar' : 'Ativar'}
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ id: key.id, name: key.name })}
                      className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Excluir API Key?"
        message={`Tem certeza que deseja excluir a chave "${deleteTarget?.name}"? Esta ação é irreversível.`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
