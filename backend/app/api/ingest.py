import logging
import traceback
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.ingestion import ingest_repository

logger = logging.getLogger("app.api.ingest")
router = APIRouter()

class IngestRequest(BaseModel):
    repo_path: str

@router.post("/ingest")
async def ingest_repository_endpoint(
    payload: IngestRequest, 
    db: AsyncSession = Depends(get_db)
):
    """
    POST endpoint to trigger ingestion pipeline on a repository path.
    """
    try:
        summary = await ingest_repository(payload.repo_path, db)
        return summary
    except Exception as e:
        err_msg = str(e)
        logger.error(f"Error in ingest_repository_endpoint: {e}\n{traceback.format_exc()}")
        
        # Check if database or Neo4j was unreachable
        if "neo4j" in err_msg.lower() or "driver" in err_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Neo4j database connection refused: {err_msg}"
            )
        elif "connection refused" in err_msg.lower() or "connection timed out" in err_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Database or backend services connection refused: {err_msg}"
            )
            
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ingestion failed: {err_msg}"
        )

