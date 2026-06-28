from fastapi import APIRouter, Query
from app.services import vector_store

router = APIRouter()

@router.get("/search")
def search_endpoint(
    q: str = Query(..., description="The search query text"),
    top_k: int = Query(8, description="Number of top results to return")
):
    """
    GET endpoint to perform code similarity search on indexed functions.
    """
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
