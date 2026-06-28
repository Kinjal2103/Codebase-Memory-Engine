import asyncio
import sys
import os

# Add the current directory to sys.path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app.database import async_session
from app.services.ingestion import ingest_repository
from app.services.vector_store import search, INDEX_PATH, META_PATH

async def main():
    repo_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    print(f"Triggering ingestion for repository: {repo_path}")
    
    async with async_session() as session:
        summary = await ingest_repository(repo_path, session)
        print("Ingestion summary:", summary)
        
    print("\nVerifying that index files exist on disk...")
    print(f"faiss.index exists: {os.path.exists(INDEX_PATH)}")
    print(f"faiss_meta.pkl exists: {os.path.exists(META_PATH)}")
    
    assert os.path.exists(INDEX_PATH), "FAISS index file is missing"
    assert os.path.exists(META_PATH), "FAISS metadata file is missing"
    
    print("\nRunning a test search query: 'where is error handling done'")
    results = search("where is error handling done")
    print(f"Found {len(results)} results:")
    for r in results:
        print(f"- File: {r['file']}, Function: {r['name']}, Score: {r['score']:.4f}")
        
    if len(results) >= 3:
        print("\nSuccess! Integration verified. Done condition met (at least 3 results returned).")
    else:
        print(f"\nWarning: Found {len(results)} results. Expected at least 3.")

if __name__ == "__main__":
    asyncio.run(main())
