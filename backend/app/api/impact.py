from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services import rag_engine

router = APIRouter()

class ImpactRequest(BaseModel):
    function_name: str

@router.post("/impact")
async def impact_endpoint(payload: ImpactRequest):
    """
    POST endpoint to analyze change risk and impact radius for a function.
    """
    try:
        result = await rag_engine.analyze_impact(payload.function_name)
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Impact analysis failed: {str(e)}"
        )
