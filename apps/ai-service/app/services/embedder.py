"""Lazy SentenceTransformer wrapper used by POST /api/v1/catalog/embed.

The model (all-MiniLM-L6-v2, 384-d) is loaded on first use and cached for the
life of the process. Failures raise :class:`EmbeddingUnavailable` so the
endpoint can answer 503 and the web app degrades to "no semantic matching"
instead of breaking.
"""

from __future__ import annotations

import logging
import threading

from app.core.config import settings

logger = logging.getLogger("careeriq.ai.embedder")


class EmbeddingUnavailable(RuntimeError):
    """The embedding model could not be loaded or run."""


class Embedder:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._model: object | None = None

    def _load(self) -> object:
        try:
            from sentence_transformers import SentenceTransformer
        except Exception as exc:  # pragma: no cover - import failure is env-specific
            raise EmbeddingUnavailable(f"sentence-transformers is not installed: {exc}") from exc
        try:
            model = SentenceTransformer(settings.embedding_model)
        except Exception as exc:
            raise EmbeddingUnavailable(
                f"could not load embedding model '{settings.embedding_model}': {exc}"
            ) from exc
        logger.info("embedding model loaded: %s", settings.embedding_model)
        return model

    @property
    def model(self) -> object:
        with self._lock:
            if self._model is None:
                self._model = self._load()
            return self._model

    def embed(self, texts: list[str]) -> list[list[float]]:
        """Return one L2-normalised vector per input text (order preserved)."""
        try:
            vectors = self.model.encode(  # type: ignore[attr-defined]
                texts, normalize_embeddings=True, show_progress_bar=False
            )
        except EmbeddingUnavailable:
            raise
        except Exception as exc:
            raise EmbeddingUnavailable(f"embedding failed: {exc}") from exc

        dim = settings.embedding_dim
        out: list[list[float]] = []
        for vec in vectors:
            if len(vec) != dim:
                raise EmbeddingUnavailable(
                    f"model produced {len(vec)}-d vectors, expected {dim}"
                )
            out.append([round(float(x), 7) for x in vec])
        return out


embedder = Embedder()
