"""FastAPI application entry point."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import catalog, explain, health, jobs, resume
from app.core.config import settings
from app.core.logging import configure_logging
from app.core.ratelimit import FixedWindowRateLimit, is_skipped_path
from app.core.security import SecurityError

configure_logging()
logger = logging.getLogger("careeriq.ai")


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info(
        "starting %s v%s (env=%s, llm=%s, supabase=%s)",
        settings.app_name,
        settings.version,
        settings.environment,
        settings.llm_provider,
        "configured" if settings.supabase_configured else "not configured",
    )
    if not settings.internal_key_configured:
        logger.warning(
            "INTERNAL_API_KEY is not configured — service-to-service endpoints will return 503"
        )
    yield
    logger.info("shutting down")


app = FastAPI(
    title="CareerIQ AI Service",
    description=(
        "Dedicated AI processing service for the CareerIQ platform: "
        "PDF resume extraction (PyMuPDF), NLP (spaCy), embeddings "
        "(Sentence Transformers), semantic matching (pgvector/cosine) and "
        "LLM-generated explanations (Gemini/OpenAI). "
        "Numerical scores are always computed deterministically — never by the LLM."
    ),
    version=settings.version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Internal-API-Key", "X-Internal-Key"],
)

if settings.rate_limit_per_minute > 0:
    app.add_middleware(
        FixedWindowRateLimit,
        limit=settings.rate_limit_per_minute,
        window_seconds=60.0,
        skip=is_skipped_path,
    )

app.include_router(health.router)
app.include_router(resume.router)
app.include_router(jobs.router)
app.include_router(explain.router)
app.include_router(catalog.router)


@app.exception_handler(SecurityError)
async def security_error_handler(_: Request, exc: SecurityError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message}},
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("unhandled error: %s", exc)
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred while processing the request.",
            }
        },
    )


@app.get("/", include_in_schema=False)
async def root() -> JSONResponse:
    return JSONResponse(
        content={
            "service": settings.app_name,
            "version": settings.version,
            "docs": "/docs",
            "health": "/health",
        }
    )
