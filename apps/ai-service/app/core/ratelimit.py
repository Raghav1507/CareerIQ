"""In-memory fixed-window rate limiting for the AI service.

The service is a single process behind one port, so a process-local counter is
sufficient. Keys are `<client ip>:<path>` — the only callers are the web
server and internal tooling, which already authenticate with the internal key.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("careeriq.ai.ratelimit")

SkipPredicate = Callable[[Request], bool]


def _client_key(request: Request, path: str) -> str:
    host = request.client.host if request.client else "unknown"
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        host = forwarded.split(",")[0].strip() or host
    return f"{host}:{path}"


class FixedWindowRateLimit(BaseHTTPMiddleware):
    """Allow at most `limit` requests per `window_seconds` per key."""

    def __init__(
        self,
        app,  # type: ignore[no-untyped-def]
        limit: int,
        window_seconds: float = 60.0,
        skip: SkipPredicate | None = None,
    ) -> None:
        super().__init__(app)
        self.limit = limit
        self.window = window_seconds
        self.skip = skip or (lambda _: False)
        self._buckets: dict[str, tuple[int, float]] = {}
        self._last_prune = 0.0

    def _prune(self, now: float) -> None:
        if now - self._last_prune < 30.0 and len(self._buckets) < 10_000:
            return
        self._last_prune = now
        expired = [k for k, (_, reset) in self._buckets.items() if reset <= now]
        for k in expired:
            del self._buckets[k]

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if self.limit <= 0 or self.skip(request):
            return await call_next(request)

        path = request.url.path
        now = time.monotonic()
        self._prune(now)

        key = _client_key(request, path)
        count, reset = self._buckets.get(key, (0, 0.0))
        if now >= reset:
            count, reset = 0, now + self.window
        count += 1
        self._buckets[key] = (count, reset)

        if count > self.limit:
            retry_after = max(1, int(reset - now) + 1)
            logger.warning("rate limit exceeded for %s (limit=%s)", key, self.limit)
            return JSONResponse(
                status_code=429,
                content={
                    "error": {
                        "code": "RATE_LIMITED",
                        "message": f"Rate limit exceeded. Retry in {retry_after}s.",
                    }
                },
                headers={"Retry-After": str(retry_after)},
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.limit)
        response.headers["X-RateLimit-Remaining"] = str(max(0, self.limit - count))
        return response


def is_skipped_path(request: Request) -> bool:
    """Health probes and docs are never rate limited."""
    path = request.url.path
    return path in {"/", "/health", "/health/ready", "/docs", "/openapi.json"} or path.startswith(
        "/health"
    )
