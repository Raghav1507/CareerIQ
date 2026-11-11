"""Security unit tests: internal API key + Supabase JWT/JWKS verification.

A real RS256 key pair is generated locally; JWKS fetching is stubbed so the
verification code path itself is exercised end-to-end.
"""

from __future__ import annotations

import json
import time

import jwt as pyjwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from app.core.config import settings
from app.core.security import (
    SecurityError,
    SupabaseJWTVerifier,
    verify_internal_key,
)

# ---------------------------------------------------------------------------
# Internal API key
# ---------------------------------------------------------------------------


def test_internal_key_accepts_matching_value() -> None:
    verify_internal_key(settings.internal_api_key)


def test_internal_key_rejects_wrong_value() -> None:
    with pytest.raises(SecurityError) as exc:
        verify_internal_key("definitely-not-the-key")
    assert exc.value.code == "INVALID_INTERNAL_KEY"
    assert exc.value.status_code == 401


def test_internal_key_rejects_missing_value() -> None:
    with pytest.raises(SecurityError) as exc:
        verify_internal_key(None)
    assert exc.value.code == "MISSING_INTERNAL_KEY"


def test_internal_key_fails_closed_when_unconfigured(monkeypatch) -> None:
    monkeypatch.setattr(settings, "internal_api_key", "")
    with pytest.raises(SecurityError) as exc:
        verify_internal_key("anything-at-all")
    assert exc.value.code == "INTERNAL_KEY_NOT_CONFIGURED"
    assert exc.value.status_code == 503


# ---------------------------------------------------------------------------
# Supabase JWT verification (RS256 + JWKS)
# ---------------------------------------------------------------------------


@pytest.fixture()
def rsa_keypair():
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_jwk = json.loads(pyalgorithm_to_jwk(private_key))
    public_jwk.update({"kid": "test-key-1", "use": "sig", "alg": "RS256"})
    return private_pem, public_jwk


def pyalgorithm_to_jwk(private_key) -> str:
    return pyjwt.algorithms.RSAAlgorithm.to_jwk(private_key.public_key())


@pytest.fixture()
def verifier(monkeypatch, rsa_keypair):
    _, public_jwk = rsa_keypair
    v = SupabaseJWTVerifier("https://test-project.supabase.co")

    async def fake_fetch(force: bool = False) -> dict:
        return {"test-key-1": public_jwk}

    monkeypatch.setattr(v, "_fetch_keys", fake_fetch)
    return v


def _make_token(private_pem: bytes, *, exp_offset: int = 3600, aud: str = "authenticated",
                kid: str = "test-key-1", sub: str = "user-123") -> str:
    now = int(time.time())
    return pyjwt.encode(
        {
            "sub": sub,
            "aud": aud,
            "role": "authenticated",
            "iss": "supabase",
            "exp": now + exp_offset,
            "iat": now,
        },
        private_pem,
        algorithm="RS256",
        headers={"kid": kid},
    )


@pytest.mark.asyncio
async def test_valid_token_is_accepted(verifier, rsa_keypair) -> None:
    private_pem, _ = rsa_keypair
    claims = await verifier.verify(_make_token(private_pem))
    assert claims["sub"] == "user-123"
    assert claims["role"] == "authenticated"


@pytest.mark.asyncio
async def test_expired_token_is_rejected(verifier, rsa_keypair) -> None:
    private_pem, _ = rsa_keypair
    token = _make_token(private_pem, exp_offset=-3600)
    with pytest.raises(SecurityError) as exc:
        await verifier.verify(token)
    assert exc.value.code == "TOKEN_EXPIRED"


@pytest.mark.asyncio
async def test_wrong_audience_is_rejected(verifier, rsa_keypair) -> None:
    private_pem, _ = rsa_keypair
    token = _make_token(private_pem, aud="someone-else")
    with pytest.raises(SecurityError) as exc:
        await verifier.verify(token)
    assert exc.value.code == "INVALID_TOKEN"


@pytest.mark.asyncio
async def test_tampered_signature_is_rejected(verifier) -> None:
    other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    other_pem = other_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    token = _make_token(other_pem)
    with pytest.raises(SecurityError) as exc:
        await verifier.verify(token)
    assert exc.value.code == "INVALID_TOKEN"


@pytest.mark.asyncio
async def test_unknown_kid_is_rejected(verifier, rsa_keypair) -> None:
    private_pem, _ = rsa_keypair
    token = _make_token(private_pem, kid="unknown-kid")
    with pytest.raises(SecurityError) as exc:
        await verifier.verify(token)
    assert exc.value.code == "UNKNOWN_SIGNING_KEY"


@pytest.mark.asyncio
async def test_unconfigured_supabase_fails_closed(monkeypatch) -> None:
    monkeypatch.setattr(settings, "supabase_url", "")
    v = SupabaseJWTVerifier("")
    with pytest.raises(SecurityError) as exc:
        await v.verify("any-token")
    assert exc.value.code == "SUPABASE_NOT_CONFIGURED"
    assert exc.value.status_code == 503
