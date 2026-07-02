import os
import logging
import traceback
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from app.services import rag_engine
from app.services.vector_store import INDEX_PATH, META_PATH
from app.config import settings

logger = logging.getLogger("app.api.ask")
router = APIRouter()

class AskRequest(BaseModel):
    question: str

@router.post("/ask")
async def ask_endpoint(payload: AskRequest):
    """
    POST endpoint to ask questions about the codebase using semantic search,
    knowledge graphs, git history, and LLM synthesis.
    """
    try:
        # 1. Check if FAISS index is built
        if not os.path.exists(INDEX_PATH) or not os.path.exists(META_PATH):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Run /api/ingest first"
            )

        # 2. Call RAG engine
        try:
            result = await rag_engine.answer_question(payload.question)
        except Exception as e:
            err_msg = str(e)
            # Detect Neo4j connection failure
            if "neo4j" in err_msg.lower() or "driver" in err_msg.lower() or "session" in err_msg.lower():
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Neo4j connection refused: {err_msg}"
                )
            raise e

        # 3. Check for LLM errors in response
        answer = result.get("answer", "")
        if "Error calling" in answer or "Error:" in answer or not answer:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="LLM unavailable — start Ollama"
            )

        return result

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error in ask_endpoint: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

