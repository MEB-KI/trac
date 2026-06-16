import os

os.environ.setdefault("TUD_DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("TUD_ALLOWED_ORIGINS", '["http://localhost:3000"]')
os.environ.setdefault("TUD_API_ADMIN_USERNAME", "admin")
os.environ.setdefault("TUD_API_ADMIN_PASSWORD", "admin")

import pytest

from o_timeusediary_backend import api
from o_timeusediary_backend.settings import TUDBackendSettings


@pytest.mark.asyncio
async def test_lifespan_serve_mode_skips_create_db(monkeypatch):
    async with api.lifespan(api.app):
        pass


@pytest.mark.asyncio
async def test_lifespan_ignores_startup_mode_env_and_skips_create_db(monkeypatch):
    monkeypatch.setenv("TUD_STARTUP_MODE", "bootstrap")

    async with api.lifespan(api.app):
        pass


def test_settings_initializes_even_with_legacy_startup_mode_env(monkeypatch):
    monkeypatch.setenv("TUD_STARTUP_MODE", "bootstrap")

    settings = TUDBackendSettings()

    assert settings.studies_config_path
