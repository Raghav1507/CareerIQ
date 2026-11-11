"""Explain endpoints — Gemini-backed, with honest fallback to the caller."""

from __future__ import annotations

import logging
from typing import Any, Literal

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.security import require_internal_key
from app.services import llm

logger = logging.getLogger("careeriq.ai.explain")
router = APIRouter(prefix="/api/v1/explain", tags=["explain"])


class ExplainRequest(BaseModel):
    kind: Literal["recommendations", "job_match", "skill_gap", "roadmap"] = Field(
        default="recommendations"
    )
    evidence: dict[str, Any] = Field(default_factory=dict)


@router.post("", dependencies=[Depends(require_internal_key)])
async def explain(payload: ExplainRequest) -> JSONResponse:
    """Gemini writes the prose; the caller keeps its deterministic template as fallback."""
    if payload.kind == "recommendations":
        entries = payload.evidence.get("entries", [])
        if not isinstance(entries, list) or not entries:
            return JSONResponse(
                status_code=422,
                content={"error": {"code": "BAD_EVIDENCE", "message": "entries[] required."}},
            )
    elif payload.kind == "roadmap":
        weeks = payload.evidence.get("weeks", [])
        if not isinstance(weeks, list) or not weeks:
            return JSONResponse(
                status_code=422,
                content={"error": {"code": "BAD_EVIDENCE", "message": "weeks[] required."}},
            )

    if not settings.llm_configured:
        return JSONResponse(
            content={
                "explanation": None,
                "explanations": None,
                "model_used": None,
                "provider": settings.llm_provider,
                "reason": "llm_not_configured",
            }
        )

    if payload.kind == "recommendations":
        explanations, model = await llm.explain_recommendations(entries)
        return JSONResponse(
            content={
                "explanations": explanations,
                "explanation": None,
                "model_used": model,
                "provider": settings.llm_provider,
            }
        )

    if payload.kind == "roadmap":
        weeks = payload.evidence.get("weeks", [])
        objectives, model = await llm.explain_roadmap(weeks)
        return JSONResponse(
            content={
                "objectives": objectives,
                "explanation": None,
                "explanations": None,
                "model_used": model,
                "provider": settings.llm_provider,
            }
        )

    if payload.kind == "skill_gap":
        explanation, model = await llm.explain_gap(payload.evidence)
        return JSONResponse(
            content={
                "explanation": explanation,
                "explanations": None,
                "model_used": model,
                "provider": settings.llm_provider,
            }
        )

    explanation, model = await llm.explain_job_match(payload.evidence)
    return JSONResponse(
        content={
            "explanation": explanation,
            "explanations": None,
            "model_used": model,
            "provider": settings.llm_provider,
        }
    )
