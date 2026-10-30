import pytest

from app.config import Settings


def test_production_rejects_missing_or_weak_admin_token():
    with pytest.raises(ValueError):
        Settings(app_env="production", admin_token="")
    with pytest.raises(ValueError):
        Settings(app_env="production", admin_token="change-me")


def test_production_accepts_explicit_strong_admin_token():
    settings = Settings(app_env="production", admin_token="a-secure-token-with-32-chars")
    assert settings.admin_token.startswith("a-secure")


def test_development_can_use_explicit_local_token():
    settings = Settings(app_env="development", admin_token="change-me")
    assert settings.admin_token == "change-me"
