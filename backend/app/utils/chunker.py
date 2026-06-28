from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.code_node import DBFunction

async def chunk_functions(db: AsyncSession) -> list[dict]:
    """
    Queries all functions from PostgreSQL database, formats them into chunks
    suitable for embeddings, and returns a list of dictionaries containing
    the chunk text and metadata.
    """
    stmt = select(DBFunction).options(selectinload(DBFunction.file))
    result = await db.execute(stmt)
    functions = result.scalars().all()
    
    chunks = []
    for func in functions:
        # Skip functions whose source_code is None or under 10 characters
        if not func.source_code or len(func.source_code) < 10:
            continue
            
        file_path = func.file.path if func.file else "unknown"
        
        chunk_text = f"FILE: {file_path}\nFUNCTION: {func.name}\n\n{func.source_code}"
        
        chunks.append({
            "text": chunk_text,
            "meta": {
                "function_id": func.id,
                "name": func.name,
                "file": file_path,
                "line": func.start_line
            }
        })
        
    return chunks
