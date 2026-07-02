import os
import logging
import traceback
from fastapi import APIRouter, Query, HTTPException, status
from app.services import vector_store
from app.services.vector_store import INDEX_PATH, META_PATH

logger = logging.getLogger("app.api.search")
router = APIRouter()

@router.get("/search")
def search_endpoint(
    q: str = Query(..., description="The search query text"),
    top_k: int = Query(8, description="Number of top results to return")
):
    """
    GET endpoint to perform code similarity search on indexed functions.
    """
    try:
        # 1. Check if FAISS index is built
        if not os.path.exists(INDEX_PATH) or not os.path.exists(META_PATH):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Run /api/ingest first"
            )

        # 2. Perform search
        results = vector_store.search(q, top_k=top_k)
        
        # Map the stored metadata keys to the requested API response keys
        mapped_results = []
        for r in results:
            mapped_results.append({
                "function_name": r.get("name"),
                "file": r.get("file"),
                "start_line": r.get("line"),
                "score": r.get("score")
            })
            
        return {"results": mapped_results}

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error in search_endpoint: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

