from app.core.security import decrypt_field, encrypt_field


class TestCreateTenant:
    def test_create_minimal(self, auth_client):
        resp = auth_client.post("/api/tenants", json={"tenant_slug": "test_slug"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["tenant_slug"] == "test_slug"
        assert data["is_active"] is True
        assert "id" in data

    def test_create_with_all_subtables(self, auth_client):
        payload = {
            "tenant_slug": "full_tenant",
            "display_name": "Full Tenant",
            "conecta": {"base_url": "https://conecta.example.com", "token": "ctoken123"},
            "whatsapp": {
                "provider": "turn-io",
                "base_url": "https://wa.example.com",
                "version": "v1",
                "access_token": "wa_at_123",
                "business_id": "biz123",
                "username": "wa_user",
                "password": "wa_pass",
                "token": "wa_token_123",
            },
            "chat": {
                "base_url": "https://chat.example.com",
                "account_id": 42,
                "api_access_token": "chat_token",
                "api_access_token_bot": "chat_bot_token",
                "csat_flow_id": "csat_123",
                "inboxes": [
                    {"inbox_id": 7, "inbox_identifier": "inbox_7", "ordem": 1},
                    {"inbox_id": 8, "inbox_identifier": "inbox_8", "ordem": 2},
                ],
            },
            "ai": {
                "api_key": "ai_key_123",
                "database": "mydb",
                "database_chat_histories": "mydb_hist",
                "nome_projeto": "proj",
                "nome_prefeitura": "pref",
                "url_projeto": "https://proj.example.com",
                "url_servico": "https://svc.example.com",
                "horario_cron": "0 8 * * 1-5",
                "horario_timezone": "America/Fortaleza",
                "horario_msg": "horario_msg_content",
            },
        }
        resp = auth_client.post("/api/tenants", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["tenant_slug"] == "full_tenant"
        assert data["conecta"]["base_url"] == "https://conecta.example.com"
        assert data["conecta"]["token"] == "ctoken123"
        assert data["whatsapp"]["access_token"] == "wa_at_123"
        assert data["whatsapp"]["password"] == "wa_pass"
        assert data["chat"]["api_access_token"] == "chat_token"
        assert len(data["chat"]["inboxes"]) == 2
        assert data["ai"]["api_key"] == "ai_key_123"

    def test_create_duplicate_slug(self, auth_client):
        auth_client.post("/api/tenants", json={"tenant_slug": "dup_slug"})
        resp = auth_client.post("/api/tenants", json={"tenant_slug": "dup_slug"})
        assert resp.status_code == 409

    def test_create_unauthenticated(self, client):
        resp = client.post("/api/tenants", json={"tenant_slug": "no_auth"})
        assert resp.status_code == 401


class TestListTenants:
    def test_list_empty(self, auth_client):
        resp = auth_client.get("/api/tenants")
        assert resp.status_code == 200
        data = resp.json()
        assert data["items"] == []
        assert data["total"] == 0

    def test_list_with_tenants(self, auth_client):
        for i in range(3):
            auth_client.post("/api/tenants", json={"tenant_slug": f"t_{i}"})
        resp = auth_client.get("/api/tenants")
        data = resp.json()
        assert data["total"] == 3
        assert len(data["items"]) == 3

    def test_list_pagination(self, auth_client):
        for i in range(5):
            auth_client.post("/api/tenants", json={"tenant_slug": f"t_{i}"})
        resp = auth_client.get("/api/tenants", params={"page": 1, "per_page": 2})
        data = resp.json()
        assert len(data["items"]) == 2
        assert data["total"] == 5

    def test_list_search(self, auth_client):
        auth_client.post("/api/tenants", json={"tenant_slug": "alpha_beta"})
        auth_client.post("/api/tenants", json={"tenant_slug": "gamma_delta"})
        resp = auth_client.get("/api/tenants", params={"search": "alpha"})
        data = resp.json()
        assert data["total"] == 1
        assert data["items"][0]["tenant_slug"] == "alpha_beta"

    def test_list_filter_active(self, auth_client):
        auth_client.post("/api/tenants", json={"tenant_slug": "active_one"})
        create_resp = auth_client.post("/api/tenants", json={"tenant_slug": "to_deactivate"})
        tid = create_resp.json()["id"]
        auth_client.patch(f"/api/tenants/{tid}/status")

        resp_active = auth_client.get("/api/tenants", params={"is_active": True})
        assert resp_active.json()["total"] == 1

        resp_inactive = auth_client.get("/api/tenants", params={"is_active": False})
        assert resp_inactive.json()["total"] == 1


class TestGetTenant:
    def test_get_detail(self, auth_client):
        create_resp = auth_client.post("/api/tenants", json={
            "tenant_slug": "detail_test",
            "conecta": {"base_url": "https://x.com", "token": "tok123"},
        })
        tid = create_resp.json()["id"]
        resp = auth_client.get(f"/api/tenants/{tid}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["tenant_slug"] == "detail_test"
        assert data["conecta"]["token"] == "tok123"

    def test_get_not_found(self, auth_client):
        resp = auth_client.get("/api/tenants/99999")
        assert resp.status_code == 404


class TestUpdateTenant:
    def test_update_basic(self, auth_client):
        create_resp = auth_client.post("/api/tenants", json={"tenant_slug": "upd"})
        tid = create_resp.json()["id"]
        resp = auth_client.put(f"/api/tenants/{tid}", json={"display_name": "Updated"})
        assert resp.status_code == 200
        assert resp.json()["display_name"] == "Updated"

    def test_update_slug_conflict(self, auth_client):
        auth_client.post("/api/tenants", json={"tenant_slug": "slug1"})
        create_resp = auth_client.post("/api/tenants", json={"tenant_slug": "slug2"})
        tid = create_resp.json()["id"]
        resp = auth_client.put(f"/api/tenants/{tid}", json={"tenant_slug": "slug1"})
        assert resp.status_code == 409

    def test_update_not_found(self, auth_client):
        resp = auth_client.put("/api/tenants/99999", json={"display_name": "x"})
        assert resp.status_code == 404

    def test_update_subtables(self, auth_client):
        create_resp = auth_client.post("/api/tenants", json={"tenant_slug": "sub_upd"})
        tid = create_resp.json()["id"]
        resp = auth_client.put(f"/api/tenants/{tid}", json={
            "conecta": {"base_url": "https://new.url", "token": "newtok"},
        })
        assert resp.status_code == 200
        assert resp.json()["conecta"]["base_url"] == "https://new.url"
        assert resp.json()["conecta"]["token"] == "newtok"


class TestDeleteTenant:
    def test_delete(self, auth_client):
        create_resp = auth_client.post("/api/tenants", json={"tenant_slug": "del"})
        tid = create_resp.json()["id"]
        resp = auth_client.delete(f"/api/tenants/{tid}")
        assert resp.status_code == 204
        # Confirm gone
        resp2 = auth_client.get(f"/api/tenants/{tid}")
        assert resp2.status_code == 404

    def test_delete_not_found(self, auth_client):
        resp = auth_client.delete("/api/tenants/99999")
        assert resp.status_code == 404


class TestToggleStatus:
    def test_toggle_deactivate(self, auth_client):
        create_resp = auth_client.post("/api/tenants", json={"tenant_slug": "toggle"})
        tid = create_resp.json()["id"]
        resp = auth_client.patch(f"/api/tenants/{tid}/status")
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False

    def test_toggle_reactivate(self, auth_client):
        create_resp = auth_client.post("/api/tenants", json={"tenant_slug": "toggle2"})
        tid = create_resp.json()["id"]
        auth_client.patch(f"/api/tenants/{tid}/status")  # deactivate
        resp = auth_client.patch(f"/api/tenants/{tid}/status")  # reactivate
        assert resp.status_code == 200
        assert resp.json()["is_active"] is True

    def test_toggle_not_found(self, auth_client):
        resp = auth_client.patch("/api/tenants/99999/status")
        assert resp.status_code == 404


class TestEncryptedFields:
    def test_encrypt_decrypt_roundtrip(self, auth_client):
        payload = {
            "tenant_slug": "enc_test",
            "conecta": {"token": "secret_conecta_token"},
            "whatsapp": {
                "access_token": "secret_wa_at",
                "password": "secret_wa_pass",
                "token": "secret_wa_token",
            },
            "chat": {
                "api_access_token": "secret_chat_token",
                "api_access_token_bot": "secret_chat_bot",
            },
            "ai": {"api_key": "secret_ai_key"},
        }
        create_resp = auth_client.post("/api/tenants", json=payload)
        assert create_resp.status_code == 201
        tid = create_resp.json()["id"]

        # Read back — values should be decrypted
        detail = auth_client.get(f"/api/tenants/{tid}").json()
        assert detail["conecta"]["token"] == "secret_conecta_token"
        assert detail["whatsapp"]["access_token"] == "secret_wa_at"
        assert detail["whatsapp"]["password"] == "secret_wa_pass"
        assert detail["chat"]["api_access_token"] == "secret_chat_token"
        assert detail["ai"]["api_key"] == "secret_ai_key"
