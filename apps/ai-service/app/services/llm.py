"""Gemini explanation generation — advisory text only.

The LLM NEVER computes scores. Every number is produced by the deterministic
M1 formula in the web app; Gemini only turns that evidence into prose.
When no key is configured (or the call fails) the caller falls back to its
rule-based template, so the product never fakes an AI response.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger("careeriq.ai.llm")

GEMINI_ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
)

RECOMMENDATION_PROMPT = """\
You are CareerIQ, a career-coaching assistant. You will receive a JSON payload \
with ranked career-role matches. Each entry already contains a Career Match Score \
computed with the official formula:

    score = (weighted_matched / weighted_required) * 100

Your job: write ONE short explanation per entry (2-3 sentences) that describes the \
given evidence in plain language. Mention which key required skills are matched and \
which top gaps remain. STRICT RULES:
- Never invent skills, numbers or ranks that are not in the payload.
- Never recompute or change any score.
- Return ONLY a JSON array of strings, same length and order as the input array.
- No markdown, no commentary.

Payload:
{payload}
"""

JOB_PROMPT = """\
You are CareerIQ. A candidate's compatibility score for a job posting was already \
computed as: score = (matched_skills / job_skills) * 100, where every listed job skill \
is required (weight 2.0). Write 2-3 sentences explaining the result: which required \
skills the candidate already has and which gaps matter most. STRICT RULES:
- Only mention skills present in the payload.
- Never change or recompute the score.
- Plain text only, no markdown.

Payload:
{payload}
"""

GAP_PROMPT = """\
You are CareerIQ, a career coach. A skill-gap analysis was already computed with the \
official M1 formula: gap = 100 - match_score, where \
match_score = (weighted_matched / weighted_required) * 100 (required weight 2.0, optional 1.0).
Write 2-3 sentences of prioritised, practical advice: which required gaps to close first \
(highest weight first) and which optional skills matter after that. STRICT RULES:
- Only mention skills present in the payload.
- Never invent skills, numbers or percentages.
- Plain text only, no markdown.

Payload:
{payload}
"""

ROADMAP_PROMPT = """\
You are CareerIQ. A weekly learning roadmap was already generated deterministically \
from a skill gap (required skills first, estimated hours per skill). You will receive a \
JSON array of weeks: {week, title, objectives[], items:[{skill, est_hours, is_required}]}.
Rewrite the `objectives` of every week so they are concrete, actionable learning goals \
(2-4 objectives per week) that reference only the skills and hours given. STRICT RULES:
- Return ONLY a JSON array of arrays of strings — same length and order as the input, \
one objectives array per week.
- Never invent skills, hours or weeks that are not in the payload.
- No markdown, no commentary.

Payload:
{payload}
"""


def _gemini_models() -> list[str]:
    models = [settings.gemini_model]
    if settings.gemini_fallback_model and settings.gemini_fallback_model != settings.gemini_model:
        models.append(settings.gemini_fallback_model)
    return models


async def _call_gemini(prompt: str) -> str | None:
    if settings.llm_provider != "gemini" or not settings.gemini_api_key:
        return None

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 4096},
    }
    async with httpx.AsyncClient(timeout=httpx.Timeout(45.0)) as client:
        for model in _gemini_models():
            url = GEMINI_ENDPOINT.format(model=model)
            for attempt in range(2):
                try:
                    resp = await client.post(
                        url, params={"key": settings.gemini_api_key}, json=payload
                    )
                    if resp.status_code >= 400:
                        logger.warning(
                            "gemini %s -> HTTP %s: %s", model, resp.status_code, resp.text[:200]
                        )
                        # transient 5xx (high demand) — brief backoff, then retry/next model
                        if resp.status_code >= 500 and attempt == 0:
                            await asyncio.sleep(1.5)
                            continue
                        break
                    data = resp.json()
                    text = (
                        data.get("candidates", [{}])[0]
                        .get("content", {})
                        .get("parts", [{}])[0]
                        .get("text", "")
                        .strip()
                    )
                    if text:
                        return text
                    break
                except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
                    logger.warning("gemini %s failed: %s", model, exc)
                    if attempt == 0:
                        await asyncio.sleep(1.5)
                        continue
                    break
    return None


def _extract_json_array(raw: str) -> Any | None:
    """Parse a JSON array even if wrapped in prose/markdown or lightly truncated."""
    cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    start, end = cleaned.find("["), cleaned.rfind("]")
    if start != -1 and end > start:
        try:
            return json.loads(cleaned[start : end + 1])
        except json.JSONDecodeError:
            return None
    return None


async def explain_recommendations(
    entries: list[dict[str, Any]],
) -> tuple[list[str] | None, str | None]:
    """Return one explanation per ranked entry, or None when Gemini is unavailable."""
    prompt = RECOMMENDATION_PROMPT.format(payload=json.dumps(entries, ensure_ascii=False))
    raw = await _call_gemini(prompt)
    if not raw:
        return None, None
    parsed = _extract_json_array(raw)
    if isinstance(parsed, list) and len(parsed) == len(entries):
        return [str(x) for x in parsed], settings.llm_model_used
    logger.warning("gemini returned unparseable recommendations (len=%s)", len(raw))
    return None, None


async def explain_job_match(payload: dict[str, Any]) -> tuple[str | None, str | None]:
    raw = await _call_gemini(JOB_PROMPT.format(payload=json.dumps(payload, ensure_ascii=False)))
    if not raw:
        return None, None
    text = raw.strip().removeprefix("```").removesuffix("```").strip()
    return (text or None), settings.llm_model_used


async def explain_gap(payload: dict[str, Any]) -> tuple[str | None, str | None]:
    """Prioritised gap advice as prose, or None so the caller keeps its template."""
    raw = await _call_gemini(GAP_PROMPT.format(payload=json.dumps(payload, ensure_ascii=False)))
    if not raw:
        return None, None
    text = raw.strip().removeprefix("```").removesuffix("```").strip()
    return (text or None), settings.llm_model_used


async def explain_roadmap(weeks: list[dict[str, Any]]) -> tuple[list[list[str]] | None, str | None]:
    """One objectives array per week, or None so the caller keeps its templates."""
    raw = await _call_gemini(ROADMAP_PROMPT.format(payload=json.dumps(weeks, ensure_ascii=False)))
    if not raw:
        return None, None
    parsed = _extract_json_array(raw)
    if (
        isinstance(parsed, list)
        and len(parsed) == len(weeks)
        and all(isinstance(w, list) and w and all(isinstance(o, str) for o in w) for w in parsed)
    ):
        return [[str(o) for o in w] for w in parsed], settings.llm_model_used
    logger.warning("gemini returned unparseable roadmap objectives (len=%s)", len(raw))
    return None, None
