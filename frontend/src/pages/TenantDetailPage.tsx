import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { TenantDetailRead } from '../types'
import ConfirmModal from '../components/ConfirmModal'
import JsonPreview from '../components/JsonPreview'
import { useTenant, useDeleteTenant, useToggleTenantStatus } from '../hooks/useTenants'

function buildPublicJson(t: TenantDetailRead) {
  const info: Record<string, unknown> = {
    tenant: t.tenant_slug,
  }

  // Merge extra root-level fields from config_json
  if (t.config_json) {
    const extra = tryParseJson(t.config_json)
    if (extra) Object.assign(info, extra)
  }

  if (t.conecta) {
    const extra = t.conecta.config_json ? tryParseJson(t.conecta.config_json) : null
    info.conecta = { base_url: t.conecta.base_url, token: t.conecta.token, ...extra }
  }

  if (t.whatsapp) {
    const providerBlock = t.whatsapp.config_json
      ? tryParseJson(t.whatsapp.config_json) || {
          base_url: t.whatsapp.base_url,
          version: t.whatsapp.version,
          'template-namespace': t.whatsapp.template_namespace,
          'access-token': t.whatsapp.access_token,
          'business-id': t.whatsapp.business_id,
          username: t.whatsapp.username,
          password: t.whatsapp.password,
          token: t.whatsapp.token,
        }
      : {
          base_url: t.whatsapp.base_url,
          version: t.whatsapp.version,
          'template-namespace': t.whatsapp.template_namespace,
          'access-token': t.whatsapp.access_token,
          'business-id': t.whatsapp.business_id,
          username: t.whatsapp.username,
          password: t.whatsapp.password,
          token: t.whatsapp.token,
        }
    info.whatsapp = { provider: t.whatsapp.provider, [t.whatsapp.provider]: providerBlock }
  }

  if (t.chat) {
    info.chat = {
      base_url: t.chat.base_url,
      account_id: t.chat.account_id,
      api_access_token: t.chat.api_access_token,
      api_access_token_bot: t.chat.api_access_token_bot,
      inbox: t.chat.inboxes.map((i) => ({
        id: i.inbox_id ?? i.id,
        ...(i.inbox_identifier ? { inbox_identifier: i.inbox_identifier } : {}),
      })),
      csat: { flow_id: t.chat.csat_flow_id },
    }
  }

  if (t.ai) {
    info.ai = {
      api_key: t.ai.api_key,
      database: t.ai.database,
      database_chat_histories: t.ai.database_chat_histories,
      nome_projeto: t.ai.nome_projeto,
      nome_prefeitura: t.ai.nome_prefeitura,
      url_projeto: t.ai.url_projeto,
      url_servico: t.ai.url_servico,
      horario_funcionamento: {
        cron: t.ai.horario_cron,
        time_zone: t.ai.horario_timezone,
        msg: t.ai.horario_msg,
      },
    }
  }

  return [{ dados: info }]
}

function buildCurl(t: TenantDetailRead) {
  return `curl -H "X-API-Key: \\$CONECTA_TENANTS_API_KEY" \\\n  ${window.location.origin}/api/v1/tenants/${t.tenant_slug}`
}

// ── Helpers ────────────────────────────────────────────────────────────────

type IntegrationKey = 'conecta' | 'whatsapp' | 'chat' | 'ai'
const INTEGRATION_LABELS: Record<IntegrationKey, string> = {
  conecta: 'Conecta',
  whatsapp: 'WhatsApp',
  chat: 'Chat',
  ai: 'IA',
}

