class TestCreateApiKey:
    def test_create_returns_key_once(self, auth_client):
        resp = auth_client.post("/api/api-keys", json={"name": "n8n-prod"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "n8n-prod"
        assert data["key"].startswith("ccat_")
        assert data["is_active"] is True
        assert "id" in data

    def test_create_duplicate_name(self, auth_client):
        auth_client.post("/api/api-keys", json={"name": "dup"})
        resp = auth_client.post("/api/api-keys", json={"name": "dup"})
        assert resp.status_code == 409

    def test_create_unauthenticated(self, client):
        resp = client.post("/api/api-keys", json={"name": "no_auth"})
        assert resp.status_code == 401


class TestListApiKeys:
    def test_list_empty(self, auth_client):
        resp = auth_client.get("/api/api-keys")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_never_returns_key(self, auth_client):
        auth_client.post("/api/api-keys", json={"name": "k1"})
        resp = auth_client.get("/api/api-keys")
        data = resp.json()
        assert len(data) == 1
        assert "key" not in data[0]
        assert "key_hash" not in data[0]
        assert data[0]["name"] == "k1"

    def test_list_unauthenticated(self, client):
        resp = client.get("/api/api-keys")
        assert resp.status_code == 401


class TestToggleApiKey:
    def test_toggle(self, auth_client):
        create_resp = auth_client.post("/api/api-keys", json={"name": "toggle_key"})
        kid = create_resp.json()["id"]
        resp = auth_client.patch(f"/api/api-keys/{kid}/status")
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False

    def test_toggle_not_found(self, auth_client):
        resp = auth_client.patch("/api/api-keys/99999/status")
        assert resp.status_code == 404


class TestDeleteApiKey:
    def test_delete(self, auth_client):
        create_resp = auth_client.post("/api/api-keys", json={"name": "del_key"})
        kid = create_resp.json()["id"]
        resp = auth_client.delete(f"/api/api-keys/{kid}")
        assert resp.status_code == 204

    def test_delete_not_found(self, auth_client):
        resp = auth_client.delete("/api/api-keys/99999")
        assert resp.status_code == 404
