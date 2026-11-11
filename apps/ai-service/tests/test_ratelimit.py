from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.ratelimit import FixedWindowRateLimit, is_skipped_path


def _app_with_limit(limit: int, skip=None) -> FastAPI:
    app = FastAPI()

    @app.get("/work")
    async def work() -> dict[str, bool]:
        return {"ok": True}

    app.add_middleware(
        FixedWindowRateLimit, limit=limit, window_seconds=60.0, skip=skip
    )
    return app


def test_allows_up_to_limit_then_blocks() -> None:
    with TestClient(_app_with_limit(3)) as client:
        for _ in range(3):
            resp = client.get("/work")
            assert resp.status_code == 200
            assert resp.headers["X-RateLimit-Limit"] == "3"

        blocked = client.get("/work")
        assert blocked.status_code == 429
        body = blocked.json()
        assert body["error"]["code"] == "RATE_LIMITED"
        assert int(blocked.headers["Retry-After"]) >= 1


def test_zero_limit_disables_middleware() -> None:
    with TestClient(_app_with_limit(0)) as client:
        for _ in range(10):
            assert client.get("/work").status_code == 200


def test_health_paths_are_skipped() -> None:
    app = FastAPI()

    @app.get("/health")
    async def health() -> dict[str, bool]:
        return {"ok": True}

    app.add_middleware(
        FixedWindowRateLimit, limit=1, window_seconds=60.0, skip=is_skipped_path
    )
    with TestClient(app) as client:
        for _ in range(5):
            assert client.get("/health").status_code == 200
        # the limiter still applies to non-skipped paths on the same app
        @app.get("/other")
        async def other() -> dict[str, bool]:
            return {"ok": True}

        assert client.get("/other").status_code == 200
        assert client.get("/other").status_code == 429
