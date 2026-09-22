import pytest
from app.core.security import encrypt_field, generate_api_key, hash_api_key
from app.models.tenant import ApiKey, Tenant, TenantAi, TenantChat, TenantChatInbox, TenantConecta, TenantWhatsapp


@pytest.fixture(name="api_key_raw")
def api_key_raw_fixture(session):
    """Create a valid API key in DB; return the raw key string for headers."""
    raw = generate_api_key()
    key = ApiKey(name="test-key", key_hash=hash_api_key(raw), is_active=True)
    session.add(key)
    session.commit()
    return raw


@pytest.fixture(name="api_key_client")
def api_key_client_fixture(client, api_key_raw):
    """Return (client, raw_key) tuple — caller adds header per request."""
    return client, api_key_raw


def _headers(raw_key: str) -> dict[str, str]:
    return {"X-API-Key": raw_key}


def _create_full_tenant(session, slug="test_tenant", is_active=True):
    """Insert a fully-populated tenant directly into DB (bypassing API)."""
    t = Tenant(tenant_slug=slug, display_name=slug, is_active=is_active)
    session.add(t)
    session.flush()

    session.add(TenantConecta(
        tenant_id=t.id,
        base_url="https://conecta.example.com",
        token=encrypt_field("ctok123"),
    ))
    session.add(TenantWhatsapp(
        tenant_id=t.id,
        provider="turn-io",
        base_url="https://wa.example.com",
        version="v1",
        access_token=encrypt_field("wa_at_123"),
        business_id="biz123",
        username="wa_user",
        password=encrypt_field("wa_pass"),
        token=encrypt_field("wa_tok"),
    ))
    session.add(TenantChat(
        tenant_id=t.id,
        base_url="https://chat.example.com",
        account_id=42,
        api_access_token=encrypt_field("chat_tok"),
        api_access_token_bot=encrypt_field("chat_bot_tok"),
        csat_flow_id="csat_123",
    ))
    session.add(TenantChatInbox(tenant_id=t.id, inbox_id=7, inbox_identifier="inbox_7", ordem=1))
    session.add(TenantChatInbox(tenant_id=t.id, inbox_id=8, inbox_identifier="inbox_8", ordem=2))
    session.add(TenantAi(
        tenant_id=t.id,
        api_key=encrypt_field("ai_key_123"),
        database="mydb",
        database_chat_histories="mydb_hist",
        nome_projeto="proj",
        nome_prefeitura="pref",
        url_projeto="https://proj.example.com",
        url_servico="https://svc.example.com",
        horario_cron="0 8 * * 1-5",
        horario_timezone="America/Fortaleza",
        horario_msg="horario_msg_content",
    ))
    session.commit()
    session.refresh(t)
    return t


# ── GET /api/v1/tenants ─────────────────────────────────────────────────────


class TestPublicListAuth:
    def test_no_api_key(self, client):
        resp = client.get("/api/v1/tenants")
        assert resp.status_code == 422  # missing required header

    def test_invalid_api_key(self, client):
        resp = client.get("/api/v1/tenants", headers=_headers("ccat_bogus"))
        assert resp.status_code == 401


