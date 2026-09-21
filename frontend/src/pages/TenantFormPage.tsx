import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTenant, useCreateTenant, useUpdateTenant } from '../hooks/useTenants'
import PasswordInput from '../components/PasswordInput'
import CronEditor from '../components/CronEditor'
import JsonPreview from '../components/JsonPreview'
import type {
  TenantCreatePayload,
  TenantUpdatePayload,
  TenantDetailRead,
} from '../types'

// ── Types ────────────────────────────────────────────────────────────────

const STEPS = ['Identificação', 'Conecta', 'WhatsApp', 'Chat', 'IA', 'Revisão'] as const

interface ChatInboxForm {
  inbox_id: number | null
  inbox_identifier: string
  ordem: number
}

interface FormData {
  tenant_slug: string
  display_name: string
  tenant_config_json: string
  conecta_base_url: string
  conecta_token: string
  conecta_config_json: string
  whatsapp_base_url: string
  whatsapp_version: string
  whatsapp_template_namespace: string
  whatsapp_access_token: string
  whatsapp_business_id: string
  whatsapp_username: string
  whatsapp_password: string
  whatsapp_token: string
  whatsapp_config_json: string
  chat_base_url: string
  chat_account_id: string
  chat_api_access_token: string
  chat_api_access_token_bot: string
  chat_csat_flow_id: string
  chat_inboxes: ChatInboxForm[]
  ai_api_key: string
  ai_database: string
  ai_database_chat_histories: string
  ai_nome_projeto: string
  ai_nome_prefeitura: string
  ai_url_projeto: string
  ai_url_servico: string
  ai_horario_cron: string
  ai_horario_timezone: string
  ai_horario_msg: string
}

type WhatsappProvider = 'turn-io' | 'meta-cloud-api'

const EMPTY_FORM: FormData = {
  tenant_slug: '',
  display_name: '',
  tenant_config_json: '',
  conecta_base_url: '',
  conecta_token: '',
  conecta_config_json: '',
  whatsapp_base_url: '',
  whatsapp_version: '',
  whatsapp_template_namespace: '',
  whatsapp_access_token: '',
  whatsapp_business_id: '',
  whatsapp_username: '',
  whatsapp_password: '',
  whatsapp_token: '',
  whatsapp_config_json: '',
  chat_base_url: '',
  chat_account_id: '',
  chat_api_access_token: '',
  chat_api_access_token_bot: '',
  chat_csat_flow_id: '',
  chat_inboxes: [],
  ai_api_key: '',
  ai_database: '',
  ai_database_chat_histories: '',
  ai_nome_projeto: '',
  ai_nome_prefeitura: '',
  ai_url_projeto: '',
  ai_url_servico: '',
  ai_horario_cron: '0 8-17 * * 1-5',
  ai_horario_timezone: 'America/Fortaleza',
  ai_horario_msg: '',
}

function tenantToForm(t: TenantDetailRead): FormData {
  return {
    tenant_slug: t.tenant_slug,
    display_name: t.display_name,
    tenant_config_json: t.config_json ?? '',
    conecta_base_url: t.conecta?.base_url ?? '',
    conecta_token: t.conecta?.token ?? '',
    conecta_config_json: t.conecta?.config_json ?? '',
    whatsapp_base_url: t.whatsapp?.base_url ?? '',
    whatsapp_version: t.whatsapp?.version ?? '',
    whatsapp_template_namespace: t.whatsapp?.template_namespace ?? '',
    whatsapp_access_token: t.whatsapp?.access_token ?? '',
    whatsapp_business_id: t.whatsapp?.business_id ?? '',
    whatsapp_username: t.whatsapp?.username ?? '',
    whatsapp_password: t.whatsapp?.password ?? '',
    whatsapp_token: t.whatsapp?.token ?? '',
    whatsapp_config_json: t.whatsapp?.config_json ?? '',
    chat_base_url: t.chat?.base_url ?? '',
    chat_account_id: t.chat?.account_id?.toString() ?? '',
    chat_api_access_token: t.chat?.api_access_token ?? '',
    chat_api_access_token_bot: t.chat?.api_access_token_bot ?? '',
    chat_csat_flow_id: t.chat?.csat_flow_id ?? '',
    chat_inboxes: t.chat?.inboxes.map((i) => ({
      inbox_id: i.inbox_id ?? i.id,
      inbox_identifier: i.inbox_identifier,
      ordem: i.ordem,
    })) ?? [],
    ai_api_key: t.ai?.api_key ?? '',
    ai_database: t.ai?.database ?? '',
    ai_database_chat_histories: t.ai?.database_chat_histories ?? '',
    ai_nome_projeto: t.ai?.nome_projeto ?? '',
    ai_nome_prefeitura: t.ai?.nome_prefeitura ?? '',
    ai_url_projeto: t.ai?.url_projeto ?? '',
    ai_url_servico: t.ai?.url_servico ?? '',
    ai_horario_cron: t.ai?.horario_cron ?? '0 8-17 * * 1-5',
    ai_horario_timezone: t.ai?.horario_timezone ?? 'America/Fortaleza',
    ai_horario_msg: t.ai?.horario_msg ?? '',
  }
}

