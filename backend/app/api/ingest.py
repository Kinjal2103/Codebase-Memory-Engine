from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.ingestion import ingest_repository

router = APIRouter()

class IngestRequest(BaseModel):
    repo_path: str

@router.post("/ingest")
async def ingest_repository_endpoint(payload: IngestRequest, db: AsyncSession = Depends(get_db)):
    """
    POST endpoint to trigger ingestion pipeline on a repository path.
    """
    try:
        summary = await ingest_repository(payload.repo_path, db)
        return summary
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Ingestion failed: {str(e)}"
        )
