"""Optional AI dependency status (reported honestly by /health/ready)."""

from __future__ import annotations

import importlib
import importlib.util
from dataclasses import asdict, dataclass


@dataclass
class ModuleStatus:
    name: str
    installed: bool
    version: str | None = None
    detail: str | None = None


def _probe(name: str, module_name: str, version_attr: str = "__version__") -> ModuleStatus:
    try:
        if importlib.util.find_spec(module_name) is None:
            return ModuleStatus(name=name, installed=False, detail="not installed")
    except Exception as exc:
        return ModuleStatus(name=name, installed=False, detail=f"lookup error: {exc}")

    try:
        module = importlib.import_module(module_name)
    except Exception as exc:
        return ModuleStatus(name=name, installed=False, detail=f"import error: {exc}")

    version = getattr(module, version_attr, None)
    if version is None and module_name == "fitz":
        version = getattr(module, "VersionBind", None)
    return ModuleStatus(name=name, installed=True, version=str(version) if version else None)


def spacy_model_status(model: str = "en_core_web_sm") -> ModuleStatus:
    try:
        if importlib.util.find_spec(model) is None:
            return ModuleStatus(name=model, installed=False, detail="model not downloaded")
        return ModuleStatus(name=model, installed=True)
    except Exception as exc:
        return ModuleStatus(name=model, installed=False, detail=str(exc))


def collect_dependency_status() -> dict[str, dict]:
    modules = [
        _probe("PyMuPDF", "fitz"),
        _probe("spaCy", "spacy"),
        _probe("sentence-transformers", "sentence_transformers"),
        _probe("numpy", "numpy"),
        _probe("psycopg", "psycopg"),
        _probe("PyJWT", "jwt"),
        _probe("httpx", "httpx"),
    ]
    result = {m.name: asdict(m) for m in modules}
    result["spacy_model_en_core_web_sm"] = asdict(spacy_model_status())
    return result
