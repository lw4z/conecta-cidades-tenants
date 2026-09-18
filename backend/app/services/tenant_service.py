import json
from typing import Optional

from sqlalchemy import desc
from sqlmodel import Session, col, select

from app.core.security import decrypt_field, encrypt_field
from app.models.tenant import (
    ApiKey,
    Tenant,
    TenantAi,
    TenantChat,
    TenantChatInbox,
    TenantConecta,
    TenantWhatsapp,
)
from app.models.user import User
from app.schemas.tenant import (
    TenantAiCreate,
    TenantAiUpdate,
    TenantChatCreate,
    TenantChatUpdate,
    TenantConectaCreate,
    TenantConectaUpdate,
    TenantCreate,
    TenantUpdate,
    TenantWhatsappCreate,
    TenantWhatsappUpdate,
)

# ── Import format converters ──────────────────────────────────────────────────

_KEBAB_TO_SNAKE_WHATSAPP = {
    "access-token": "access_token",
    "business-id": "business_id",
    "template-namespace": "template_namespace",
}


# Known column names on TenantWhatsapp (used to filter during import)
_WHATSAPP_COLUMNS = {"provider", "base_url", "version", "template_namespace", "access_token", "business_id", "username", "password", "token", "config_json"}


def _normalize_import_whatsapp(raw: dict) -> dict:
    """Convert WhatsApp import format to DB fields.

    Stores the ENTIRE provider block in config_json (source of truth).
    Also maps known kebab-case fields to individual columns for backward compat.
    """
    provider = raw.get("provider", "turn-io")
    provider_block = raw.get(provider, {})
    result: dict = {
        "provider": provider,
        "config_json": json.dumps(provider_block, ensure_ascii=False),
    }
    for key, val in provider_block.items():
        db_key = _KEBAB_TO_SNAKE_WHATSAPP.get(key, key)
        if db_key in _WHATSAPP_COLUMNS and isinstance(val, str):
            result[db_key] = val
    return result


def _normalize_import_chat(raw: dict) -> dict:
    """Convert import chat format: inbox→inboxes, csat.flow_id→csat_flow_id."""
    result = {}
    for k, v in raw.items():
        if k == "inbox":
            result["inboxes"] = [
                {"inbox_id": item.get("id"), "inbox_identifier": item.get("inbox_identifier", "")}
                for item in v
            ]
        elif k == "csat":
            result["csat_flow_id"] = v.get("flow_id", "") if isinstance(v, dict) else ""
        else:
            result[k] = v
    return result


_CONECTA_KNOWN_FIELDS = {"base_url", "token"}


def _normalize_import_conecta(raw: dict) -> dict:
    """Store known fields in columns, extra fields in config_json."""
    known_fields = {k: v for k, v in raw.items() if k in _CONECTA_KNOWN_FIELDS}
    extra_fields = {k: v for k, v in raw.items() if k not in _CONECTA_KNOWN_FIELDS}
    if extra_fields:
        known_fields["config_json"] = json.dumps(extra_fields, ensure_ascii=False)
    return known_fields


def _normalize_import_ai(raw: dict) -> dict:
    """Convert nested horario_funcionamento to flat fields."""
    result = {}
    for k, v in raw.items():
        if k == "horario_funcionamento" and isinstance(v, dict):
            result["horario_cron"] = v.get("cron", "")
            result["horario_timezone"] = v.get("time_zone", "")
            result["horario_msg"] = v.get("msg", "")
        else:
            result[k] = v
    return result

# Fields that must be encrypted before storage
_CONECTA_ENCRYPT_FIELDS = {"token"}
_WHATSAPP_ENCRYPT_FIELDS = {"access_token", "password", "token", "config_json"}
_CHAT_ENCRYPT_FIELDS = {"api_access_token", "api_access_token_bot"}
_AI_ENCRYPT_FIELDS = {"api_key"}


def _encrypt_subtable(data: dict, fields: set[str]) -> dict:
    return {k: encrypt_field(v) if k in fields and v else v for k, v in data.items()}


