import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "aether-adk-backend"
    google_api_key: str = os.getenv("GOOGLE_API_KEY", os.getenv("GEMINI_API_KEY", ""))
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", os.getenv("GOOGLE_API_KEY", ""))

    # Configurable Gemini Live, Extended Thinking, Reasoning & ADK 3D Ghost Choreography Models
    gemini_live_model: str = os.getenv("GEMINI_LIVE_MODEL", "gemini-3.8-live-extended-thinking")
    gemini_live_fallback_model: str = os.getenv(
        "GEMINI_LIVE_FALLBACK_MODEL", "gemini-3.1-flash-live-preview"
    )
    gemini_live_thinking_level: str = os.getenv("GEMINI_LIVE_THINKING_LEVEL", "AUTO")
    gemini_reasoning_model: str = os.getenv("GEMINI_REASONING_MODEL", "gemini-3.5-flash-lite")
    gemini_reasoning_fallback_model: str = os.getenv(
        "GEMINI_REASONING_FALLBACK_MODEL", "gemini-3.7-flash"
    )
    gemini_ghost_model: str = os.getenv("GEMINI_GHOST_MODEL", "gemma-4-31b-it")
    gemini_ghost_fallback_model: str = os.getenv(
        "GEMINI_GHOST_FALLBACK_MODEL", "gemini-3.5-flash-lite"
    )
    gemini_embedding_model: str = os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")

    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://aether:aether_secret_pass@localhost:5432/aether_companion",
    )
    sqlite_fallback_path: str = os.getenv(
        "SQLITE_FALLBACK_PATH",
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "aether_persistent_store.db"),
    )
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    aether_api_token: str = os.getenv("AETHER_API_TOKEN", "aether-dev-local-token-2026")
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))

    model_config = SettingsConfigDict(
        env_file=(
            os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
            ".env",
        ),
        extra="ignore",
    )


settings = Settings()

# Ensure GOOGLE_API_KEY is exported in os.environ for google-adk Runner (without duplicate GEMINI_API_KEY warning)
if settings.google_api_key:
    os.environ["GOOGLE_API_KEY"] = settings.google_api_key
elif settings.gemini_api_key:
    os.environ["GOOGLE_API_KEY"] = settings.gemini_api_key
