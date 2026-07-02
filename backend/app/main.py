import logging
import traceback
import time
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text, func

from app.config import settings
from app.database import engine, Base, get_db
from app.models import DBFile, DBFunction
from app.neo4j_db import neo4j_db

# Import API routers
from app.api.ingest import router as ingest_router
from app.api.search import router as search_router
from app.api.ask import router as ask_router
from app.api.impact import router as impact_router
from app.api.graph import router as graph_router
from app.api.docs_gen import router as docs_gen_router
from app.api.history import router as history_router
from app.api.quality import router as quality_router
from app.api.health import router as health_router
from app.api.files import router as files_router

# Configure Logger to exact requested format:
# [2024-01-15 10:23:45] METHOD /path → status_code in Xms
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    force=True
)
logger = logging.getLogger("app.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    logger.info("=== STARTING UP APPLICATION ===")
    logger.info("Initializing databases...")
    
    # Create PostgreSQL tables (in development) and ensure columns exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Dynamically alter files table to add repo_path and ingested_at if they do not exist
        await conn.execute(text("ALTER TABLE files ADD COLUMN IF NOT EXISTS repo_path VARCHAR(1024);"))
        await conn.execute(text("ALTER TABLE files ADD COLUMN IF NOT EXISTS ingested_at TIMESTAMP WITH TIME ZONE;"))
        logger.info("PostgreSQL tables checked/created and schema updated.")
    
    # Initialize Neo4j driver connection
    neo4j_db.connect()
    logger.info("Neo4j driver initialized.")
    
    # Verify Neo4j connection
    try:
        status_res = await neo4j_db.verify_connection()
        logger.info(f"Neo4j connection verified: {status_res['message']}")
    except Exception as e:
        logger.error(f"CRITICAL WARNING: Neo4j connection verification failed on startup: {e}")
        
    yield
    
    # Shutdown actions
    logger.info("=== SHUTTING DOWN APPLICATION ===")
    logger.info("Closing database connections...")
    await neo4j_db.close()
    await engine.dispose()
    logger.info("Databases disposed successfully.")

app = FastAPI(
    title="Codebase Memory Engine API",
    description="FastAPI backend for indexing and searching codebase graphs and files",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for React Frontend (running on http://localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware: Request / Response Logging
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.perf_counter()
    response = await call_next(request)
    duration = (time.perf_counter() - start_time) * 1000.0  # duration in ms
    logger.info(f"{request.method} {request.url.path} → {response.status_code} in {int(duration)}ms")
    return response

# Global Exception Handlers to avoid returning raw HTML/tracebacks
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global Exception caught: {exc}\n{traceback.format_exc()}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "An unexpected server error occurred",
            "detail": str(exc)
        }
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    # Simply format clean HTTP exception logs and JSON response
    logger.error(f"HTTPException status {exc.status_code}: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "detail": exc.detail
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Validation error on payload: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "Validation error (bad request input format)",
            "detail": str(exc.errors())
        }
    )

# Include API routers
app.include_router(ingest_router, prefix="/api")
app.include_router(search_router, prefix="/api")
app.include_router(ask_router, prefix="/api")
app.include_router(impact_router, prefix="/api")
app.include_router(graph_router, prefix="/api")
app.include_router(docs_gen_router, prefix="/api")
app.include_router(history_router, prefix="/api")
app.include_router(quality_router, prefix="/api")
app.include_router(health_router, prefix="/api")
app.include_router(files_router, prefix="/api")

@app.get("/api/repos")
async def list_repos(db: AsyncSession = Depends(get_db)):
    """
    GET /api/repos
    Lists all ingested repositories with their stats: file count, function count, last ingested.
    """
    try:
        # PostgreSQL Query:
        # Group by repo_path, count distinct file IDs, count total function IDs, max ingested timestamp
        stmt = (
            select(
                DBFile.repo_path,
                func.count(DBFile.id.distinct()).label("file_count"),
                func.count(DBFunction.id).label("function_count"),
                func.max(DBFile.ingested_at).label("last_ingested")
            )
            .outerjoin(DBFunction, DBFile.id == DBFunction.file_id)
            .group_by(DBFile.repo_path)
        )
        
        result = await db.execute(stmt)
        rows = result.all()
        
        repos = []
        for row in rows:
            # Skip empty/unpopulated repo_paths
            if not row.repo_path:
                continue
            
            repos.append({
                "repo_path": row.repo_path,
                "file_count": row.file_count,
                "function_count": row.function_count,
                "last_ingested": row.last_ingested.isoformat() if row.last_ingested else None
            })
            
        return repos
        
    except Exception as e:
        logger.error(f"Error in list_repos: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list repositories: {str(e)}"
        )
