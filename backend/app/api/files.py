import os
import logging
import traceback
from fastapi import APIRouter, Query, HTTPException, status
from fastapi.responses import PlainTextResponse

logger = logging.getLogger("app.api.files")
router = APIRouter()

@router.get("/file", response_class=PlainTextResponse)
def get_file_content(
    path: str = Query(..., description="Absolute or relative path to the file on disk")
):
    """
    GET endpoint to read a file's content from disk and return it as plain text.
    """
    try:
        # Standardize path
        normalized_path = os.path.abspath(path)
        
        if not os.path.exists(normalized_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File not found: {path}"
            )
            
        if not os.path.isfile(normalized_path):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Path is not a file: {path}"
            )
            
        # Read the file content
        with open(normalized_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
            
        return content

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error in get_file_content for path {path}: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read file: {str(e)}"
        )