function maskValue(value: string | null | undefined): string {
  if (!value) return '—'
  if (value.length <= 12) return value
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

function isConfigured(v: unknown): boolean {
  return v !== null && v !== undefined && v !== ''
}

function copyText(text: string, setCopied: (b: boolean) => void) {
  void navigator.clipboard.writeText(text).then(() => {
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  })
}

function tryParseJson(s: string): Record<string, unknown> | null {
  try { return JSON.parse(s) } catch { return null }
}

// ── Componentes visuais ────────────────────────────────────────────────────

function IntegrationBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-400'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-300'}`}
      />
      {label}
    </span>
  )
}

function SecretField({ label, value }: { label: string; value: string | null | undefined }) {
  const [visible, setVisible] = useState(false)
  const hasValue = isConfigured(value)
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <div className="flex items-center gap-2">
        <dd className="text-right font-mono text-sm text-gray-900">
          {hasValue ? (visible ? value : maskValue(value!)) : <span className="text-gray-400">—</span>}
        </dd>
        {hasValue && (
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            title={visible ? 'Ocultar' : 'Mostrar'}
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
    </div>
  )
}

function TextField({ label, value }: { label: string; value: string | number | null | undefined }) {
  const isEmpty = !isConfigured(value)
  const display = isEmpty ? '—' : String(value)
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd
        className={`text-right text-sm break-all ${isEmpty ? 'text-gray-400' : 'text-gray-900'}`}
      >
        {display}
      </dd>
    </div>
  )
}

function MultilineField({ label, value }: { label: string; value: string | null | undefined }) {
  const isEmpty = !isConfigured(value)
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd
        className={`whitespace-pre-wrap rounded-md border border-gray-200 bg-gray-50 p-3 text-sm ${
          isEmpty ? 'text-gray-400' : 'text-gray-800'
        }`}
      >
        {isEmpty ? '—' : value}
      </dd>
    </div>
  )
}

function IntegrationSection({
  title,
  icon,
  active,
  children,
}: {
  title: string
  icon: React.ReactNode
  active: boolean
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <header className="flex items-center justify-between gap-2 border-b border-gray-100 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="text-gray-400">{icon}</span>
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        </div>
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {active ? 'Configurado' : 'Vazio'}
        </span>
      </header>
      <div className="p-5">{active ? children : <EmptyState />}</div>
    </section>
  )
}

function EmptyState() {
  return (
    <p className="text-center text-sm text-gray-400">Nenhuma informação configurada para esta seção.</p>
  )
}

// ── Ícones inline (sem dependências) ───────────────────────────────────────

function EyeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path
        fillRule="evenodd"
        d="M.664 10.59a1.651 1.651 0 0 1 0-1.18C2.497 6.623 5.982 4.5 10 4.5c4.018 0 7.503 2.123 9.336 4.91a1.651 1.651 0 0 1 0 1.18C17.503 13.377 14.018 15.5 10 15.5c-4.018 0-7.503-2.123-9.336-4.91ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path
        fillRule="evenodd"
        d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.029 10.029 0 0 0 3.3-4.38 1.651 1.651 0 0 0 0-1.18C17.503 6.623 14.018 4.5 10 4.5a9.7 9.7 0 0 0-3.146.41L3.28 2.22Zm5.42 5.42a2.5 2.5 0 0 0 3.06 3.06l-3.06-3.06ZM10 15.5c-1.23 0-2.39-.19-3.43-.54l-1.42 1.42A9.71 9.71 0 0 0 10 17.5c4.018 0 7.503-2.123 9.336-4.91a1.651 1.651 0 0 0 0-1.18 10.04 10.04 0 0 0-2.18-2.81l-1.46 1.46a3 3 0 0 1-4.5 4.5l-1.46 1.46A6.5 6.5 0 0 1 10 15.5Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3A1.5 1.5 0 0 1 13 3.5v6A1.5 1.5 0 0 1 11.5 11h-3A1.5 1.5 0 0 1 7 9.5v-6Z" />
      <path d="M3 9.5A1.5 1.5 0 0 1 4.5 8h3A1.5 1.5 0 0 1 9 9.5v6A1.5 1.5 0 0 1 7.5 17h-3A1.5 1.5 0 0 1 3 15.5v-6Z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function PlugIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M8.5 1.5a.75.75 0 0 0-1.5 0v2A.75.75 0 0 0 7.75 4.25h.5v2.5h-2.5V2.75a.75.75 0 0 0-1.5 0v4a.75.75 0 0 0 .75.75h6.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 0-1.5 0V6.75h-2.5v-2.5h.5A.75.75 0 0 0 8.5 3.5v-2Z" />
      <path
        fillRule="evenodd"
        d="M6 11.25a.75.75 0 0 1 .75.75v1.5a2.5 2.5 0 0 0 5 0V12a.75.75 0 0 1 1.5 0v1.5a4 4 0 0 1-8 0V12a.75.75 0 0 1 .75-.75Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path
        fillRule="evenodd"
        d="M3.5 2.75a.75.75 0 0 0-1.5 0v14.5a.75.75 0 0 0 1.5 0v-4.392l1.657-.348a6.449 6.449 0 0 1 4.271.572 7.948 7.948 0 0 0 5.965.524l2.078-.64A.75.75 0 0 0 18 12.25v-8.5a.75.75 0 0 0-.904-.734l-2.38.501a7.25 7.25 0 0 1-4.186-.363l-.502-.2a8.75 8.75 0 0 0-5.053-.439l-1.475.31V2.75Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path
        fillRule="evenodd"
        d="M9.965 1.47a.75.75 0 0 1 1.07 0l1.696 1.857 2.378.425a.75.75 0 0 1 .396 1.213l-1.638 1.79.318 2.378a.75.75 0 0 1-1.038.755L11.5 9.157l-2.147.733a.75.75 0 0 1-1.038-.755l.318-2.378-1.638-1.79a.75.75 0 0 1 .396-1.213l2.378-.425L9.965 1.47Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

// ── Página principal ──────────────────────────────────────────────────────

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: tenant, isLoading } = useTenant(id!)
  const deleteMutation = useDeleteTenant()
  const toggleMutation = useToggleTenantStatus()
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showJson, setShowJson] = useState(false)
  const [copiedCurl, setCopiedCurl] = useState(false)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-sm text-gray-500">Carregando tenant...</div>
      </div>
    )
  }
  if (!tenant) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <p className="text-sm text-red-600">Tenant não encontrado.</p>
        <Link to="/tenants" className="mt-3 text-sm text-blue-600 hover:underline">
          Voltar para a lista
        </Link>
      </div>
    )
  }

  const handleDelete = () => {
    deleteMutation.mutate(tenant.id, {
      onSuccess: () => navigate('/tenants'),
    })
  }

  const handleToggle = () => {
    toggleMutation.mutate(tenant.id)
  }

  const handleCopyCurl = () => copyText(buildCurl(tenant), setCopiedCurl)

  const integrations: Array<{ key: IntegrationKey; active: boolean }> = [
    { key: 'conecta', active: isConfigured(tenant.conecta) },
    { key: 'whatsapp', active: isConfigured(tenant.whatsapp) },
    { key: 'chat', active: isConfigured(tenant.chat) },
    { key: 'ai', active: isConfigured(tenant.ai) },
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Header */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h1 className="truncate text-2xl font-bold text-gray-900">
                {tenant.display_name || tenant.tenant_slug}
              </h1>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  tenant.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    tenant.is_active ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                />
                {tenant.is_active ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <code className="mt-1 block truncate text-sm text-gray-500">
              {tenant.tenant_slug}
            </code>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {integrations.map((i) => (
                <IntegrationBadge key={i.key} active={i.active} label={INTEGRATION_LABELS[i.key]} />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate(`/tenants/${tenant.id}/edit`)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Editar
            </button>
            <button
              onClick={handleToggle}
              disabled={toggleMutation.isPending}
              className={`rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                tenant.is_active
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {tenant.is_active ? 'Desativar' : 'Ativar'}
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Excluir
            </button>
            <button
              onClick={() => setShowJson(!showJson)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {showJson ? 'Ocultar JSON' : 'Ver JSON'}
            </button>
            <button
              onClick={handleCopyCurl}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {copiedCurl ? <CheckIcon /> : <CopyIcon />}
              {copiedCurl ? 'Copiado!' : 'Copiar curl'}
            </button>
          </div>
        </div>
      </div>

      {/* JSON preview */}
      {showJson && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">JSON (formato público /api/v1)</h2>
          <JsonPreview data={buildPublicJson(tenant)} />
        </div>
      )}

      {/* Extra fields from config_json */}
      {tenant.config_json && (() => {
        const extra = tryParseJson(tenant.config_json)
        if (!extra || Object.keys(extra).length === 0) return null
        return (
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <header className="border-b border-gray-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-gray-900">Campos extras</h2>
            </header>
            <div className="p-5">
              <dl className="divide-y divide-gray-100">
                {Object.entries(extra).map(([key, val]) => (
                  <div key={key} className="flex items-start justify-between gap-3 py-1.5">
                    <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{key}</dt>
                    <dd className="text-right text-sm text-gray-900 break-all">
                      {typeof val === 'object' ? (
                        <pre className="whitespace-pre-wrap text-xs text-gray-600">{JSON.stringify(val, null, 2)}</pre>
                      ) : (
                        String(val)
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        )
      })()}

      {/* Conecta */}
      <IntegrationSection title="Conecta" icon={<PlugIcon />} active={isConfigured(tenant.conecta)}>
        {tenant.conecta && (
          <div className="space-y-4">
            <dl className="divide-y divide-gray-100">
              <TextField label="Base URL" value={tenant.conecta.base_url} />
              <SecretField label="Token" value={tenant.conecta.token} />
            </dl>
            {tenant.conecta.config_json && tryParseJson(tenant.conecta.config_json) && (
              <details className="rounded-md border border-gray-200 bg-gray-50 p-3">
                <summary className="cursor-pointer text-xs font-medium text-gray-700 hover:text-gray-900">
                  Config JSON (extra fields)
                </summary>
                <div className="mt-3">
                  <JsonPreview data={tryParseJson(tenant.conecta.config_json)} />
                </div>
              </details>
            )}
          </div>
        )}
      </IntegrationSection>

      {/* WhatsApp */}
      <IntegrationSection
        title={`WhatsApp (${tenant.whatsapp?.provider ?? 'turn-io'})`}
        icon={<ChatIcon />}
        active={isConfigured(tenant.whatsapp)}
      >
        {tenant.whatsapp && (
          <div className="space-y-4">
            <dl className="divide-y divide-gray-100">
              <TextField label="Provider" value={tenant.whatsapp.provider} />
              <TextField label="Base URL" value={tenant.whatsapp.base_url} />
              <TextField label="Version" value={tenant.whatsapp.version} />
              <TextField label="Template Namespace" value={tenant.whatsapp.template_namespace} />
              <TextField label="Business ID" value={tenant.whatsapp.business_id} />
              <TextField label="Username" value={tenant.whatsapp.username} />
            </dl>
            <details className="rounded-md border border-gray-200 bg-gray-50 p-3">
              <summary className="cursor-pointer text-xs font-medium text-gray-700 hover:text-gray-900">
                Credenciais sensíveis
              </summary>
              <dl className="mt-3 space-y-1 divide-y divide-gray-200">
                <SecretField label="Access Token" value={tenant.whatsapp.access_token} />
                <SecretField label="Password" value={tenant.whatsapp.password} />
                <SecretField label="Token (Bearer)" value={tenant.whatsapp.token} />
              </dl>
            </details>
            {tenant.whatsapp.config_json && tryParseJson(tenant.whatsapp.config_json) && (
              <details className="rounded-md border border-gray-200 bg-gray-50 p-3">
                <summary className="cursor-pointer text-xs font-medium text-gray-700 hover:text-gray-900">
                  Config JSON (extra fields)
                </summary>
                <div className="mt-3">
                  <JsonPreview data={tryParseJson(tenant.whatsapp.config_json)} />
                </div>
              </details>
            )}
          </div>
        )}
      </IntegrationSection>

      {/* Chat */}
      <IntegrationSection title="Chat" icon={<ChatIcon />} active={isConfigured(tenant.chat)}>
        {tenant.chat && (
          <div className="space-y-5">
            <dl className="divide-y divide-gray-100">
              <TextField label="Base URL" value={tenant.chat.base_url} />
              <TextField label="Account ID" value={tenant.chat.account_id} />
              <TextField label="CSAT Flow ID" value={tenant.chat.csat_flow_id} />
            </dl>

            <details className="rounded-md border border-gray-200 bg-gray-50 p-3">
              <summary className="cursor-pointer text-xs font-medium text-gray-700 hover:text-gray-900">
                Credenciais sensíveis
              </summary>
              <dl className="mt-3 space-y-1 divide-y divide-gray-200">
                <SecretField label="API Access Token" value={tenant.chat.api_access_token} />
                <SecretField label="API Access Token (Bot)" value={tenant.chat.api_access_token_bot} />
              </dl>
            </details>

            {tenant.chat.inboxes.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Inboxes ({tenant.chat.inboxes.length})
                </h3>
                <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
                  {tenant.chat.inboxes
                    .slice()
                    .sort((a: any, b: any) => a.ordem - b.ordem)
                    .map((inbox) => (
                      <li
                        key={inbox.id}
                        className="flex items-center justify-between px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600">
                            #{inbox.ordem}
                          </span>
                          <code className="text-gray-700">{inbox.inbox_identifier}</code>
                        </div>
                        <span className="text-xs text-gray-400">ID: {inbox.inbox_id}</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </IntegrationSection>

      {/* IA */}
      <IntegrationSection title="IA" icon={<SparkleIcon />} active={isConfigured(tenant.ai)}>
        {tenant.ai && (
          <div className="space-y-4">
            <dl className="divide-y divide-gray-100">
              <TextField label="Nome do Projeto" value={tenant.ai.nome_projeto} />
              <TextField label="Nome da Prefeitura" value={tenant.ai.nome_prefeitura} />
              <TextField label="Database" value={tenant.ai.database} />
              <TextField label="Database (chat histories)" value={tenant.ai.database_chat_histories} />
              <TextField label="URL do Projeto" value={tenant.ai.url_projeto} />
              <TextField label="URL do Serviço" value={tenant.ai.url_servico} />
            </dl>

            <details className="rounded-md border border-gray-200 bg-gray-50 p-3">
              <summary className="cursor-pointer text-xs font-medium text-gray-700 hover:text-gray-900">
                Credenciais sensíveis
              </summary>
              <dl className="mt-3 space-y-1 divide-y divide-gray-200">
                <SecretField label="API Key" value={tenant.ai.api_key} />
              </dl>
            </details>

            <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Horário de funcionamento
              </h3>
              <dl className="divide-y divide-gray-200">
                <TextField label="Expressão Cron" value={tenant.ai.horario_cron} />
                <TextField label="Timezone" value={tenant.ai.horario_timezone} />
                <div className="pt-3">
                  <MultilineField label="Mensagem" value={tenant.ai.horario_msg} />
                </div>
              </dl>
            </div>
          </div>
        )}
      </IntegrationSection>

      <ConfirmModal
        open={showDeleteModal}
        title="Excluir tenant permanentemente?"
        message={`Tem certeza que deseja excluir "${tenant.display_name || tenant.tenant_slug}"? Esta ação é irreversível e removerá todos os dados associados.`}
        confirmLabel="Excluir permanentemente"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
