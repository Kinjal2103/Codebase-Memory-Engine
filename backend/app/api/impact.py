import logging
import traceback
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.code_node import DBFunction
from app.services import rag_engine

logger = logging.getLogger("app.api.impact")
router = APIRouter()

class ImpactRequest(BaseModel):
    function_name: str

@router.post("/impact")
async def impact_endpoint(
    payload: ImpactRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    POST endpoint to analyze change risk and impact radius for a function.
    """
    try:
        # 1. Verify function existence in Postgres
        stmt = select(DBFunction).where(DBFunction.name == payload.function_name)
        result = await db.execute(stmt)
        db_func = result.scalars().first()
        
        if not db_func:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Function '{payload.function_name}' not found in database."
            )

        # 2. Call impact analysis
        try:
            res = await rag_engine.analyze_impact(payload.function_name)
        except Exception as e:
            err_msg = str(e)
            if "neo4j" in err_msg.lower() or "driver" in err_msg.lower():
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Neo4j connection refused: {err_msg}"
                )
            raise e

        # 3. Check for LLM errors
        risk_analysis = res.get("risk_analysis", "")
        if "Error calling" in risk_analysis or "Error:" in risk_analysis or not risk_analysis:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="LLM unavailable — start Ollama"
            )

        return res

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error in impact_endpoint: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

