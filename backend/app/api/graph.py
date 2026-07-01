from fastapi import APIRouter, HTTPException
from app.services import graph_queries

router = APIRouter()

@router.get("/graph/{function_name}")
async def graph_endpoint(function_name: str):
    """
    GET endpoint to retrieve a JSON-safe subgraph for a target function.
    """
    try:
        subgraph = await graph_queries.get_subgraph(function_name, depth=2)
        return subgraph
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Subgraph retrieval failed: {str(e)}"
        )
