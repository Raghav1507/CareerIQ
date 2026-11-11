"""Service-to-service and user authentication for the AI service.

Two independent layers (both required for user-scoped endpoints):

1. ``X-Internal-API-Key``  — shared secret proving the caller is the CareerIQ
   Next.js server (FastAPI is never exposed to the browser in production).
2. ``Authorization: Bearer <supabase access token>`` — RS256 JWT verified
   against Supabase's JWKS endpoint (aud/exp checks), proving which end user
   the operation belongs to.
"""

from __future__ import annotations

import hmac
import time
from typing import Any

import httpx
import jwt
from fastapi import Header, HTTPException, status
from jwt.algorithms import RSAAlgorithm

from app.core.config import settings

INTERNAL_KEY_HEADER = "X-Internal-Key"
INTERNAL_KEY_HEADER_ALT = "X-Internal-API-Key"


class SecurityError(Exception):
    """Raised when authentication/authorisation fails."""

    def __init__(self, code: str, message: str, status_code: int = 401) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


def verify_internal_key(provided: str | None) -> None:
    """Validate the shared service-to-service secret."""
    if not settings.internal_key_configured:
        raise SecurityError(
            "INTERNAL_KEY_NOT_CONFIGURED",
            "INTERNAL_API_KEY is not configured on the AI service.",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    if not provided:
        raise SecurityError(
            "MISSING_INTERNAL_KEY",
            "Missing service-to-service API key.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )
    if not hmac.compare_digest(provided.encode("utf-8"), settings.internal_api_key.encode("utf-8")):
        raise SecurityError(
            "INVALID_INTERNAL_KEY",
            "Invalid service-to-service API key.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )


class SupabaseJWTVerifier:
    """Verifies Supabase access tokens using the project's JWKS (RS256)."""

    def __init__(
        self, supabase_url: str, audience: str = "authenticated", cache_ttl: int = 300
    ) -> None:
        self.supabase_url = supabase_url.rstrip("/")
        self.jwks_url = f"{self.supabase_url}/auth/v1/.well-known/jwks.json"
        self.audience = audience
        self.cache_ttl = cache_ttl
        self._keys: dict[str, Any] = {}
        self._fetched_at: float = 0.0

    async def _fetch_keys(self, force: bool = False) -> dict[str, Any]:
        now = time.monotonic()
        if not force and self._keys and (now - self._fetched_at) < self.cache_ttl:
            return self._keys
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(self.jwks_url)
            resp.raise_for_status()
            data = resp.json()
        keys = {k["kid"]: k for k in data.get("keys", []) if "kid" in k}
        self._keys = keys
        self._fetched_at = now
        return keys

    async def verify(self, token: str) -> dict[str, Any]:
        """Return the decoded claims or raise SecurityError."""
        if not settings.supabase_configured:
            raise SecurityError(
                "SUPABASE_NOT_CONFIGURED",
                "SUPABASE_URL is not configured on the AI service.",
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        try:
            header = jwt.get_unverified_header(token)
        except jwt.PyJWTError as exc:  # pragma: no cover - defensive
            raise SecurityError("INVALID_TOKEN", f"Malformed token: {exc}") from exc

        kid = header.get("kid")
        keys = await self._fetch_keys()
        jwk = keys.get(kid)
        if jwk is None:
            keys = await self._fetch_keys(force=True)
            jwk = keys.get(kid)
        if jwk is None:
            raise SecurityError("UNKNOWN_SIGNING_KEY", "Token signing key not found in JWKS.")

        try:
            public_key = RSAAlgorithm.from_jwk(jwk)
            claims = jwt.decode(
                token,
                key=public_key,
                algorithms=["RS256"],
                audience=self.audience,
                options={"require": ["exp", "sub"]},
                leeway=5,
            )
        except jwt.ExpiredSignatureError as exc:
            raise SecurityError("TOKEN_EXPIRED", "Access token has expired.") from exc
        except jwt.PyJWTError as exc:
            raise SecurityError("INVALID_TOKEN", f"Token verification failed: {exc}") from exc

        if claims.get("role") not in (None, "authenticated", "user"):
            raise SecurityError("INVALID_TOKEN_ROLE", "Token role is not allowed.")
        return claims


_verifier: SupabaseJWTVerifier | None = None


def get_verifier() -> SupabaseJWTVerifier:
    global _verifier
    if _verifier is None or _verifier.supabase_url != settings.supabase_url.rstrip("/"):
        _verifier = SupabaseJWTVerifier(settings.supabase_url, audience=settings.jwt_audience)
    return _verifier


async def require_internal_key(
    x_internal_api_key: str | None = Header(default=None, alias=INTERNAL_KEY_HEADER_ALT),
    x_internal_key: str | None = Header(default=None, alias=INTERNAL_KEY_HEADER),
) -> None:
    """FastAPI dependency: service-to-service authentication."""
    verify_internal_key(x_internal_api_key or x_internal_key)


async def require_user(
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    """FastAPI dependency: end-user authentication via Supabase JWT."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise SecurityError("MISSING_TOKEN", "Missing Bearer access token.")
    token = authorization.split(" ", 1)[1].strip()
    return await get_verifier().verify(token)


def raise_security_error(err: SecurityError) -> HTTPException:
    return HTTPException(
        status_code=err.status_code,
        detail={"error": {"code": err.code, "message": err.message}},
    )
