"""Shared test fixtures.

Environment is configured BEFORE the app is imported so that pydantic
settings pick up the test values.
"""

from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("INTERNAL_API_KEY", "test-internal-key-1234567890")
os.environ.setdefault("SUPABASE_URL", "https://test-project.supabase.co")
os.environ.setdefault("LLM_PROVIDER", "none")
os.environ.setdefault("CORS_ORIGINS", '["http://localhost:3000"]')
os.environ.setdefault("LOG_LEVEL", "warning")

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture()
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def internal_key() -> str:
    return os.environ["INTERNAL_API_KEY"]
