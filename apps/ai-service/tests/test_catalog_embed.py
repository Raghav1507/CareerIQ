"""Tests for POST /api/v1/catalog/embed (no real model is loaded)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.services.embedder import EmbeddingUnavailable, embedder

TEXTS = ["Bun Runtime", "SvelteKit"]


def _patch_embed(monkeypatch: pytest.MonkeyPatch, vectors: list[list[float]]) -> None:
    monkeypatch.setattr(embedder, "embed", lambda texts: vectors[: len(texts)])


def test_embed_requires_internal_key(client: TestClient) -> None:
    res = client.post("/api/v1/catalog/embed", json={"texts": TEXTS})
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "MISSING_INTERNAL_KEY"


def test_embed_rejects_empty_batch(client: TestClient, internal_key: str) -> None:
    res = client.post(
        "/api/v1/catalog/embed",
        json={"texts": []},
        headers={"X-Internal-API-Key": internal_key},
    )
    assert res.status_code == 422


def test_embed_rejects_oversized_batch(client: TestClient, internal_key: str) -> None:
    res = client.post(
        "/api/v1/catalog/embed",
        json={"texts": ["x"] * 65},
        headers={"X-Internal-API-Key": internal_key},
    )
    assert res.status_code == 422


def test_embed_returns_one_vector_per_text(
    client: TestClient, internal_key: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    dim = 384
    _patch_embed(monkeypatch, [[0.01] * dim, [0.02] * dim])
    res = client.post(
        "/api/v1/catalog/embed",
        json={"texts": TEXTS},
        headers={"X-Internal-API-Key": internal_key},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["dim"] == dim
    assert len(body["embeddings"]) == len(TEXTS)
    assert all(len(v) == dim for v in body["embeddings"])


def test_embed_unavailable_model_returns_503(
    client: TestClient, internal_key: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    def _boom(texts: list[str]) -> list[list[float]]:
        raise EmbeddingUnavailable("model download failed")

    monkeypatch.setattr(embedder, "embed", _boom)
    res = client.post(
        "/api/v1/catalog/embed",
        json={"texts": TEXTS},
        headers={"X-Internal-API-Key": internal_key},
    )
    assert res.status_code == 503
    assert res.json()["error"]["code"] == "EMBEDDING_UNAVAILABLE"
