from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from contextlib import asynccontextmanager

from app.config import settings
from app.database import engine, Base, get_db
from app.models import DBFile
from app.neo4j_db import neo4j_db
from app.api.ingest import router as ingest_router
from app.api.search import router as search_router
from app.api.ask import router as ask_router
from app.api.impact import router as impact_router
from app.api.graph import router as graph_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    print("=== STARTING UP APPLICATION ===")
    print("Initializing databases...")
    
    # Create PostgreSQL tables (in development)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("PostgreSQL tables checked/created.")
    
    # Initialize Neo4j driver connection
    neo4j_db.connect()
    print("Neo4j driver initialized.")
    
    # Verify Neo4j connection
    try:
        status = await neo4j_db.verify_connection()
        print("Neo4j connection verified:", status["message"])
    except Exception as e:
        print("CRITICAL WARNING: Neo4j connection verification failed on startup:", e)
        
    yield
    
    # Shutdown actions
    print("=== SHUTTING DOWN APPLICATION ===")
    print("Closing database connections...")
    await neo4j_db.close()
    await engine.dispose()
    print("Databases disposed successfully.")

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

# Include API routers
app.include_router(ingest_router, prefix="/api")
app.include_router(search_router, prefix="/api")
app.include_router(ask_router, prefix="/api")
app.include_router(impact_router, prefix="/api")
app.include_router(graph_router, prefix="/api")

@app.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """
    Health check endpoint verifying DB connections.
    """
    postgres_status = "healthy"
    try:
        await db.execute(select(1))
    except Exception as e:
        postgres_status = f"unhealthy: {str(e)}"

    neo4j_status = "healthy"
    try:
        await neo4j_db.verify_connection()
    except Exception as e:
        neo4j_status = f"unhealthy: {str(e)}"

    return {
        "status": "ok" if postgres_status == "healthy" and neo4j_status == "healthy" else "degraded",
        "postgres": postgres_status,
        "neo4j": neo4j_status
    }

from datetime import datetime, timezone

@app.post("/test-file")
async def test_file_endpoint(path: str, language: str, db: AsyncSession = Depends(get_db)):
    """
    Test endpoint to insert a file into PostgreSQL and return the written record.
    """
    try:
        # Check if file already exists
        stmt = select(DBFile).where(DBFile.path == path)
        result = await db.execute(stmt)
        existing = result.scalars().first()
        if existing:
            return {"message": "File already exists in PostgreSQL", "data": {
                "id": existing.id,
                "path": existing.path,
                "language": existing.language,
                "last_modified": existing.last_modified
            }}
            
        db_file = DBFile(path=path, language=language, last_modified=datetime.now(timezone.utc))
        db.add(db_file)
        await db.commit()
        await db.refresh(db_file)
        
        return {"message": "File created successfully in PostgreSQL", "data": {
            "id": db_file.id,
            "path": db_file.path,
            "language": db_file.language,
            "last_modified": db_file.last_modified
        }}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/test-neo4j")
async def test_neo4j_endpoint():
    """
    Test endpoint to run Neo4j verification write-read-delete cycle.
    """
    try:
        result = await neo4j_db.verify_connection()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Neo4j connection error: {str(e)}")