function formToPayload(form: FormData): TenantCreatePayload {
  const hasConecta = form.conecta_base_url || form.conecta_token
  const hasWhatsapp = form.whatsapp_base_url || form.whatsapp_access_token || form.whatsapp_config_json
  const hasChat = form.chat_base_url || form.chat_api_access_token
  const hasAi = form.ai_api_key || form.ai_database || form.ai_nome_projeto

  return {
    tenant_slug: form.tenant_slug.trim(),
    display_name: form.display_name.trim(),
    config_json: form.tenant_config_json,
    conecta: hasConecta
      ? { base_url: form.conecta_base_url, token: form.conecta_token, config_json: form.conecta_config_json }
      : null,
    whatsapp: hasWhatsapp
      ? {
          base_url: form.whatsapp_base_url,
          version: form.whatsapp_version,
          template_namespace: form.whatsapp_template_namespace,
          access_token: form.whatsapp_access_token,
          business_id: form.whatsapp_business_id,
          username: form.whatsapp_username,
          password: form.whatsapp_password,
          token: form.whatsapp_token,
          config_json: form.whatsapp_config_json,
        }
      : null,
    chat: hasChat
      ? {
          base_url: form.chat_base_url,
          account_id: form.chat_account_id ? parseInt(form.chat_account_id, 10) : null,
          api_access_token: form.chat_api_access_token,
          api_access_token_bot: form.chat_api_access_token_bot,
          csat_flow_id: form.chat_csat_flow_id,
          inboxes: form.chat_inboxes.map((i) => ({
            inbox_id: i.inbox_id,
            inbox_identifier: i.inbox_identifier,
            ordem: i.ordem,
          })),
        }
      : null,
    ai: hasAi
      ? {
          api_key: form.ai_api_key,
          database: form.ai_database,
          database_chat_histories: form.ai_database_chat_histories,
          nome_projeto: form.ai_nome_projeto,
          nome_prefeitura: form.ai_nome_prefeitura,
          url_projeto: form.ai_url_projeto,
          url_servico: form.ai_url_servico,
          horario_cron: form.ai_horario_cron,
          horario_timezone: form.ai_horario_timezone,
          horario_msg: form.ai_horario_msg,
        }
      : null,
  }
}

function validateStep(step: number, form: FormData): string | null {
  if (step === 0) {
    if (!form.tenant_slug.trim()) return 'Slug é obrigatório.'
    if (!/^[a-z0-9_-]+$/.test(form.tenant_slug.trim()))
      return 'Slug deve conter apenas minúsculos, números, hífens e underscores.'
  }
  return null
}

// ── Shared form components ───────────────────────────────────────────────

function FormField({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
    />
  )
}

function SecretInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <PasswordInput value={value} onChange={onChange} placeholder={placeholder} />
}

// ── Accordion (edit mode) ────────────────────────────────────────────────

function Accordion({
  title,
  icon,
  hasData,
  defaultOpen,
  children,
}: {
  title: string
  icon: React.ReactNode
  hasData: boolean
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-gray-400">{icon}</span>
          <span className="text-sm font-semibold text-gray-900">{title}</span>
          {hasData && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
              Configurado
            </span>
          )}
        </div>
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="border-t border-gray-100 px-5 py-4">{children}</div>}
    </div>
  )
}

function PlugIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M8.5 1.5a.75.75 0 0 0-1.5 0v2A.75.75 0 0 0 7.75 4.25h.5v2.5h-2.5V2.75a.75.75 0 0 0-1.5 0v4a.75.75 0 0 0 .75.75h6.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 0-1.5 0V6.75h-2.5v-2.5h.5A.75.75 0 0 0 8.5 3.5v-2Z" />
      <path fillRule="evenodd" d="M6 11.25a.75.75 0 0 1 .75.75v1.5a2.5 2.5 0 0 0 5 0V12a.75.75 0 0 1 1.5 0v1.5a4 4 0 0 1-8 0V12a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M3.5 2.75a.75.75 0 0 0-1.5 0v14.5a.75.75 0 0 0 1.5 0v-4.392l1.657-.348a6.449 6.449 0 0 1 4.271.572 7.948 7.948 0 0 0 5.965.524l2.078-.64A.75.75 0 0 0 18 12.25v-8.5a.75.75 0 0 0-.904-.734l-2.38.501a7.25 7.25 0 0 1-4.186-.363l-.502-.2a8.75 8.75 0 0 0-5.053-.439l-1.475.31V2.75Z" clipRule="evenodd" />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M9.965 1.47a.75.75 0 0 1 1.07 0l1.696 1.857 2.378.425a.75.75 0 0 1 .396 1.213l-1.638 1.79.318 2.378a.75.75 0 0 1-1.038.755L11.5 9.157l-2.147.733a.75.75 0 0 1-1.038-.755l.318-2.378-1.638-1.79a.75.75 0 0 1 .396-1.213l2.378-.425L9.965 1.47Z" clipRule="evenodd" />
    </svg>
  )
}

function IdIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M1 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V6Zm4 1a1 1 0 0 0 0 2h8a1 1 0 1 0 0-2H5Z" clipRule="evenodd" />
    </svg>
  )
}

// ── Section renderers ────────────────────────────────────────────────────

function IdentificationSection({ form, setField }: { form: FormData; setField: <K extends keyof FormData>(k: K, v: FormData[K]) => void }) {
  return (
    <div className="space-y-4">
      <FormField label="Slug *">
        <Input value={form.tenant_slug} onChange={(v) => setField('tenant_slug', v)} placeholder="ex: jaboatao_gov_br" />
      </FormField>
      <FormField label="Nome de exibição">
        <Input value={form.display_name} onChange={(v) => setField('display_name', v)} placeholder="ex: Jaboatão dos Guararapes" />
      </FormField>
      <details className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <summary className="cursor-pointer text-xs font-medium text-gray-700 hover:text-gray-900">
          Campos extras (config JSON)
        </summary>
        <p className="mt-1 text-[11px] text-gray-500">
          JSON com campos adicionais do tenant (ex: contract_id). Estes campos são preservados na importação/exportação.
        </p>
        <textarea
          value={form.tenant_config_json}
          onChange={(e) => setField('tenant_config_json', e.target.value)}
          placeholder='{"contract_id": "CTR-2024-001"}'
          rows={4}
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        />
      </details>
    </div>
  )
}

function ConectaSection({ form, setField }: { form: FormData; setField: <K extends keyof FormData>(k: K, v: FormData[K]) => void }) {
  return (
    <div className="space-y-4">
      <FormField label="Base URL">
        <Input value={form.conecta_base_url} onChange={(v) => setField('conecta_base_url', v)} placeholder="https://..." />
      </FormField>
      <FormField label="Token">
        <SecretInput value={form.conecta_token} onChange={(v) => setField('conecta_token', v)} />
      </FormField>
      <details className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <summary className="cursor-pointer text-xs font-medium text-gray-700 hover:text-gray-900">
          Config JSON avançado (campos extras)
        </summary>
        <p className="mt-1 text-[11px] text-gray-500">
          JSON com campos adicionais (ex: servico_fluxo_nativo).
        </p>
        <textarea
          value={form.conecta_config_json}
          onChange={(e) => setField('conecta_config_json', e.target.value)}
          placeholder='{"servico_fluxo_nativo": [...]}'
          rows={4}
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        />
      </details>
    </div>
  )
}