def _decrypt_tenant(tenant: Tenant) -> None:
    """Decrypt sensitive fields in-place on a loaded tenant + sub-tables."""
    if tenant.conecta:
        for f in _CONECTA_ENCRYPT_FIELDS:
            val = getattr(tenant.conecta, f)
            if val:
                setattr(tenant.conecta, f, decrypt_field(val))
    if tenant.whatsapp:
        for f in _WHATSAPP_ENCRYPT_FIELDS:
            val = getattr(tenant.whatsapp, f)
            if val:
                setattr(tenant.whatsapp, f, decrypt_field(val))
    if tenant.chat:
        for f in _CHAT_ENCRYPT_FIELDS:
            val = getattr(tenant.chat, f)
            if val:
                setattr(tenant.chat, f, decrypt_field(val))
    if tenant.ai:
        for f in _AI_ENCRYPT_FIELDS:
            val = getattr(tenant.ai, f)
            if val:
                setattr(tenant.ai, f, decrypt_field(val))


# ── CRUD ─────────────────────────────────────────────────────────────────────

def list_tenants(
    db: Session,
    *,
    page: int = 1,
    per_page: int = 20,
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
) -> tuple[list[Tenant], int]:
    stmt = select(Tenant)
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            col(Tenant.tenant_slug).like(pattern) | col(Tenant.display_name).like(pattern)
        )
    if is_active is not None:
        stmt = stmt.where(Tenant.is_active == is_active)
    total = len(db.exec(stmt).all())
    stmt = stmt.order_by(desc(Tenant.id)).offset((page - 1) * per_page).limit(per_page)
    items = list(db.exec(stmt).all())
    return items, total


def get_tenant(db: Session, tenant_id: int) -> Optional[Tenant]:
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        return None
    _decrypt_tenant(tenant)
    return tenant


def create_tenant(db: Session, user: User, data: TenantCreate) -> Tenant:
    tenant = Tenant(
        tenant_slug=data.tenant_slug,
        display_name=data.display_name,
        created_by_id=user.id,
        updated_by_id=user.id,
    )
    db.add(tenant)
    db.flush()  # get tenant.id for FKs

    if data.conecta:
        db.add(TenantConecta(
            tenant_id=tenant.id,
            **_encrypt_subtable(data.conecta.model_dump(), _CONECTA_ENCRYPT_FIELDS),
        ))
    if data.whatsapp:
        db.add(TenantWhatsapp(
            tenant_id=tenant.id,
            **_encrypt_subtable(data.whatsapp.model_dump(), _WHATSAPP_ENCRYPT_FIELDS),
        ))
    if data.chat:
        chat_data = data.chat.model_dump()
        inboxes = chat_data.pop("inboxes", [])
        db.add(TenantChat(
            tenant_id=tenant.id,
            **_encrypt_subtable(chat_data, _CHAT_ENCRYPT_FIELDS),
        ))
        for inbox_data in inboxes:
            db.add(TenantChatInbox(tenant_id=tenant.id, **inbox_data))
    if data.ai:
        db.add(TenantAi(
            tenant_id=tenant.id,
            **_encrypt_subtable(data.ai.model_dump(), _AI_ENCRYPT_FIELDS),
        ))

    db.commit()
    db.refresh(tenant)
    return tenant


