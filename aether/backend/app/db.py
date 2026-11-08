from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from app.config import settings


class Base(DeclarativeBase):
    pass


engine: AsyncEngine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

active_db_backend: str = "postgresql+pgvector"


async def init_db() -> str:
    """
    Initializes PostgreSQL + pgvector extension and creates all 16 schema tables.
    If PostgreSQL is not running locally, automatically falls back to persistent SQLite
    (`aether_persistent_store.db`) so memories and knowledge graphs survive backend restarts.
    """
    global engine, AsyncSessionLocal, active_db_backend
    import app.models  # noqa: F401 — ensure all 16 ORM models are registered on Base.metadata

    try:
        async with engine.begin() as conn:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            await conn.run_sync(Base.metadata.create_all)
        active_db_backend = "postgresql+pgvector"
        return active_db_backend
    except Exception as pg_exc:
        sqlite_url = f"sqlite+aiosqlite:///{settings.sqlite_fallback_path}"
        print(
            f"[Aether DB] PostgreSQL unavailable ({pg_exc}). "
            f"Switching to persistent SQLite store at {settings.sqlite_fallback_path}"
        )
        engine = create_async_engine(sqlite_url, echo=False)
        AsyncSessionLocal = async_sessionmaker(
            bind=engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        active_db_backend = f"sqlite+aiosqlite ({settings.sqlite_fallback_path})"
        return active_db_backend


async def get_db_session():
    async with AsyncSessionLocal() as session:
        yield session
