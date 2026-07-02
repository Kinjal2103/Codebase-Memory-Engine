import logging
import traceback
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.code_node import DBFunction
from app.services import graph_queries

logger = logging.getLogger("app.api.graph")
router = APIRouter()

@router.get("/graph/{function_name}")
async def graph_endpoint(
    function_name: str,
    db: AsyncSession = Depends(get_db)
):
    """
    GET endpoint to retrieve a JSON-safe subgraph for a target function.
    """
    try:
        # 1. Verify function existence in Postgres
        stmt = select(DBFunction).where(DBFunction.name == function_name)
        result = await db.execute(stmt)
        db_func = result.scalars().first()
        
        if not db_func:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Function '{function_name}' not found in database."
            )

        # 2. Retrieve subgraph from Neo4j
        try:
            subgraph = await graph_queries.get_subgraph(function_name, depth=2)
            return subgraph
        except Exception as neo_err:
            err_msg = str(neo_err)
            if "neo4j" in err_msg.lower() or "driver" in err_msg.lower():
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Neo4j connection refused: {err_msg}"
                )
            raise neo_err

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error in graph_endpoint: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

