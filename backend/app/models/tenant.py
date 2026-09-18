from datetime import UTC, datetime
from typing import Optional

from sqlmodel import Field, Relationship, SQLModel


class Tenant(SQLModel, table=True):
    __tablename__ = "tenants"

    id: Optional[int] = Field(default=None, primary_key=True)
    tenant_slug: str = Field(unique=True, index=True)
    display_name: str = ""
    is_active: bool = Field(default=True)
    config_json: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    created_by_id: Optional[int] = Field(default=None, foreign_key="users.id")
    updated_by_id: Optional[int] = Field(default=None, foreign_key="users.id")

    creator: Optional["User"] = Relationship(  # noqa: F821
        back_populates="created_tenants",
        sa_relationship_kwargs={"foreign_keys": "[Tenant.created_by_id]"},
    )
    updater: Optional["User"] = Relationship(  # noqa: F821
        back_populates="updated_tenants",
        sa_relationship_kwargs={"foreign_keys": "[Tenant.updated_by_id]"},
    )
    conecta: Optional["TenantConecta"] = Relationship(
        back_populates="tenant",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    whatsapp: Optional["TenantWhatsapp"] = Relationship(
        back_populates="tenant",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    chat: Optional["TenantChat"] = Relationship(
        back_populates="tenant",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    ai: Optional["TenantAi"] = Relationship(
        back_populates="tenant",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    chat_inboxes: list["TenantChatInbox"] = Relationship(
        back_populates="tenant",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class TenantConecta(SQLModel, table=True):
    __tablename__ = "tenant_conecta"

    tenant_id: int = Field(foreign_key="tenants.id", primary_key=True, ondelete="CASCADE")
    base_url: str = ""
    token: str = ""
    config_json: str = ""  # extra fields like servico_fluxo_nativo

    tenant: Optional[Tenant] = Relationship(back_populates="conecta")


class TenantWhatsapp(SQLModel, table=True):
    __tablename__ = "tenant_whatsapp"

    tenant_id: int = Field(foreign_key="tenants.id", primary_key=True, ondelete="CASCADE")
    provider: str = "turn-io"
    base_url: str = ""
    version: str = ""
    template_namespace: str = ""
    access_token: str = ""
    business_id: str = ""
    username: str = ""
    password: str = ""
    token: str = ""
    config_json: str = ""  # full provider block as JSON (source of truth for provider-specific data)

    tenant: Optional[Tenant] = Relationship(back_populates="whatsapp")


class TenantChat(SQLModel, table=True):
    __tablename__ = "tenant_chat"

    tenant_id: int = Field(foreign_key="tenants.id", primary_key=True, ondelete="CASCADE")
    base_url: str = ""
    account_id: Optional[int] = None
    api_access_token: str = ""
    api_access_token_bot: str = ""
    csat_flow_id: str = ""

    tenant: Optional[Tenant] = Relationship(back_populates="chat")
    inboxes: list["TenantChatInbox"] = Relationship(  # type: ignore[assignment]
        back_populates="chat",
        sa_relationship_kwargs={
            "viewonly": True,
            "primaryjoin": "TenantChat.tenant_id == TenantChatInbox.tenant_id",
            "foreign_keys": "[TenantChatInbox.tenant_id]",
        },
    )


class TenantChatInbox(SQLModel, table=True):
    __tablename__ = "tenant_chat_inbox"

    id: Optional[int] = Field(default=None, primary_key=True)
    tenant_id: int = Field(foreign_key="tenants.id", ondelete="CASCADE")
    inbox_id: Optional[int] = None
    inbox_identifier: str = ""
    ordem: int = 0

    tenant: Optional[Tenant] = Relationship(back_populates="chat_inboxes")
    chat: Optional["TenantChat"] = Relationship(
        back_populates="inboxes",
        sa_relationship_kwargs={
            "viewonly": True,
            "primaryjoin": "TenantChat.tenant_id == TenantChatInbox.tenant_id",
            "foreign_keys": "[TenantChatInbox.tenant_id]",
        },
    )


class TenantAi(SQLModel, table=True):
    __tablename__ = "tenant_ai"

    tenant_id: int = Field(foreign_key="tenants.id", primary_key=True, ondelete="CASCADE")
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

    tenant: Optional[Tenant] = Relationship(back_populates="ai")


class ApiKey(SQLModel, table=True):
    __tablename__ = "api_keys"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True)
    key_hash: str
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    last_used_at: Optional[datetime] = Field(default=None)
