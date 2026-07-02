import logging
import traceback
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.code_node import DBFile, DBFunction
from app.services.graph_queries import get_callers, get_callees
from app.services.llm import ask_llm

logger = logging.getLogger("app.api.docs_gen")
router = APIRouter()

class FunctionDocsRequest(BaseModel):
    function_name: str

class FileDocsRequest(BaseModel):
    file_path: str

@router.post("/docs/function")
async def generate_function_docs(
    payload: FunctionDocsRequest, 
    db: AsyncSession = Depends(get_db)
):
    """
    POST /api/docs/function
    Generates complete documentation (as a docstring) for a target function 
    using Postgres source code, Neo4j relationship callers/callees, and LLM synthesis.
    """
    try:
        # 1. Fetch function and its parent file from Postgres
        stmt = (
            select(DBFunction)
            .where(DBFunction.name == payload.function_name)
            .options(selectinload(DBFunction.file))
        )
        result = await db.execute(stmt)
        db_func = result.scalars().first()
        
        if not db_func:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Function '{payload.function_name}' not found in Postgres."
            )
        
        # 2. Fetch callers & callees from Neo4j (depth=1)
        try:
            callers = await get_callers(payload.function_name, depth=1)
            callees = await get_callees(payload.function_name, depth=1)
        except Exception as neo_err:
            logger.error(f"Neo4j connection error: {neo_err}\n{traceback.format_exc()}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Neo4j connection refused: {str(neo_err)}"
            )

        # 3. Construct prompt and send to LLM
        prompt = (
            f"Generate complete documentation for this function.\n"
            f"Include: purpose, parameters, return value, side effects,\n"
            f"which functions call it, which functions it depends on.\n"
            f"Format as a docstring.\n\n"
            f"Function Name: {db_func.name}\n"
            f"File Path: {db_func.file.path if db_func.file else 'unknown'}\n"
            f"Functions that call this (callers): {', '.join(callers) if callers else 'None'}\n"
            f"Functions this calls (dependencies): {', '.join(callees) if callees else 'None'}\n\n"
            f"Source Code:\n"
            f"```python\n{db_func.source_code}\n```"
        )
        
        generated_doc = await ask_llm(prompt)
        
        # Check LLM communication errors
        if "Error calling" in generated_doc or "Error:" in generated_doc or not generated_doc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"LLM unavailable — start Ollama. Detail: {generated_doc}"
            )
            
        return {
            "function_name": db_func.name,
            "file": db_func.file.path if db_func.file else "unknown",
            "generated_doc": generated_doc
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Unexpected error in generate_function_docs: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/docs/file")
async def generate_file_docs(
    payload: FileDocsRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    POST /api/docs/file
    Generates a module-level README summary for the target file.
    """
    try:
        # 1. Fetch file and all its functions from Postgres
        stmt = (
            select(DBFile)
            .where(DBFile.path == payload.file_path)
            .options(selectinload(DBFile.functions))
        )
        result = await db.execute(stmt)
        db_file = result.scalars().first()
        
        if not db_file:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File '{payload.file_path}' not found in Postgres."
            )
            
        functions = db_file.functions
        
        # 2. Construct prompt and send to LLM
        functions_list = "\n".join([f"- {fn.name}" for fn in functions]) if functions else "None"
        prompt = (
            f"Write a module-level README summary for this file.\n"
            f"List its main responsibilities, key functions, and how it\n"
            f"fits into the overall codebase.\n\n"
            f"File Path: {payload.file_path}\n"
            f"Functions defined in this file:\n{functions_list}"
        )
        
        generated_doc = await ask_llm(prompt)
        
        # Check LLM communication errors
        if "Error calling" in generated_doc or "Error:" in generated_doc or not generated_doc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"LLM unavailable — start Ollama. Detail: {generated_doc}"
            )
            
        return {
            "file_path": db_file.path,
            "generated_doc": generated_doc
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Unexpected error in generate_file_docs: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
