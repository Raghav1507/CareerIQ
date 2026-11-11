"""Unit tests for alias normalisation and catalogue matching (no DB required)."""

from __future__ import annotations

import re

from app.services.catalog import _alias_to_pattern, normalize_skill_name


def test_normalize_matches_web_rule() -> None:
    assert normalize_skill_name("React.js") == "reactjs"
    assert normalize_skill_name("React JS") == "reactjs"
    assert normalize_skill_name("ReactJS") == "reactjs"
    assert normalize_skill_name("  Node.JS ") == "nodejs"
    assert normalize_skill_name("C++") == "c++"
    assert normalize_skill_name("C#") == "c#"
    assert normalize_skill_name("C++") != normalize_skill_name("C#")


def _matches(pattern_norm: str, text: str) -> bool:
    return re.search(_alias_to_pattern(pattern_norm), text, re.IGNORECASE) is not None


def test_pattern_matches_common_spellings() -> None:
    assert _matches("reactjs", "Experienced React.js developer")
    assert _matches("reactjs", "worked with React JS and Redux")
    assert _matches("reactjs", "REACTJS")
    assert _matches("nodejs", "Node.js, Express and NestJS")
    assert _matches("postgresql", "PostgresQL 15")


def test_pattern_respects_word_boundaries() -> None:
    assert not _matches("go", "algorithms and data structures")
    assert _matches("go", "Built services in Go")
    assert not _matches("r", "better")  # min length guard lives in loader, but pattern is bounded


def test_pattern_keeps_punctuation_languages() -> None:
    assert _matches("c++", "Modern C++ (C++17)")
    assert _matches("c#", "ASP.NET with C#")
    assert not _matches("c++", "see plus plus")  # no literal ++ present
