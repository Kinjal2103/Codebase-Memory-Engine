import logging
import os
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.neo4j_db import neo4j_db
from app.config import settings
from app.services.vector_store import INDEX_PATH, META_PATH

logger = logging.getLogger("app.api.health")
router = APIRouter()

@router.get("/health")
async def get_health_status(db: AsyncSession = Depends(get_db)):
    """
    GET /api/health
    Performs live checks on Postgres, Neo4j, FAISS index files, and the LLM service.
    Always returns HTTP 200 so the frontend can read the individual subsystem statuses.
    """
    # 1. Check PostgreSQL
    postgres_status = "ok"
    try:
        await db.execute(select(1))
    except Exception as e:
        logger.error(f"Health Check: Postgres error: {e}")
        postgres_status = "error"

    # 2. Check Neo4j
    neo4j_status = "ok"
    try:
        await neo4j_db.verify_connection()
    except Exception as e:
        logger.error(f"Health Check: Neo4j error: {e}")
        neo4j_status = "error"

    # 3. Check FAISS Index files
    faiss_status = "loaded" if os.path.exists(INDEX_PATH) and os.path.exists(META_PATH) else "not built"

    # 4. Check LLM Service (Ollama / Gemini)
    llm_status = "ok"
    provider = settings.LLM_PROVIDER.lower() if settings.LLM_PROVIDER else "ollama"
    
    if provider == "gemini":
        if not settings.GEMINI_API_KEY:
            logger.error("Health Check: Gemini API key is missing.")
            llm_status = "error"
    else:
        # Default Ollama
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get("http://localhost:11434", timeout=3.0)
                if resp.status_code == 200:
                    llm_status = "ok"
                else:
                    logger.error(f"Health Check: Ollama returned status {resp.status_code}")
                    llm_status = "error"
        except Exception as e:
            logger.error(f"Health Check: Ollama unreachable: {e}")
            llm_status = "error"

    # 5. Determine Overall Status
    is_degraded = (
        postgres_status == "error" or
        neo4j_status == "error" or
        llm_status == "error" or
        faiss_status == "not built"
    )
    status_str = "degraded" if is_degraded else "ok"

    return {
        "status": status_str,
        "postgres": postgres_status,
        "neo4j": neo4j_status,
        "faiss_index": faiss_status,
        "llm": llm_status,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
