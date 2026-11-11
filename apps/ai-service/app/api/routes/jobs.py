"""Job description skill extraction endpoint (service-to-service)."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.core.security import require_internal_key
from app.services.catalog import catalog

logger = logging.getLogger("careeriq.ai.jobs")
router = APIRouter(prefix="/api/v1/jobs", tags=["jobs"])


class JobParseRequest(BaseModel):
    text: str = Field(min_length=40, max_length=100_000)
    title: str | None = Field(default=None, max_length=300)
    company: str | None = Field(default=None, max_length=200)


@router.post("/skills", dependencies=[Depends(require_internal_key)])
def extract_job_skills(payload: JobParseRequest) -> JSONResponse:
    matches = catalog.match_text(payload.text)
    skills = catalog.skills_as_dicts(matches)
    logger.info("job parse: %s skills found", len(skills))
    return JSONResponse(
        content={
            "skills": skills,
            "model_used": "alias-matcher-v1",
            "title": payload.title,
            "company": payload.company,
        }
    )
