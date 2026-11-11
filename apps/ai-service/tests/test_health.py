from __future__ import annotations


def test_health_returns_ok(client) -> None:
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["service"] == "CareerIQ AI Service"
    assert body["version"]
    assert body["time"]


def test_root_lists_endpoints(client) -> None:
    resp = client.get("/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["health"] == "/health"
    assert body["docs"] == "/docs"


def test_ping_requires_internal_key(client) -> None:
    resp = client.get("/api/v1/internal/ping")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "MISSING_INTERNAL_KEY"


def test_ping_rejects_wrong_internal_key(client) -> None:
    resp = client.get(
        "/api/v1/internal/ping", headers={"X-Internal-API-Key": "wrong-key-00000000000"}
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "INVALID_INTERNAL_KEY"


def test_ping_accepts_valid_internal_key(client, internal_key) -> None:
    resp = client.get("/api/v1/internal/ping", headers={"X-Internal-API-Key": internal_key})
    assert resp.status_code == 200
    body = resp.json()
    assert body["pong"] is True
    assert body["service"] == "CareerIQ AI Service"


def test_ready_reports_actual_configuration(client) -> None:
    resp = client.get("/health/ready")
    # 200 when core deps + internal key are present, otherwise 503 — never fake.
    assert resp.status_code in (200, 503)
    body = resp.json()
    assert body["status"] in ("ready", "not_ready")
    assert body["config"]["internal_api_key"] == "configured"
    assert "PyMuPDF" in body["dependencies"]
    assert "sentence-transformers" in body["dependencies"]
    assert isinstance(body["dependencies"]["PyMuPDF"]["installed"], bool)
    assert isinstance(body["dependencies"]["sentence-transformers"]["installed"], bool)
