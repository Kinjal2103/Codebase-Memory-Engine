from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services import rag_engine

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
        result = await rag_engine.answer_question(payload.question)
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Question processing failed: {str(e)}"
        )
