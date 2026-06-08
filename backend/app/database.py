from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

# Create database engine using the configured DATABASE_URL
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=True,  # Log SQL queries for transparency
)

# Configure the session factory to create AsyncSession objects
async_session = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Base class for SQLAlchemy declarative models
class Base(DeclarativeBase):
    pass

# Dependency to provide database session to endpoints
async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
