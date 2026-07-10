import logging
import traceback
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update

from app.database import get_db
from app.services.ingestion import ingest_repository
from app.services.repo_resolver import RepoResolver
from app.models import DBFile

logger = logging.getLogger("app.api.ingest")
router = APIRouter()

class IngestLocalRequest(BaseModel):
    repo_path: str

class IngestGithubRequest(BaseModel):
    github_url: str

@router.post("/ingest/local")
async def ingest_local(
    payload: IngestLocalRequest,
    db: AsyncSession = Depends(get_db)
):
    print("[ingest] Resolving local repository path...")
    try:
        resolved_path = RepoResolver.from_local_path(payload.repo_path)
        print(f"[ingest] Local path verified: {resolved_path}")
        
        print("[ingest] Ingesting repository files...")
        summary = await ingest_repository(resolved_path, db)
        
        print("[ingest] Ingestion completed successfully.")
        return {
            "method": "local",
            "path": payload.repo_path,
            "files": summary["files"],
            "functions": summary["functions"],
            "classes": summary["classes"],
            "commits": summary["commits"]
        }
    except ValueError as e:
        logger.error(f"ValueError in ingest_local: {e}")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": str(e)}
        )
    except Exception as e:
        logger.error(f"Error in ingest_local: {e}\n{traceback.format_exc()}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "Ingestion failed", "detail": str(e)}
        )

@router.post("/ingest/github")
async def ingest_github(
    payload: IngestGithubRequest,
    db: AsyncSession = Depends(get_db)
):
    print(f"[ingest] Resolving GitHub repository URL: {payload.github_url}...")
    try:
        tmpdir, cleanup = RepoResolver.from_github_url(payload.github_url)
    except ValueError as e:
        logger.error(f"ValueError in github url validation/clone: {e}")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": str(e)}
        )
    except TimeoutError as e:
        logger.error(f"TimeoutError cloning github url: {e}")
        return JSONResponse(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            content={"error": "Clone timed out. Repo may be too large."}
        )
    except Exception as e:
        logger.error(f"Error resolving github repo: {e}\n{traceback.format_exc()}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "Ingestion failed", "detail": str(e)}
        )
        
    try:
        # Extract repo_name
        cleaned_url = payload.github_url.strip()
        if cleaned_url.endswith(".git"):
            cleaned_url = cleaned_url[:-4]
        parts = [p for p in cleaned_url[len("https://github.com/"):].split("/") if p]
        repo_name = parts[1] if len(parts) >= 2 else "repo"
        
        print("[ingest] Ingesting repository files...")
        summary = await ingest_repository(tmpdir, db)
        
        print("[ingest] Storing repository identifier...")
        tmpdir_std = tmpdir.replace("\\", "/")
        await db.execute(
            update(DBFile)
            .where(DBFile.repo_path == tmpdir_std)
            .values(repo_path=payload.github_url)
        )
        await db.commit()
        
        print("[ingest] Ingestion completed successfully.")
        return {
            "method": "github",
            "url": payload.github_url,
            "repo_name": repo_name,
            "files": summary["files"],
            "functions": summary["functions"],
            "classes": summary["classes"],
            "commits": summary["commits"]
        }
    except ValueError as e:
        logger.error(f"ValueError during ingestion/mapping: {e}")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": str(e)}
        )
    except Exception as e:
        logger.error(f"Error in ingest_github: {e}\n{traceback.format_exc()}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "Ingestion failed", "detail": str(e)}
        )
    finally:
        print("[ingest] Cleaning up temporary files...")
        cleanup()

@router.post("/api/ingest/upload")
@router.post("/ingest/upload")
async def ingest_upload(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    print(f"[ingest] Checking uploaded file: {file.filename}...")
    if not file.filename.lower().endswith(".zip"):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": "Only ZIP files are supported"}
        )
        
    try:
        # Check size (max 500MB)
        contents = await file.read()
        max_size = 500 * 1024 * 1024
        if len(contents) > max_size:
            return JSONResponse(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                content={"error": "File too large (max 500MB)"}
            )
            
        print("[ingest] Extracting repository archive...")
        tmpdir, cleanup = RepoResolver.from_zip_upload(contents)
    except ValueError as e:
        logger.error(f"ValueError in zip validation/extraction: {e}")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": str(e)}
        )
    except Exception as e:
        logger.error(f"Error extracting zip: {e}\n{traceback.format_exc()}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "Ingestion failed", "detail": str(e)}
        )
        
    try:
        print("[ingest] Ingesting repository files...")
        summary = await ingest_repository(tmpdir, db)
        
        print("[ingest] Storing repository identifier...")
        tmpdir_std = tmpdir.replace("\\", "/")
        await db.execute(
            update(DBFile)
            .where(DBFile.repo_path == tmpdir_std)
            .values(repo_path=file.filename)
        )
        await db.commit()
        
        print("[ingest] Ingestion completed successfully.")
        return {
            "method": "upload",
            "filename": file.filename,
            "files": summary["files"],
            "functions": summary["functions"],
            "classes": summary["classes"],
            "commits": summary["commits"]
        }
    except ValueError as e:
        logger.error(f"ValueError during ingestion/mapping: {e}")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": str(e)}
        )
    except Exception as e:
        logger.error(f"Error in ingest_upload: {e}\n{traceback.format_exc()}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "Ingestion failed", "detail": str(e)}
        )
    finally:
        print("[ingest] Cleaning up temporary files...")
        cleanup()
