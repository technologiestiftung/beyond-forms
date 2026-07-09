def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    # User info should NOT be here anymore
    assert "user" not in data
    assert "is_authenticated" not in data
