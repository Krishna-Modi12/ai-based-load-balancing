from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator


class Settings(BaseSettings):
    database_url: str = "sqlite:///./load_balancer.db"
    admin_token: str = ""
    app_env: str = "production"
    proxy_timeout_seconds: float = 3.0
    telemetry_stale_seconds: int = 30
    worker_urls: str = ""
    model_dir: str = "../ml/artifacts"
    cors_origins: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @model_validator(mode="after")
    def validate_admin_token(self):
        weak_tokens = {"", "change-me", "local-dev-only", "replace-with-a-long-local-secret"}
        if self.app_env not in {"development", "test"} and self.admin_token in weak_tokens:
            raise ValueError("ADMIN_TOKEN must be explicitly configured with a strong value outside development/test.")
        if self.admin_token in weak_tokens and self.app_env in {"development", "test"}:
            return self
        if len(self.admin_token) < 16:
            raise ValueError("ADMIN_TOKEN must contain at least 16 characters.")
        return self

    @property
    def worker_configurations(self) -> list[tuple[str, str, float]]:
        """Parse name=url=capacity entries, keeping URLs operator configured."""
        result: list[tuple[str, str, float]] = []
        for value in filter(None, (p.strip() for p in self.worker_urls.split(","))):
            name, url, capacity = value.split("=")
            result.append((name, url.rstrip("/"), float(capacity)))
        return result

    @property
    def artifact_dir(self) -> Path:
        return Path(self.model_dir).resolve()


@lru_cache
def get_settings() -> Settings:
    return Settings()
