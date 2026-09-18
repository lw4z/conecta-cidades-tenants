import json


class TestExportEmpty:
    def test_returns_empty_dict(self, auth_client):
        resp = auth_client.get("/api/tenants/export")
        assert resp.status_code == 200
        assert resp.json() == {}


class TestExportWithTenants:
    def test_returns_correct_format(self, auth_client):
        # Create a tenant with all sub-tables
        auth_client.post("/api/tenants", json={
            "tenant_slug": "export_test",
            "display_name": "Export Test",
            "conecta": {"base_url": "https://c.example.com", "token": "ctok"},
            "whatsapp": {
                "provider": "turn-io",
                "base_url": "https://w.example.com",
                "version": "v1",
                "access_token": "wa_at",
                "business_id": "biz",
                "template_namespace": "ns",
                "username": "user",
                "password": "pass",
                "token": "wa_tok",
            },
            "chat": {
                "base_url": "https://ch.example.com",
                "account_id": 7,
                "api_access_token": "ch_tok",
                "api_access_token_bot": "ch_bot",
                "csat_flow_id": "csat1",
                "inboxes": [{"inbox_id": 3, "inbox_identifier": "id_3", "ordem": 0}],
            },
            "ai": {
                "api_key": "ai_key",
                "database": "db1",
                "database_chat_histories": "db2",
                "nome_projeto": "proj",
                "nome_prefeitura": "pref",
                "url_projeto": "https://p.example.com",
                "url_servico": "https://s.example.com",
                "horario_cron": "0 8 * * 1-5",
                "horario_timezone": "America/Fortaleza",
                "horario_msg": "horario_msg",
            },
        })

        resp = auth_client.get("/api/tenants/export")
        assert resp.status_code == 200
        data = resp.json()
        assert "export_test" in data

        t = data["export_test"]
        assert t["tenant"] == "export_test"
        # Kebab-case whatsapp keys (nested under provider key)
        assert t["whatsapp"]["turn-io"]["access-token"] == "wa_at"
        assert t["whatsapp"]["turn-io"]["business-id"] == "biz"
        assert t["whatsapp"]["turn-io"]["template-namespace"] == "ns"
        # Nested horario
        assert t["ai"]["horario_funcionamento"]["cron"] == "0 8 * * 1-5"
        assert t["ai"]["horario_funcionamento"]["time_zone"] == "America/Fortaleza"
        # Chat inbox uses "id" not "inbox_id"
        assert t["chat"]["inbox"][0]["id"] == 3
        assert t["chat"]["csat"]["flow_id"] == "csat1"
        # Content-Disposition header
        assert "tenants-export.json" in resp.headers.get("content-disposition", "")


class TestImportCreatesNew:
    def test_creates_new_tenant(self, auth_client):
        payload = {
            "new_tenant": {
                "tenant": "new_tenant",
                "conecta": {"base_url": "https://c.example.com", "token": "tok1"},
                "whatsapp": {
                    "provider": "turn-io",
                    "turn-io": {
                        "base_url": "https://w.example.com",
                        "version": "v1",
                        "template-namespace": "ns",
                        "access-token": "at1",
                        "business-id": "biz1",
                        "username": "u1",
                        "password": "p1",
                        "token": "wt1",
                    },
                },
                "chat": {
                    "base_url": "https://ch.example.com",
                    "account_id": 5,
                    "api_access_token": "cat1",
                    "api_access_token_bot": "cbt1",
                    "inbox": [{"id": 10, "inbox_identifier": "inbox_10"}],
                    "csat": {"flow_id": "f1"},
                },
                "ai": {
                    "api_key": "ak1",
                    "database": "db",
                    "database_chat_histories": "dbh",
                    "nome_projeto": "proj",
                    "nome_prefeitura": "pref",
                    "url_projeto": "https://p.com",
                    "url_servico": "https://s.com",
                    "horario_funcionamento": {
                        "cron": "0 9 * * *",
                        "time_zone": "UTC",
                        "msg": "hello",
                    },
                },
            }
        }

        resp = auth_client.post("/api/tenants/import", json=payload)
        assert resp.status_code == 200
        summary = resp.json()
        assert summary["created"] == 1
        assert summary["updated"] == 0
        assert summary["errors"] == []

        # Verify tenant was created with correct format
        list_resp = auth_client.get("/api/tenants/export")
        data = list_resp.json()
        assert "new_tenant" in data
        assert data["new_tenant"]["whatsapp"]["turn-io"]["access-token"] == "at1"


class TestImportUpdatesExisting:
    def test_updates_existing_tenant(self, auth_client):
        # Create tenant first
        auth_client.post("/api/tenants", json={
            "tenant_slug": "update_me",
            "display_name": "Original",
            "conecta": {"base_url": "https://old.com", "token": "old_tok"},
        })

        payload = {
            "update_me": {
                "tenant": "update_me",
                "conecta": {"base_url": "https://new.com", "token": "new_tok"},
            }
        }

        resp = auth_client.post("/api/tenants/import", json=payload)
        assert resp.status_code == 200
        summary = resp.json()
        assert summary["created"] == 0
        assert summary["updated"] == 1

        # Verify update
        export = auth_client.get("/api/tenants/export").json()
        assert export["update_me"]["conecta"]["base_url"] == "https://new.com"
        assert export["update_me"]["conecta"]["token"] == "new_tok"


class TestImportFormatConversion:
    def test_converts_kebab_to_snake_and_nested_to_flat(self, auth_client):
        payload = {
            "conv_test": {
                "tenant": "conv_test",
                "whatsapp": {
                    "provider": "turn-io",
                    "turn-io": {
                        "access-token": "secret",
                        "business-id": "123",
                        "template-namespace": "ns1",
                    },
                },
                "chat": {
                    "inbox": [{"id": 1, "inbox_identifier": "inbox_1"}],
                    "csat": {"flow_id": "flow_abc"},
                },
                "ai": {
                    "horario_funcionamento": {
                        "cron": "*/5 * * * *",
                        "time_zone": "America/Sao_Paulo",
                        "msg": "test_msg",
                    },
                },
            }
        }

        resp = auth_client.post("/api/tenants/import", json=payload)
        assert resp.status_code == 200
        assert resp.json()["created"] == 1

        # Verify correct DB storage by re-exporting
        export = auth_client.get("/api/tenants/export").json()
        t = export["conv_test"]
        assert t["whatsapp"]["turn-io"]["access-token"] == "secret"
        assert t["whatsapp"]["turn-io"]["business-id"] == "123"
        assert t["chat"]["inbox"][0]["id"] == 1
        assert t["chat"]["csat"]["flow_id"] == "flow_abc"
        assert t["ai"]["horario_funcionamento"]["cron"] == "*/5 * * * *"


class TestImportInvalidJson:
    def test_returns_422_for_non_dict(self, auth_client):
        resp = auth_client.post("/api/tenants/import", json="not a dict")
        assert resp.status_code == 422


class TestExportUnauthenticated:
    def test_returns_401(self, client):
        resp = client.get("/api/tenants/export")
        assert resp.status_code == 401


class TestImportUnauthenticated:
    def test_returns_401(self, client):
        resp = client.post("/api/tenants/import", json={"test": {}})
        assert resp.status_code == 401


class TestImportIdempotent:
    def test_importing_same_file_twice_is_idempotent(self, auth_client):
        payload = {
            "idem_test": {
                "tenant": "idem_test",
                "conecta": {"base_url": "https://idem.com", "token": "tok"},
            }
        }

        resp1 = auth_client.post("/api/tenants/import", json=payload)
        assert resp1.json()["created"] == 1

        resp2 = auth_client.post("/api/tenants/import", json=payload)
        assert resp2.json()["updated"] == 1

        export = auth_client.get("/api/tenants/export").json()
        assert "idem_test" in export
        assert export["idem_test"]["conecta"]["token"] == "tok"