function WhatsappSection({ form, setField }: { form: FormData; setField: <K extends keyof FormData>(k: K, v: FormData[K]) => void }) {
  // Detect provider from config_json or default to turn-io
  let provider: WhatsappProvider = 'turn-io'
  if (form.whatsapp_config_json) {
    try {
      const cfg = JSON.parse(form.whatsapp_config_json)
      if (cfg && typeof cfg === 'object' && 'meta-cloud-api' in cfg) {
        provider = 'meta-cloud-api'
      }
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-4">
      <FormField label="Provider">
        <select
          value={provider}
          onChange={(e) => {
            const v = e.target.value as WhatsappProvider
            // When switching providers, reinitialize config_json
            if (v === 'meta-cloud-api') {
              setField('whatsapp_config_json', JSON.stringify({
                'meta-cloud-api': {
                  base_url: 'https://graph.facebook.com',
                  number: '',
                  phone_number_id: '',
                  token: '',
                  waba_id: '',
                  business_id: '',
                },
              }, null, 2))
              setField('whatsapp_base_url', '')
              setField('whatsapp_access_token', '')
              setField('whatsapp_business_id', '')
              setField('whatsapp_token', '')
            } else {
              setField('whatsapp_config_json', '')
            }
          }}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          <option value="turn-io">Turn.io</option>
          <option value="meta-cloud-api">Meta Cloud API</option>
        </select>
      </FormField>

      {provider === 'turn-io' ? (
        <>
          <FormField label="Base URL">
            <Input value={form.whatsapp_base_url} onChange={(v) => setField('whatsapp_base_url', v)} placeholder="https://..." />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Version">
              <Input value={form.whatsapp_version} onChange={(v) => setField('whatsapp_version', v)} placeholder="v1" />
            </FormField>
            <FormField label="Template Namespace">
              <Input value={form.whatsapp_template_namespace} onChange={(v) => setField('whatsapp_template_namespace', v)} placeholder="UUID" />
            </FormField>
          </div>
          <FormField label="Access Token">
            <SecretInput value={form.whatsapp_access_token} onChange={(v) => setField('whatsapp_access_token', v)} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Business ID">
              <Input value={form.whatsapp_business_id} onChange={(v) => setField('whatsapp_business_id', v)} />
            </FormField>
            <FormField label="Username">
              <Input value={form.whatsapp_username} onChange={(v) => setField('whatsapp_username', v)} />
            </FormField>
          </div>
          <FormField label="Password">
            <SecretInput value={form.whatsapp_password} onChange={(v) => setField('whatsapp_password', v)} />
          </FormField>
          <FormField label="Token (Bearer)">
            <SecretInput value={form.whatsapp_token} onChange={(v) => setField('whatsapp_token', v)} />
          </FormField>
        </>
      ) : (
        <>
          <FormField label="Config JSON (Meta Cloud API)">
            <textarea
              value={form.whatsapp_config_json}
              onChange={(e) => setField('whatsapp_config_json', e.target.value)}
              placeholder={'{\n  "meta-cloud-api": {\n    "base_url": "https://graph.facebook.com",\n    "number": "...",\n    "phone_number_id": "...",\n    "token": "Bearer ...",\n    "waba_id": "...",\n    "business_id": "..."\n  }\n}'}
              rows={12}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </FormField>
          <p className="text-[11px] text-gray-500">
            Preencha os campos dentro do bloco <code>meta-cloud-api</code>: base_url, number, phone_number_id, token, waba_id, business_id.
          </p>
        </>
      )}
    </div>
  )
}

function ChatSection({ form, setField }: { form: FormData; setField: <K extends keyof FormData>(k: K, v: FormData[K]) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Base URL">
          <Input value={form.chat_base_url} onChange={(v) => setField('chat_base_url', v)} placeholder="https://..." />
        </FormField>
        <FormField label="Account ID">
          <Input value={form.chat_account_id} onChange={(v) => setField('chat_account_id', v)} />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="API Access Token">
          <SecretInput value={form.chat_api_access_token} onChange={(v) => setField('chat_api_access_token', v)} />
        </FormField>
        <FormField label="API Access Token Bot">
          <SecretInput value={form.chat_api_access_token_bot} onChange={(v) => setField('chat_api_access_token_bot', v)} />
        </FormField>
      </div>
      <FormField label="CSAT Flow ID">
        <Input value={form.chat_csat_flow_id} onChange={(v) => setField('chat_csat_flow_id', v)} />
      </FormField>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">Inboxes</p>
          <button
            type="button"
            onClick={() =>
              setField('chat_inboxes', [
                ...form.chat_inboxes,
                { inbox_id: null, inbox_identifier: '', ordem: form.chat_inboxes.length },
              ])
            }
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            + Adicionar inbox
          </button>
        </div>
        {form.chat_inboxes.map((inbox, idx) => (
          <div key={idx} className="mb-2 flex items-center gap-2">
            <input
              type="number"
              value={inbox.inbox_id ?? ''}
              onChange={(e) => {
                const n = [...form.chat_inboxes]
                n[idx] = { ...n[idx], inbox_id: e.target.value ? parseInt(e.target.value, 10) : null }
                setField('chat_inboxes', n)
              }}
              placeholder="ID"
              className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none"
            />
            <input
              type="text"
              value={inbox.inbox_identifier}
              onChange={(e) => {
                const n = [...form.chat_inboxes]
                n[idx] = { ...n[idx], inbox_identifier: e.target.value }
                setField('chat_inboxes', n)
              }}
              placeholder="Identifier"
              className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none"
            />
            <input
              type="number"
              value={inbox.ordem}
              onChange={(e) => {
                const n = [...form.chat_inboxes]
                n[idx] = { ...n[idx], ordem: parseInt(e.target.value, 10) || 0 }
                setField('chat_inboxes', n)
              }}
              placeholder="#"
              className="w-16 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setField('chat_inboxes', form.chat_inboxes.filter((_, i) => i !== idx))}
              className="text-red-400 hover:text-red-600"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function AiSection({ form, setField }: { form: FormData; setField: <K extends keyof FormData>(k: K, v: FormData[K]) => void }) {
  return (
    <div className="space-y-4">
      <FormField label="API Key">
        <SecretInput value={form.ai_api_key} onChange={(v) => setField('ai_api_key', v)} />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Database">
          <Input value={form.ai_database} onChange={(v) => setField('ai_database', v)} />
        </FormField>
        <FormField label="Database Chat Histories">
          <Input value={form.ai_database_chat_histories} onChange={(v) => setField('ai_database_chat_histories', v)} />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Nome Projeto">
          <Input value={form.ai_nome_projeto} onChange={(v) => setField('ai_nome_projeto', v)} />
        </FormField>
        <FormField label="Nome Prefeitura">
          <Input value={form.ai_nome_prefeitura} onChange={(v) => setField('ai_nome_prefeitura', v)} />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="URL Projeto">
          <Input value={form.ai_url_projeto} onChange={(v) => setField('ai_url_projeto', v)} />
        </FormField>
        <FormField label="URL Serviço">
          <Input value={form.ai_url_servico} onChange={(v) => setField('ai_url_servico', v)} />
        </FormField>
      </div>
      <FormField label="Horário (Cron)">
        <CronEditor value={form.ai_horario_cron} onChange={(v) => setField('ai_horario_cron', v)} />
      </FormField>
      <FormField label="Timezone">
        <Input value={form.ai_horario_timezone} onChange={(v) => setField('ai_horario_timezone', v)} placeholder="America/Fortaleza" />
      </FormField>
      <FormField label="Mensagem">
        <Input value={form.ai_horario_msg} onChange={(v) => setField('ai_horario_msg', v)} />
      </FormField>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────

export default function TenantFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { data: existing, isLoading: loadingExisting } = useTenant(id ?? '')
  const createMutation = useCreateTenant()
  const updateMutation = useUpdateTenant()

  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [stepError, setStepError] = useState<string | null>(null)
  const [globalError, setGlobalError] = useState<string | null>(null)

  useEffect(() => {
    if (isEdit && existing) {
      setForm(tenantToForm(existing))
    }
  }, [isEdit, existing])

  const setField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const previewPayload = useMemo(() => formToPayload(form), [form])

  if (isEdit && loadingExisting) {
    return <div className="p-6 text-center text-sm text-gray-500">Carregando tenant...</div>
  }

  const handleSubmit = () => {
    setGlobalError(null)
    const slugErr = validateStep(0, form)
    if (slugErr) {
      setGlobalError(slugErr)
      return
    }
    const payload = formToPayload(form)
    if (isEdit) {
      updateMutation.mutate(
        { id: parseInt(id!, 10), body: payload as TenantUpdatePayload },
        {
          onSuccess: (data) => navigate(`/tenants/${data.id}`),
          onError: (err: Error & { response?: { data?: { detail?: string; error?: { message: string } } } }) => {
            setGlobalError(err.response?.data?.detail || err.response?.data?.error?.message || 'Erro ao salvar.')
          },
        },
      )
    } else {
      createMutation.mutate(payload, {
        onSuccess: (data) => navigate(`/tenants/${data.id}`),
        onError: (err: Error & { response?: { data?: { detail?: string; error?: { message: string } } } }) => {
          setGlobalError(err.response?.data?.detail || err.response?.data?.error?.message || 'Erro ao criar.')
        },
      })
    }
  }

  // ── EDIT MODE: accordion layout ──────────────────────────────────────

  if (isEdit) {
    const hasConecta = !!(form.conecta_base_url || form.conecta_token)
    const hasWhatsapp = !!(form.whatsapp_base_url || form.whatsapp_access_token || form.whatsapp_config_json)
    const hasChat = !!(form.chat_base_url || form.chat_api_access_token)
    const hasAi = !!(form.ai_api_key || form.ai_database || form.ai_nome_projeto)

    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Editar Tenant</h1>
          <button
            onClick={() => navigate(`/tenants/${id}`)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Voltar ao detalhe
          </button>
        </div>

        {globalError && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{globalError}</div>
        )}

        <Accordion title="Identificação" icon={<IdIcon />} hasData={!!form.tenant_slug} defaultOpen>
          <IdentificationSection form={form} setField={setField} />
        </Accordion>

        <Accordion title="Conecta" icon={<PlugIcon />} hasData={hasConecta}>
          <ConectaSection form={form} setField={setField} />
        </Accordion>

        <Accordion title="WhatsApp" icon={<ChatIcon />} hasData={hasWhatsapp}>
          <WhatsappSection form={form} setField={setField} />
        </Accordion>

        <Accordion title="Chat" icon={<ChatIcon />} hasData={hasChat}>
          <ChatSection form={form} setField={setField} />
        </Accordion>

        <Accordion title="IA" icon={<SparkleIcon />} hasData={hasAi}>
          <AiSection form={form} setField={setField} />
        </Accordion>

        {/* Save bar */}
        <div className="flex items-center justify-end gap-3 rounded-xl border border-gray-200 bg-gray-50 px-5 py-3">
          <button
            onClick={() => navigate(`/tenants/${id}`)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={updateMutation.isPending}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {updateMutation.isPending ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    )
  }

  // ── CREATE MODE: wizard layout ───────────────────────────────────────

  const canNext = () => {
    const err = validateStep(step, form)
    setStepError(err)
    return !err
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Novo Tenant</h1>

      {/* Step indicator */}
      <div className="mb-8">
        <div className="flex items-center">
          {STEPS.map((name, i) => (
            <div key={name} className="flex items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                  i < step ? 'bg-blue-600 text-white' : i === step ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-600' : 'bg-gray-100 text-gray-400'
                }`}
              >
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`ml-1.5 hidden text-xs sm:inline ${i === step ? 'font-medium text-blue-700' : 'text-gray-400'}`}>
                {name}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`mx-2 h-px w-4 sm:w-8 ${i < step ? 'bg-blue-600' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {globalError && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{globalError}</div>
      )}

      <div className="rounded-xl bg-white p-6 ring-1 ring-gray-200">
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Identificação</h2>
            <FormField label="Slug *" error={stepError ?? undefined}>
              <Input value={form.tenant_slug} onChange={(v) => setField('tenant_slug', v)} placeholder="ex: jaboatao_gov_br" />
            </FormField>
            <FormField label="Nome de exibição">
              <Input value={form.display_name} onChange={(v) => setField('display_name', v)} placeholder="ex: Jaboatão dos Guararapes" />
            </FormField>
          </div>
        )}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Conecta</h2>
            <ConectaSection form={form} setField={setField} />
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">WhatsApp (Turn.io)</h2>
            <WhatsappSection form={form} setField={setField} />
          </div>
        )}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Chat</h2>
            <ChatSection form={form} setField={setField} />
          </div>
        )}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">IA</h2>
            <AiSection form={form} setField={setField} />
          </div>
        )}
        {step === 5 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Revisão</h2>
            <p className="text-sm text-gray-500">Confira os dados antes de criar o tenant.</p>
            <JsonPreview data={previewPayload} />
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-between">
        <button
          onClick={() => { setStep((s) => Math.max(0, s - 1)); setStepError(null) }}
          disabled={step === 0}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Voltar
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/tenants')}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => { if (canNext()) { setStep((s) => s + 1); setStepError(null) } }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Próximo
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Criando...' : 'Criar tenant'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
