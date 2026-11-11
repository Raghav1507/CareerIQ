"""Skill catalogue access and alias-normalised text matching.

The same normalisation rule is implemented in apps/web/src/lib/utils.ts:

    lowercase, strip every character except a-z0-9 + #

so that "React.js" = "React JS" = "ReactJS" on both sides of the stack.
"""

from __future__ import annotations

import re
import threading
import time
from dataclasses import dataclass

import psycopg

from app.core.config import settings

CACHE_TTL_SECONDS = 300
MIN_ALIAS_NORM_LEN = 2


def normalize_skill_name(name: str) -> str:
    """Lower-case and strip everything except a-z0-9+# (mirrors the web lib)."""
    return re.sub(r"[^a-z0-9+#]", "", name.lower())


def _alias_to_pattern(alias_norm: str) -> str:
    """Build a word-bounded regex allowing optional separators between chars.

    'reactjs' matches React.js / React JS / ReactJS; 'go' will not match
    inside 'algorithms' thanks to the look-around boundaries.
    """
    chars = list(alias_norm)
    parts: list[str] = []
    for i, ch in enumerate(chars):
        parts.append(re.escape(ch))
        if i < len(chars) - 1 and ch.isalnum() and chars[i + 1].isalnum():
            parts.append("[^a-z0-9]*")
    body = "".join(parts)
    return rf"(?<![a-z0-9]){body}(?![a-z0-9])"


@dataclass(frozen=True)
class CatalogSkill:
    skill_id: str
    slug: str
    name: str
    category: str


@dataclass(frozen=True)
class SkillMatch:
    slug: str
    name: str
    category: str
    confidence: float
    evidence: str


class SkillCatalog:
    """Loads skills + aliases from Postgres and matches free text against them."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._loaded_at = 0.0
        self._by_norm: dict[str, CatalogSkill] = {}
        self._regex: re.Pattern[str] | None = None

    # -- loading ------------------------------------------------------------

    def _load(self) -> None:
        if not settings.database_configured:
            raise RuntimeError("DATABASE_URL is not configured on the AI service")
        with psycopg.connect(settings.database_url) as conn, conn.cursor() as cur:
            cur.execute(
                """
                select s.id, s.slug, s.name, s.category,
                       coalesce(a.alias, s.name) as alias
                  from public.skills s
                  left join public.skill_aliases a on a.skill_id = s.id
                """
            )
            rows = cur.fetchall()

        by_norm: dict[str, CatalogSkill] = {}
        patterns: list[str] = []
        for skill_id, slug, name, category, alias in rows:
            skill = CatalogSkill(str(skill_id), slug, name, category)
            norm = normalize_skill_name(str(alias))
            if len(norm) < MIN_ALIAS_NORM_LEN:
                continue
            if norm not in by_norm:
                by_norm[norm] = skill
                patterns.append(_alias_to_pattern(norm))
        if not patterns:
            raise RuntimeError("skill catalogue is empty — run the seed migration")

        # longest aliases first so "nodejs" wins over a hypothetical "node"
        order = sorted(set(patterns), key=len, reverse=True)
        self._regex = re.compile("|".join(order), re.IGNORECASE)
        self._by_norm = by_norm
        self._loaded_at = time.time()

    def refresh(self, force: bool = False) -> None:
        with self._lock:
            if force or time.time() - self._loaded_at > CACHE_TTL_SECONDS or not self._by_norm:
                self._load()

    # -- matching -----------------------------------------------------------

    def match_text(self, text: str) -> list[SkillMatch]:
        """Return every catalogue skill evidenced in `text`, with the line of proof."""
        self.refresh()
        assert self._regex is not None

        # Pre-compute line boundaries so evidence stays human readable.
        lines: list[tuple[int, int, str]] = []
        offset = 0
        for raw_line in text.splitlines():
            end = offset + len(raw_line)
            lines.append((offset, end, raw_line.strip()))
            offset = end + 1  # account for \n

        found: dict[str, SkillMatch] = {}
        for m in self._regex.finditer(text):
            norm = normalize_skill_name(m.group(0))
            skill = self._by_norm.get(norm)
            if skill is None:
                continue
            evidence = ""
            for start, end, line in lines:
                if start <= m.start() <= end and line:
                    evidence = line[:240]
                    break
            if not evidence:
                evidence = text[max(0, m.start() - 60): m.end() + 60].strip()[:240]
            prev = found.get(skill.slug)
            if prev is None:
                found[skill.slug] = SkillMatch(
                    slug=skill.slug,
                    name=skill.name,
                    category=skill.category,
                    confidence=0.9,
                    evidence=evidence,
                )
        return sorted(found.values(), key=lambda m: m.name.lower())

    def skills_as_dicts(self, matches: list[SkillMatch]) -> list[dict]:
        return [
            {
                "slug": m.slug,
                "name": m.name,
                "category": m.category,
                "confidence": m.confidence,
                "evidence": m.evidence,
            }
            for m in matches
        ]


catalog = SkillCatalog()