def update_tenant(db: Session, tenant: Tenant, user: User, data: TenantUpdate) -> Tenant:
    if data.tenant_slug is not None:
        tenant.tenant_slug = data.tenant_slug
    if data.display_name is not None:
        tenant.display_name = data.display_name
    tenant.updated_by_id = user.id

    # Upsert sub-tables
    if data.conecta is not None:
        sub = tenant.conecta or TenantConecta(tenant_id=tenant.id)
        updates = data.conecta.model_dump(exclude_unset=True)
        encrypted = _encrypt_subtable(updates, _CONECTA_ENCRYPT_FIELDS)
        for k, v in encrypted.items():
            setattr(sub, k, v)
        db.add(sub)

    if data.whatsapp is not None:
        sub = tenant.whatsapp or TenantWhatsapp(tenant_id=tenant.id)
        updates = data.whatsapp.model_dump(exclude_unset=True)
        encrypted = _encrypt_subtable(updates, _WHATSAPP_ENCRYPT_FIELDS)
        for k, v in encrypted.items():
            setattr(sub, k, v)
        db.add(sub)

    if data.chat is not None:
        sub = tenant.chat or TenantChat(tenant_id=tenant.id)
        chat_updates = data.chat.model_dump(exclude_unset=True)
        inboxes = chat_updates.pop("inboxes", None)
        encrypted = _encrypt_subtable(chat_updates, _CHAT_ENCRYPT_FIELDS)
        for k, v in encrypted.items():
            setattr(sub, k, v)
        db.add(sub)

        if inboxes is not None:
            # Replace all inboxes
            for existing in list(tenant.chat_inboxes):
                db.delete(existing)
            for inbox_data in inboxes:
                db.add(TenantChatInbox(tenant_id=tenant.id, **inbox_data))

    if data.ai is not None:
        sub = tenant.ai or TenantAi(tenant_id=tenant.id)
        updates = data.ai.model_dump(exclude_unset=True)
        encrypted = _encrypt_subtable(updates, _AI_ENCRYPT_FIELDS)
        for k, v in encrypted.items():
            setattr(sub, k, v)
        db.add(sub)

    db.commit()
    db.refresh(tenant)
    return tenant


def delete_tenant(db: Session, tenant: Tenant) -> None:
    db.delete(tenant)
    db.commit()


def toggle_tenant_status(db: Session, tenant: Tenant) -> Tenant:
    tenant.is_active = not tenant.is_active
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


# ── Serialization for v1 public API (Phase 2 prep) ──────────────────────────

def serialize_tenant_to_v1_json(tenant: Tenant) -> dict:
    """Serialize a decrypted tenant into the nested { "dados": { "slug": {...} } } v1 format."""
    info: dict = {"tenant": tenant.tenant_slug}

    # Merge extra root-level fields from config_json
    if tenant.config_json:
        try:
            info.update(json.loads(tenant.config_json))
        except (json.JSONDecodeError, TypeError):
            pass

    if tenant.conecta:
        conecta_block: dict = {
            "base_url": tenant.conecta.base_url,
            "token": decrypt_field(tenant.conecta.token) if tenant.conecta.token else "",
        }
        # Merge extra fields from config_json if present
        raw_config = getattr(tenant.conecta, "config_json", "") or ""
        if raw_config:
            try:
                decrypted_config = decrypt_field(raw_config)
                conecta_block.update(json.loads(decrypted_config))
            except Exception:
                pass
        info["conecta"] = conecta_block

    if tenant.whatsapp:
        wh = tenant.whatsapp
        # config_json is encrypted in DB for WhatsApp
        raw_config = getattr(wh, "config_json", "") or ""
        if raw_config:
            try:
                provider_block = json.loads(decrypt_field(raw_config))
            except Exception:
                provider_block = {}
        else:
            provider_block = {
                "base_url": wh.base_url,
                "version": wh.version,
                "template-namespace": wh.template_namespace,
                "access-token": decrypt_field(wh.access_token) if wh.access_token else "",
                "business-id": wh.business_id,
                "username": wh.username,
                "password": decrypt_field(wh.password) if wh.password else "",
                "token": decrypt_field(wh.token) if wh.token else "",
            }
        info["whatsapp"] = {
            "provider": wh.provider,
            wh.provider: provider_block,
        }

    if tenant.chat:
        ch = tenant.chat
        chat_info: dict = {
            "base_url": ch.base_url,
            "account_id": ch.account_id,
            "api_access_token": decrypt_field(ch.api_access_token) if ch.api_access_token else "",
            "api_access_token_bot": decrypt_field(ch.api_access_token_bot) if ch.api_access_token_bot else "",
            "inbox": [
                {"id": inbox.inbox_id, "inbox_identifier": inbox.inbox_identifier}
                for inbox in (tenant.chat_inboxes or [])
            ],
            "csat": {"flow_id": ch.csat_flow_id},
        }
        info["chat"] = chat_info

    if tenant.ai:
        ai = tenant.ai
        info["ai"] = {
            "api_key": decrypt_field(ai.api_key) if ai.api_key else "",
            "database": ai.database,
            "database_chat_histories": ai.database_chat_histories,
            "nome_projeto": ai.nome_projeto,
            "nome_prefeitura": ai.nome_prefeitura,
            "url_projeto": ai.url_projeto,
            "url_servico": ai.url_servico,
            "horario_funcionamento": {
                "cron": ai.horario_cron,
                "time_zone": ai.horario_timezone,
                "msg": ai.horario_msg,
            },
        }

    return {tenant.tenant_slug: info}


