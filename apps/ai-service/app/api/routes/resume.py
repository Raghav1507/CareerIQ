"""Resume extraction endpoint (service-to-service, internal API key)."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.security import require_internal_key
from app.services.resume_extract import ResumeExtractError, extract_pdf, parse_resume

logger = logging.getLogger("careeriq.ai.resume")
router = APIRouter(prefix="/api/v1/resume", tags=["resume"])


@router.post("/extract", dependencies=[Depends(require_internal_key)])
async def extract_resume(file: UploadFile = File(...)) -> JSONResponse:  # noqa: B008
    if not settings.internal_key_configured:
        return JSONResponse(
            status_code=503,
            content={"error": {"code": "NOT_CONFIGURED", "message": "INTERNAL_API_KEY missing."}},
        )

    data = await file.read()
    try:
        text, pages = extract_pdf(data)
        parsed = parse_resume(text)
    except ResumeExtractError as exc:
        return JSONResponse(
            status_code=422,
            content={"error": {"code": exc.code, "message": exc.message}},
        )

    excerpt = text[:1500]
    logger.info(
        "extracted resume: %s bytes, %s pages, %s skills",
        len(data),
        pages,
        len(parsed["skills"]),
    )
    return JSONResponse(
        content={
            "page_count": pages,
            "model_used": "pymupdf+alias-matcher-v1",
            "raw_text_excerpt": excerpt,
            "parsed": parsed,
        }
    )
