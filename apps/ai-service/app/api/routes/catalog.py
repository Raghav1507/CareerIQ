"""Catalogue embedding endpoint (service-to-service).

The web app calls this to embed user-added (custom) skills so they can act as
pgvector cosine bridges behind the alias matcher. Scores are never produced
here — only deterministic vectors.
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.security import require_internal_key
from app.services.embedder import EmbeddingUnavailable, embedder

logger = logging.getLogger("careeriq.ai.catalog")
router = APIRouter(prefix="/api/v1/catalog", tags=["catalog"])

MAX_BATCH = 64
MAX_TEXT_LEN = 200


class EmbedRequest(BaseModel):
    texts: list[Annotated[str, Field(min_length=1, max_length=MAX_TEXT_LEN)]] = Field(
        min_length=1, max_length=MAX_BATCH
    )


@router.post("/embed", dependencies=[Depends(require_internal_key)])
def embed_texts(payload: EmbedRequest) -> JSONResponse:
    """Embed 1–64 short texts; returns one normalised vector per input."""
    try:
        vectors = embedder.embed(payload.texts)
    except EmbeddingUnavailable as exc:
        logger.warning("embedding unavailable: %s", exc)
        return JSONResponse(
            status_code=503,
            content={
                "error": {
                    "code": "EMBEDDING_UNAVAILABLE",
                    "message": str(exc),
                }
            },
        )
    return JSONResponse(
        content={
            "embeddings": vectors,
            "model": settings.embedding_model,
            "dim": settings.embedding_dim,
        }
    )
