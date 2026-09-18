import { useState } from 'react'
import { useUpdateMe } from '../hooks/useAuth'
import { useAuthStore } from '../store/auth'
import PasswordInput from '../components/PasswordInput'

export default function AccountPage() {
  const user = useAuthStore((s) => s.user)
  const updateMutation = useUpdateMe()

  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    updateMutation.mutate(
      { full_name: fullName, email },
      {
        onSuccess: () => setSuccess('Dados atualizados com sucesso.'),
        onError: (err: Error & { response?: { data?: { detail?: string } } }) => {
          setError(err.response?.data?.detail || 'Erro ao atualizar.')
        },
      },
    )
  }

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!currentPassword) {
      setError('Senha atual é obrigatória.')
      return
    }
    if (newPassword.length < 4) {
      setError('Nova senha deve ter pelo menos 4 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não conferem.')
      return
    }
    updateMutation.mutate(
      { password: newPassword, current_password: currentPassword },
      {
        onSuccess: () => {
          setSuccess('Senha alterada com sucesso.')
          setCurrentPassword('')
          setNewPassword('')
          setConfirmPassword('')
        },
        onError: (err: Error & { response?: { data?: { detail?: string } } }) => {
          setError(err.response?.data?.detail || 'Erro ao alterar senha.')
        },
      },
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Minha Conta</h1>

      {success && (
        <div className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{success}</div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Profile */}
      <form onSubmit={handleSaveProfile} className="mb-8 rounded-xl bg-white p-6 ring-1 ring-gray-200">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Dados pessoais</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Nome completo</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Usuário</label>
            <input
              type="text"
              value={user?.username ?? ''}
              disabled
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
            />
          </div>
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {updateMutation.isPending ? 'Salvando...' : 'Salvar dados'}
          </button>
        </div>
      </form>

      {/* Password */}
      <form onSubmit={handleChangePassword} className="rounded-xl bg-white p-6 ring-1 ring-gray-200">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Alterar senha</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Senha atual</label>
            <PasswordInput value={currentPassword} onChange={setCurrentPassword} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Nova senha</label>
            <PasswordInput value={newPassword} onChange={setNewPassword} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Confirmar nova senha</label>
            <PasswordInput value={confirmPassword} onChange={setConfirmPassword} />
          </div>
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {updateMutation.isPending ? 'Alterando...' : 'Alterar senha'}
          </button>
        </div>
      </form>
    </div>
  )
}
