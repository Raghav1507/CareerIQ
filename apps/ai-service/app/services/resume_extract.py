"""Resume PDF extraction: PyMuPDF text + heuristic section parsing + skill matching."""

from __future__ import annotations

import re

import pymupdf  # PyMuPDF

from app.core.config import settings
from app.services.catalog import catalog

SECTION_HEADINGS = {
    "summary": "summary",
    "objective": "summary",
    "profile": "summary",
    "about me": "summary",
    "education": "education",
    "experience": "experience",
    "work experience": "experience",
    "professional experience": "experience",
    "employment": "experience",
    "projects": "projects",
    "personal projects": "projects",
    "certifications": "certifications",
    "certificates": "certifications",
    "licenses": "certifications",
    "skills": "skills",
    "technical skills": "skills",
    "interests": "interests",
    "awards": "awards",
    "languages": "languages",
}

HEADING_RE = re.compile(r"^[A-Za-z][A-Za-z &/]{0,40}$")


class ResumeExtractError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def extract_pdf(data: bytes) -> tuple[str, int]:
    """Return (full_text, page_count) or raise ResumeExtractError."""
    if len(data) > settings.max_pdf_bytes:
        raise ResumeExtractError("PDF_TOO_LARGE", "File exceeds the 10 MB limit.")
    if not data.startswith(b"%PDF"):
        raise ResumeExtractError("NOT_A_PDF", "File is not a valid PDF (magic bytes missing).")
    try:
        doc = pymupdf.open(stream=data, filetype="pdf")
    except Exception as exc:  # noqa: BLE001 - surfaced to the caller
        raise ResumeExtractError("PDF_UNREADABLE", f"Could not open PDF: {exc}") from exc

    with doc:
        if doc.page_count == 0:
            raise ResumeExtractError("PDF_EMPTY", "PDF has no pages.")
        if doc.page_count > settings.max_pdf_pages:
            raise ResumeExtractError(
                "PDF_TOO_MANY_PAGES",
                f"PDF has {doc.page_count} pages (max {settings.max_pdf_pages}).",
            )
        pages = [page.get_text("text") for page in doc]
    text = "\n".join(pages).strip()
    if not text:
        raise ResumeExtractError(
            "PDF_NO_TEXT",
            "No selectable text found — scanned/image-only PDFs are not supported yet.",
        )
    return text, doc.page_count if False else len(pages)


def _split_sections(text: str) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {}
    current: str | None = None
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        key = line.lower().rstrip(":")
        if len(line) <= 40 and HEADING_RE.match(line) and key in SECTION_HEADINGS:
            current = SECTION_HEADINGS[key]
            sections.setdefault(current, [])
            continue
        if current:
            sections[current].append(line)
    return sections


def _chunk_education(lines: list[str]) -> list[dict]:
    entries: list[dict] = []
    for line in lines:
        if len(line) > 5:
            entries.append({"degree": line[:300]})
    return entries[:8]


def _chunk_certifications(lines: list[str]) -> list[dict]:
    return [{"name": line[:200]} for line in lines if 3 < len(line) <= 200][:12]


def _chunk_experience(lines: list[str]) -> list[dict]:
    """Group bullet lines under a date-bearing 'role — company (dates)' header."""
    date_re = re.compile(
        r"((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}"
        r"|\d{4})\s*[-–—to]+\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}"
        r"|\d{4}|present|current)",
        re.IGNORECASE,
    )
    entries: list[dict] = []
    current: dict | None = None
    for line in lines:
        if date_re.search(line) or (current is None and len(entries) == 0):
            header = line
            m = date_re.search(header)
            title = date_re.sub("", header).strip(" -–—|,") or header
            current = {
                "title": title[:200],
                "dates": m.group(0) if m else "",
                "bullets": [],
            }
            entries.append(current)
        elif current is not None:
            current["bullets"].append(line[:300])
    cleaned = []
    for e in entries:
        cleaned.append(
            {
                "title": e["title"],
                "dates": e["dates"],
                "description": "\n".join(e["bullets"][:8]) or None,
            }
        )
    return cleaned[:10]


def parse_resume(text: str) -> dict:
    """Structured, reviewable extraction — every field is confirmed by the user."""
    sections = _split_sections(text)
    matches = catalog.match_text(text)

    summary_lines = sections.get("summary", [])
    if not summary_lines:
        # first few non-heading lines before any recognised section
        summary_lines = [ln for ln in text.splitlines() if ln.strip()][:4]
    summary = " ".join(summary_lines)[:1000] if summary_lines else None

    return {
        "summary": summary,
        "skills": catalog.skills_as_dicts(matches),
        "education": _chunk_education(sections.get("education", [])),
        "experience": _chunk_experience(sections.get("experience", [])),
        "certifications": _chunk_certifications(sections.get("certifications", [])),
        "sections_found": sorted(sections.keys()),
        "char_count": len(text),
    }