# ── Import / Export ───────────────────────────────────────────────────────────


def _serialize_flat(tenant: Tenant) -> dict:
    """Serialize a decrypted tenant to the export dict format (no info wrapper)."""
    info: dict = {"tenant": tenant.tenant_slug}

    if tenant.display_name:
        info["display_name"] = tenant.display_name

    # Merge extra root-level fields from config_json
    if tenant.config_json:
        try:
            info.update(json.loads(tenant.config_json))
        except (json.JSONDecodeError, TypeError):
            pass

    if tenant.conecta:
        conecta_block: dict = {
            "base_url": tenant.conecta.base_url,
            "token": tenant.conecta.token or "",
        }
        if tenant.conecta.config_json:
            try:
                conecta_block.update(json.loads(tenant.conecta.config_json))
            except (json.JSONDecodeError, TypeError):
                pass
        info["conecta"] = conecta_block

    if tenant.whatsapp:
        wh = tenant.whatsapp
        if wh.config_json:
            try:
                provider_block = json.loads(wh.config_json)
            except (json.JSONDecodeError, TypeError):
                provider_block = {}
        else:
            provider_block = {
                "base_url": wh.base_url,
                "version": wh.version,
                "template-namespace": wh.template_namespace,
                "access-token": wh.access_token or "",
                "business-id": wh.business_id,
                "username": wh.username,
                "password": wh.password or "",
                "token": wh.token or "",
            }
        info["whatsapp"] = {
            "provider": wh.provider,
            wh.provider: provider_block,
        }

    if tenant.chat:
        ch = tenant.chat
        info["chat"] = {
            "base_url": ch.base_url,
            "account_id": ch.account_id,
            "api_access_token": ch.api_access_token or "",
            "api_access_token_bot": ch.api_access_token_bot or "",
            "inbox": [
                {"id": inbox.inbox_id, "inbox_identifier": inbox.inbox_identifier}
                for inbox in (tenant.chat_inboxes or [])
            ],
            "csat": {"flow_id": ch.csat_flow_id},
        }

    if tenant.ai:
        ai = tenant.ai
        info["ai"] = {
            "api_key": ai.api_key or "",
            "database": ai.database,
            "database_chat_histories": ai.database_chat_histories,
            "nome_projeto": ai.nome_projeto,
            "nome_prefeitura": ai.nome_prefeitura,
            "url_projeto": ai.url_projeto,
            "url_servico": ai.url_servico,
            "horario_funcionamento": {
                "cron": ai.horario_cron,
                "time_zone": ai.horario_timezone,
                "msg": ai.horario_msg,
            },
        }

    return info


def export_all_tenants(db: Session) -> dict:
    """Export ALL tenants (active + inactive) as a dict keyed by slug."""
    tenants = list(db.exec(select(Tenant)).all())
    result: dict = {}
    for tenant in tenants:
        # Reload with relationships to ensure sub-tables are loaded
        tenant = get_tenant(db, tenant.id)
        if tenant is not None:
            result[tenant.tenant_slug] = _serialize_flat(tenant)
    return result


