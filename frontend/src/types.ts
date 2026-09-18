// ── Auth ─────────────────────────────────────────────────────────────────────

export interface UserRead {
  id: number
  username: string
  email: string
  full_name: string
  is_active: boolean
  created_at: string
  last_login_at: string | null
}

export interface UserUpdate {
  full_name?: string | null
  email?: string | null
  password?: string | null
  current_password?: string | null
}

// ── Tenants ──────────────────────────────────────────────────────────────────

export interface TenantConecta {
  base_url: string
  token: string
  config_json: string
}

export interface TenantWhatsapp {
  provider: string
  base_url: string
  version: string
  template_namespace: string
  access_token: string
  business_id: string
  username: string
  password: string
  token: string
  config_json: string
}

export interface ChatInbox {
  id: number
  inbox_id: number | null
  inbox_identifier: string
  ordem: number
}

export interface TenantChat {
  base_url: string
  account_id: number | null
  api_access_token: string
  api_access_token_bot: string
  csat_flow_id: string
  inboxes: ChatInbox[]
}

export interface TenantAi {
  api_key: string
  database: string
  database_chat_histories: string
  nome_projeto: string
  nome_prefeitura: string
  url_projeto: string
  url_servico: string
  horario_cron: string
  horario_timezone: string
  horario_msg: string
}

export interface TenantListRead {
  id: number
  tenant_slug: string
  display_name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TenantDetailRead {
  id: number
  tenant_slug: string
  display_name: string
  is_active: boolean
  config_json: string
  created_at: string
  updated_at: string
  conecta: TenantConecta | null
  whatsapp: TenantWhatsapp | null
  chat: TenantChat | null
  ai: TenantAi | null
}

export interface PaginatedTenants {
  items: TenantListRead[]
  total: number
  page: number
  per_page: number
}

// ── Tenant Create/Update payloads ────────────────────────────────────────────

export interface TenantConectaPayload {
  base_url: string
  token: string
  config_json?: string
}

export interface TenantWhatsappPayload {
  provider?: string
  base_url: string
  version: string
  template_namespace: string
  access_token: string
  business_id: string
  username: string
  password: string
  token: string
  config_json?: string
}

export interface ChatInboxPayload {
  inbox_id?: number | null
  inbox_identifier: string
  ordem: number
}

export interface TenantChatPayload {
  base_url: string
  account_id: number | null
  api_access_token: string
  api_access_token_bot: string
  csat_flow_id: string
  inboxes: ChatInboxPayload[]
}

export interface TenantAiPayload {
  api_key: string
  database: string
  database_chat_histories: string
  nome_projeto: string
  nome_prefeitura: string
  url_projeto: string
  url_servico: string
  horario_cron: string
  horario_timezone: string
  horario_msg: string
}

export interface TenantCreatePayload {
  tenant_slug: string
  display_name: string
  config_json?: string
  conecta?: TenantConectaPayload | null
  whatsapp?: TenantWhatsappPayload | null
  chat?: TenantChatPayload | null
  ai?: TenantAiPayload | null
}

export interface TenantUpdatePayload {
  tenant_slug?: string
  display_name?: string
  conecta?: TenantConectaPayload | null
  whatsapp?: TenantWhatsappPayload | null
  chat?: TenantChatPayload | null
  ai?: TenantAiPayload | null
}

// ── API Keys ─────────────────────────────────────────────────────────────────

export interface ApiKeyRead {
  id: number
  name: string
  is_active: boolean
  created_at: string
  last_used_at: string | null
}

export interface ApiKeyCreatedRead {
  id: number
  name: string
  key: string
  is_active: boolean
  created_at: string
}

// ── Error ────────────────────────────────────────────────────────────────────

export interface ApiError {
  error?: { code: string; message: string }
  detail?: string
}
