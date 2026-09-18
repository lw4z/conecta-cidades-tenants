class TestLogin:
    def test_login_success(self, client, admin_user):
        resp = client.post("/api/auth/login", json={"username": "testadmin", "password": "testpass123"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["username"] == "testadmin"
        assert "access_token" in resp.cookies

    def test_login_wrong_password(self, client, admin_user):
        resp = client.post("/api/auth/login", json={"username": "testadmin", "password": "wrong"})
        assert resp.status_code == 401


class TestMe:
    def test_me_unauthenticated(self, client):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401

    def test_me_authenticated(self, auth_client, admin_user):
        resp = auth_client.get("/api/auth/me")
        assert resp.status_code == 200
        assert resp.json()["username"] == "testadmin"

    def test_logout(self, auth_client):
        resp = auth_client.post("/api/auth/logout")
        assert resp.status_code == 200
        # TestClient doesn't process Set-Cookie expiry, so clear manually
        auth_client.cookies.clear()
        resp2 = auth_client.get("/api/auth/me")
        assert resp2.status_code == 401

    def test_update_me_name(self, auth_client):
        resp = auth_client.put("/api/auth/me", json={"full_name": "New Name"})
        assert resp.status_code == 200
        assert resp.json()["full_name"] == "New Name"

    def test_update_me_password(self, auth_client):
        resp = auth_client.put(
            "/api/auth/me",
            json={"password": "newpass456", "current_password": "testpass123"},
        )
        assert resp.status_code == 200
        # Verify new password works
        resp2 = auth_client.post("/api/auth/login", json={"username": "testadmin", "password": "newpass456"})
        assert resp2.status_code == 200

    def test_update_me_password_wrong_current(self, auth_client):
        resp = auth_client.put(
            "/api/auth/me",
            json={"password": "newpass", "current_password": "wrongcurrent"},
        )
        assert resp.status_code == 400