def import_tenants(db: Session, user: User, data: dict) -> dict:
    """Import tenants from the export dict format. Returns summary."""
    summary: dict = {"created": 0, "updated": 0, "errors": []}

    for slug, entry in data.items():
        try:
            existing = db.exec(
                select(Tenant).where(Tenant.tenant_slug == slug)
            ).first()

            # Normalize import data
            conecta_data = _normalize_import_conecta(entry["conecta"]) if "conecta" in entry else None
            whatsapp_data = _normalize_import_whatsapp(entry["whatsapp"]) if "whatsapp" in entry else None
            chat_data = _normalize_import_chat(entry["chat"]) if "chat" in entry else None
            ai_data = _normalize_import_ai(entry["ai"]) if "ai" in entry else None

            # Extract extra root-level fields (anything not a known key)
            KNOWN_KEYS = {"tenant", "display_name", "conecta", "whatsapp", "chat", "ai"}
            extra_fields = {k: v for k, v in entry.items() if k not in KNOWN_KEYS}
            config_json_str = json.dumps(extra_fields, ensure_ascii=False) if extra_fields else ""

            if existing is not None:
                # Update existing
                existing.updated_by_id = user.id
                # Preserve display_name from import if available
                if entry.get("display_name"):
                    existing.display_name = entry["display_name"]
                # Store extra fields in config_json
                if config_json_str:
                    existing.config_json = config_json_str
                db.add(existing)
                db.flush()

                # Upsert conecta
                if conecta_data:
                    sub = existing.conecta or TenantConecta(tenant_id=existing.id)
                    for k, v in _encrypt_subtable(conecta_data, _CONECTA_ENCRYPT_FIELDS).items():
                        setattr(sub, k, v)
                    db.add(sub)

                # Upsert whatsapp
                if whatsapp_data:
                    sub = existing.whatsapp or TenantWhatsapp(tenant_id=existing.id)
                    for k, v in _encrypt_subtable(whatsapp_data, _WHATSAPP_ENCRYPT_FIELDS).items():
                        setattr(sub, k, v)
                    db.add(sub)

                # Upsert chat + inboxes
                if chat_data is not None:
                    sub = existing.chat or TenantChat(tenant_id=existing.id)
                    inboxes_data = chat_data.pop("inboxes", None)
                    for k, v in _encrypt_subtable(chat_data, _CHAT_ENCRYPT_FIELDS).items():
                        setattr(sub, k, v)
                    db.add(sub)
                    if inboxes_data is not None:
                        for existing_inbox in list(existing.chat_inboxes):
                            db.delete(existing_inbox)
                        for inbox_d in inboxes_data:
                            db.add(TenantChatInbox(tenant_id=existing.id, **inbox_d))

                # Upsert ai
                if ai_data:
                    sub = existing.ai or TenantAi(tenant_id=existing.id)
                    for k, v in _encrypt_subtable(ai_data, _AI_ENCRYPT_FIELDS).items():
                        setattr(sub, k, v)
                    db.add(sub)

                summary["updated"] += 1
            else:
                # Create new
                # Use display_name from import, or fallback to ai.nome_prefeitura
                display_name = entry.get("display_name", "")
                if not display_name and ai_data:
                    display_name = ai_data.get("nome_prefeitura", "")
                tenant = Tenant(
                    tenant_slug=slug,
                    display_name=display_name,
                    config_json=config_json_str,
                    created_by_id=user.id,
                    updated_by_id=user.id,
                )
                db.add(tenant)
                db.flush()

                if conecta_data:
                    db.add(TenantConecta(
                        tenant_id=tenant.id,
                        **_encrypt_subtable(conecta_data, _CONECTA_ENCRYPT_FIELDS),
                    ))
                if whatsapp_data:
                    db.add(TenantWhatsapp(
                        tenant_id=tenant.id,
                        **_encrypt_subtable(whatsapp_data, _WHATSAPP_ENCRYPT_FIELDS),
                    ))
                if chat_data is not None:
                    inboxes_data = chat_data.pop("inboxes", [])
                    db.add(TenantChat(
                        tenant_id=tenant.id,
                        **_encrypt_subtable(chat_data, _CHAT_ENCRYPT_FIELDS),
                    ))
                    for inbox_d in (inboxes_data or []):
                        db.add(TenantChatInbox(tenant_id=tenant.id, **inbox_d))
                if ai_data:
                    db.add(TenantAi(
                        tenant_id=tenant.id,
                        **_encrypt_subtable(ai_data, _AI_ENCRYPT_FIELDS),
                    ))

                summary["created"] += 1

            db.commit()

        except Exception as exc:
            db.rollback()
            summary["errors"].append(f"{slug}: {exc}")

    return summary
