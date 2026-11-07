import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "aether-adk-backend"
    google_api_key: str = os.getenv("GOOGLE_API_KEY", os.getenv("GEMINI_API_KEY", ""))
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", os.getenv("GOOGLE_API_KEY", ""))

    # Configurable Gemini Live & Reasoning Models with documented fallbacks
    gemini_live_model: str = os.getenv(
        "GEMINI_LIVE_MODEL", "gemini-2.5-flash-native-audio-preview-12-2025"
    )
    gemini_reasoning_model: str = os.getenv(
        "GEMINI_REASONING_MODEL", "gemini-2.5-flash"
    )

    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://aether:aether_secret_pass@localhost:5432/aether_companion",
    )
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    aether_api_token: str = os.getenv("AETHER_API_TOKEN", "aether-dev-local-token-2026")
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

# Ensure GOOGLE_API_KEY is exported in os.environ for google-adk Runner
if settings.gemini_api_key and not os.environ.get("GOOGLE_API_KEY"):
    os.environ["GOOGLE_API_KEY"] = settings.gemini_api_key
