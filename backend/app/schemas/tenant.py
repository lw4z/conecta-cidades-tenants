from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# ── Sub-table: Conecta ────────────────────────────────────────────────────────

class TenantConectaCreate(BaseModel):
    base_url: str = ""
    token: str = ""
    config_json: str = ""


class TenantConectaUpdate(BaseModel):
    base_url: Optional[str] = None
    token: Optional[str] = None
    config_json: Optional[str] = None


class TenantConectaRead(BaseModel):
    base_url: str
    token: str  # decrypted
    config_json: str = ""

    model_config = {"from_attributes": True}


# ── Sub-table: WhatsApp ──────────────────────────────────────────────────────

class TenantWhatsappCreate(BaseModel):
    provider: str = "turn-io"
    base_url: str = ""
    version: str = ""
    template_namespace: str = ""
    access_token: str = ""
    business_id: str = ""
    username: str = ""
    password: str = ""
    token: str = ""
    config_json: str = ""


class TenantWhatsappUpdate(BaseModel):
    provider: Optional[str] = None
    base_url: Optional[str] = None
    version: Optional[str] = None
    template_namespace: Optional[str] = None
    access_token: Optional[str] = None
    business_id: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    token: Optional[str] = None
    config_json: Optional[str] = None


class TenantWhatsappRead(BaseModel):
    provider: str
    base_url: str
    version: str
    template_namespace: str
    access_token: str  # decrypted
    business_id: str
    username: str
    password: str  # decrypted
    token: str  # decrypted
    config_json: str = ""

    model_config = {"from_attributes": True}


# ── Sub-table: Chat ──────────────────────────────────────────────────────────

class TenantChatInboxCreate(BaseModel):
    inbox_id: Optional[int] = None
    inbox_identifier: str = ""
    ordem: int = 0


class TenantChatInboxRead(BaseModel):
    id: int
    inbox_id: Optional[int] = None
    inbox_identifier: str
    ordem: int

    model_config = {"from_attributes": True}


class TenantChatCreate(BaseModel):
    base_url: str = ""
    account_id: Optional[int] = None
    api_access_token: str = ""
    api_access_token_bot: str = ""
    csat_flow_id: str = ""
    inboxes: list[TenantChatInboxCreate] = []


class TenantChatUpdate(BaseModel):
    base_url: Optional[str] = None
    account_id: Optional[int] = None
    api_access_token: Optional[str] = None
    api_access_token_bot: Optional[str] = None
    csat_flow_id: Optional[str] = None
    inboxes: Optional[list[TenantChatInboxCreate]] = None


class TenantChatRead(BaseModel):
    base_url: str
    account_id: Optional[int] = None
    api_access_token: str  # decrypted
    api_access_token_bot: str  # decrypted
    csat_flow_id: str
    inboxes: list[TenantChatInboxRead] = []

    model_config = {"from_attributes": True}


# ── Sub-table: AI ────────────────────────────────────────────────────────────

class TenantAiCreate(BaseModel):
    api_key: str = ""
    database: str = ""
    database_chat_histories: str = ""
    nome_projeto: str = ""
    nome_prefeitura: str = ""
    url_projeto: str = ""
    url_servico: str = ""
    horario_cron: str = ""
    horario_timezone: str = ""
    horario_msg: str = ""


class TenantAiUpdate(BaseModel):
    api_key: Optional[str] = None
    database: Optional[str] = None
    database_chat_histories: Optional[str] = None
    nome_projeto: Optional[str] = None
    nome_prefeitura: Optional[str] = None
    url_projeto: Optional[str] = None
    url_servico: Optional[str] = None
    horario_cron: Optional[str] = None
    horario_timezone: Optional[str] = None
    horario_msg: Optional[str] = None


class TenantAiRead(BaseModel):
    api_key: str  # decrypted
    database: str
    database_chat_histories: str
    nome_projeto: str
    nome_prefeitura: str
    url_projeto: str
    url_servico: str
    horario_cron: str
    horario_timezone: str
    horario_msg: str

    model_config = {"from_attributes": True}


# ── Tenant CRUD schemas ──────────────────────────────────────────────────────

class TenantCreate(BaseModel):
    tenant_slug: str
    display_name: str = ""
    conecta: Optional[TenantConectaCreate] = None
    whatsapp: Optional[TenantWhatsappCreate] = None
    chat: Optional[TenantChatCreate] = None
    ai: Optional[TenantAiCreate] = None


class TenantUpdate(BaseModel):
    tenant_slug: Optional[str] = None
    display_name: Optional[str] = None
    conecta: Optional[TenantConectaUpdate] = None
    whatsapp: Optional[TenantWhatsappUpdate] = None
    chat: Optional[TenantChatUpdate] = None
    ai: Optional[TenantAiUpdate] = None


class TenantListRead(BaseModel):
    id: int
    tenant_slug: str
    display_name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TenantDetailRead(BaseModel):
    id: int
    tenant_slug: str
    display_name: str
    is_active: bool
    config_json: str = ""
    created_at: datetime
    updated_at: datetime
    conecta: Optional[TenantConectaRead] = None
    whatsapp: Optional[TenantWhatsappRead] = None
    chat: Optional[TenantChatRead] = None
    ai: Optional[TenantAiRead] = None

    model_config = {"from_attributes": True}


# ── Paginated response ───────────────────────────────────────────────────────

class PaginatedTenants(BaseModel):
    items: list[TenantListRead]
    total: int
    page: int
    per_page: int


# ── API Key schemas ──────────────────────────────────────────────────────────

class ApiKeyCreate(BaseModel):
    name: str


class ApiKeyRead(BaseModel):
    id: int
    name: str
    is_active: bool
    created_at: datetime
    last_used_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ApiKeyCreatedRead(BaseModel):
    id: int
    name: str
    key: str  # shown once
    is_active: bool
    created_at: datetime


# ── Error response ───────────────────────────────────────────────────────────

class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail
