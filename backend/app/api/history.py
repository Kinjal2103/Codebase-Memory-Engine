import logging
import traceback
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.code_node import DBFile, DBCommit
from app.services.llm import ask_llm

logger = logging.getLogger("app.api.history")
router = APIRouter()

@router.get("/history")
async def get_file_history(
    file: str = Query(..., description="The relative file path to get history for"),
    limit: int = Query(10, description="Max number of commits to retrieve"),
    db: AsyncSession = Depends(get_db)
):
    """
    GET /api/history
    Fetches git commit history for a file and summarizes why it has changed over time.
    """
    try:
        # Standardize file path separators to forward slashes for database consistency
        file_path_std = file.replace("\\", "/")

        # 1. Verify if file exists in Postgres
        file_stmt = select(DBFile).where(DBFile.path == file_path_std)
        file_result = await db.execute(file_stmt)
        db_file = file_result.scalars().first()
        
        if not db_file:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File '{file}' not found in database. Make sure it is ingested."
            )
            
        # 2. Fetch the commits touching this file, ordered by date descending
        commits_stmt = (
            select(DBCommit)
            .join(DBCommit.files)
            .where(DBFile.path == file_path_std)
            .order_by(DBCommit.date.desc())
            .limit(limit)
        )
        commits_result = await db.execute(commits_stmt)
        commits = commits_result.scalars().all()
        
        if not commits:
            return {
                "file": file_path_std,
                "commits": [],
                "evolution_summary": "No git commit history was found in the database for this file."
            }
            
        # 3. Build LLM prompt with commit details
        commit_list_str = "\n".join([
            f"- Hash: {c.hash[:7]}, Author: {c.author}, Date: {c.date.strftime('%Y-%m-%d')}, Message: {c.message}"
            for c in commits
        ])
        
        prompt = (
            f"Based on these commit messages, summarize in 2-3 sentences\n"
            f"why this file has changed over time and what problems it has solved.\n\n"
            f"File Path: {file_path_std}\n"
            f"Commit History:\n{commit_list_str}"
        )
        
        # 4. Request summary from LLM
        summary = await ask_llm(prompt)
        
        # Check for LLM errors
        if "Error calling" in summary or "Error:" in summary or not summary:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"LLM unavailable — start Ollama. Detail: {summary}"
            )
            
        # 5. Format return structure
        formatted_commits = [
            {
                "hash": c.hash[:7],
                "author": c.author,
                "date": c.date.isoformat(),
                "message": c.message
            }
            for c in commits
        ]
        
        return {
            "file": file_path_std,
            "commits": formatted_commits,
            "evolution_summary": summary.strip()
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Unexpected error in get_file_history: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