class TestPublicList:
    def test_empty(self, client, api_key_raw):
        resp = client.get("/api/v1/tenants", headers=_headers(api_key_raw))
        assert resp.status_code == 200
        assert resp.json() == []

    def test_returns_active_tenants_only(self, client, api_key_raw, session):
        _create_full_tenant(session, slug="active_one", is_active=True)
        _create_full_tenant(session, slug="inactive_one", is_active=False)
        resp = client.get("/api/v1/tenants", headers=_headers(api_key_raw))
        data = resp.json()
        slugs = [d["dados"]["tenant"] for d in data]
        assert "active_one" in slugs
        assert "inactive_one" not in slugs

    def test_returns_array_of_dados_objects(self, client, api_key_raw, session):
        _create_full_tenant(session, slug="s1")
        _create_full_tenant(session, slug="s2")
        resp = client.get("/api/v1/tenants", headers=_headers(api_key_raw))
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 2
        for entry in data:
            assert "dados" in entry
            assert "tenant" in entry["dados"]

    def test_full_format(self, client, api_key_raw, session):
        _create_full_tenant(session)
        resp = client.get("/api/v1/tenants", headers=_headers(api_key_raw))
        info = resp.json()[0]["dados"]
        assert info["tenant"] == "test_tenant"
        # conecta
        assert info["conecta"]["base_url"] == "https://conecta.example.com"
        # whatsapp
        assert info["whatsapp"]["provider"] == "turn-io"
        assert "turn-io" in info["whatsapp"]
        assert info["whatsapp"]["turn-io"]["access-token"] == "wa_at_123"
        # chat
        assert info["chat"]["account_id"] == 42
        assert len(info["chat"]["inbox"]) == 2
        assert info["chat"]["csat"]["flow_id"] == "csat_123"
        # ai
        assert info["ai"]["database"] == "mydb"

    def test_encrypted_fields_decrypted(self, client, api_key_raw, session):
        _create_full_tenant(session)
        resp = client.get("/api/v1/tenants", headers=_headers(api_key_raw))
        info = resp.json()[0]["dados"]
        # These were encrypted before storage
        assert info["conecta"]["token"] == "ctok123"
        assert info["whatsapp"]["turn-io"]["access-token"] == "wa_at_123"
        assert info["whatsapp"]["turn-io"]["password"] == "wa_pass"
        assert info["whatsapp"]["turn-io"]["token"] == "wa_tok"
        assert info["chat"]["api_access_token"] == "chat_tok"
        assert info["chat"]["api_access_token_bot"] == "chat_bot_tok"
        assert info["ai"]["api_key"] == "ai_key_123"

    def test_conecta_config_json_extras_included(self, client, api_key_raw, session):
        """Conecta config_json extras (e.g. servico_fluxo_nativo) must appear in API response."""
        import json as _json
        t = Tenant(tenant_slug="conecta_extras", display_name="conecta extras")
        session.add(t)
        session.flush()
        session.add(TenantConecta(
            tenant_id=t.id,
            base_url="https://extra.example.com",
            token=encrypt_field("tok"),
            config_json=_json.dumps({
                "servico_fluxo_nativo": ["flow1", "flow2"],
                "custom_field": "custom_value",
            }),
        ))
        session.commit()
        resp = client.get("/api/v1/tenants", headers=_headers(api_key_raw))
        info = resp.json()[0]["dados"]
        assert info["conecta"]["base_url"] == "https://extra.example.com"
        assert info["conecta"]["servico_fluxo_nativo"] == ["flow1", "flow2"]
        assert info["conecta"]["custom_field"] == "custom_value"

    def test_root_config_json_extras_included(self, client, api_key_raw, session):
        """Root-level config_json extras (e.g. contract_id) must appear in API response."""
        import json as _json
        t = Tenant(
            tenant_slug="root_extras",
            display_name="root extras",
            config_json=_json.dumps({"contract_id": 1002, "extra_root": True}),
        )
        session.add(t)
        session.commit()
        resp = client.get("/api/v1/tenants", headers=_headers(api_key_raw))
        info = resp.json()[0]["dados"]
        assert info["contract_id"] == 1002
        assert info["extra_root"] is True


# ── GET /api/v1/tenants/{slug} ──────────────────────────────────────────────


class TestPublicGetBySlugAuth:
    def test_no_api_key(self, client):
        resp = client.get("/api/v1/tenants/anything")
        assert resp.status_code == 422

    def test_invalid_api_key(self, client):
        resp = client.get("/api/v1/tenants/anything", headers=_headers("ccat_bogus"))
        assert resp.status_code == 401


class TestPublicGetBySlug:
    def test_success(self, client, api_key_raw, session):
        _create_full_tenant(session, slug="my_tenant")
        resp = client.get("/api/v1/tenants/my_tenant", headers=_headers(api_key_raw))
        assert resp.status_code == 200
        info = resp.json()[0]["dados"]
        assert info["tenant"] == "my_tenant"

    def test_not_found(self, client, api_key_raw, session):
        resp = client.get("/api/v1/tenants/nonexistent", headers=_headers(api_key_raw))
        assert resp.status_code == 404
        body = resp.json()["error"]
        assert body["code"] == "TENANT_NOT_FOUND"

    def test_inactive_hidden(self, client, api_key_raw, session):
        _create_full_tenant(session, slug="inactive_tenant", is_active=False)
        resp = client.get("/api/v1/tenants/inactive_tenant", headers=_headers(api_key_raw))
        assert resp.status_code == 404

    def test_single_tenant_format(self, client, api_key_raw, session):
        _create_full_tenant(session, slug="fmt_check")
        resp = client.get("/api/v1/tenants/fmt_check", headers=_headers(api_key_raw))
        data = resp.json()
        # Wrapped in [{ "dados": { "tenant": "...", ... } }]
        assert isinstance(data, list)
        assert len(data) == 1
        assert "dados" in data[0]
        assert isinstance(data[0]["dados"], dict)
        assert data[0]["dados"]["tenant"] == "fmt_check"
