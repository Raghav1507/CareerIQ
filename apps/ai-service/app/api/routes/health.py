from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.deps import collect_dependency_status
from app.core.security import require_internal_key

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> JSONResponse:
    """Public liveness probe. No secrets, no dependencies on external services."""
    return JSONResponse(
        status_code=200,
        content={
            "status": "ok",
            "service": settings.app_name,
            "version": settings.version,
            "environment": settings.environment,
            "time": datetime.now(UTC).isoformat(),
        },
    )


@router.get("/health/ready")
async def ready() -> JSONResponse:
    """Readiness probe: reports configuration and optional AI dependencies.

    Never fabricates availability — every field reflects a real check.
    """
    dependencies = collect_dependency_status()
    core_ready = all(
        dependencies[name]["installed"] for name in ("PyJWT", "httpx")
    )
    config = {
        "internal_api_key": "configured" if settings.internal_key_configured else "missing",
        "supabase": "configured" if settings.supabase_configured else "not_configured",
        "llm": (
            f"{settings.llm_provider}:{'configured' if settings.llm_configured else 'missing_key'}"
        ),
        "embedding_model": settings.embedding_model,
        "embedding_dim": settings.embedding_dim,
    }
    ready = core_ready and settings.internal_key_configured
    return JSONResponse(
        status_code=200 if ready else 503,
        content={
            "status": "ready" if ready else "not_ready",
            "service": settings.app_name,
            "version": settings.version,
            "config": config,
            "dependencies": dependencies,
            "time": datetime.now(UTC).isoformat(),
        },
    )


@router.get("/api/v1/internal/ping", dependencies=[Depends(require_internal_key)])
async def ping() -> JSONResponse:
    """Authenticated service-to-service probe used by Next.js /api/health."""
    return JSONResponse(
        status_code=200,
        content={
            "pong": True,
            "service": settings.app_name,
            "version": settings.version,
            "time": datetime.now(UTC).isoformat(),
        },
    )
