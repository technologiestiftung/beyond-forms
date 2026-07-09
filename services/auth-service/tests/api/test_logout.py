def test_logout_endpoint(client):
    response = client.post("/logout")
    assert response.status_code == 200
    assert response.json() == {"message": "Logged out successfully"}
    # Verify cookie is deleted
    set_cookie = response.headers.get("set-cookie", "")
    assert "authentik_session=" in set_cookie
    assert "Max-Age=0" in set_cookie
