import asyncio
import sys
import os

# Add the current directory to sys.path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app.neo4j_db import neo4j_db
from app.services.graph_queries import get_callers, get_callees, get_neighbors, get_subgraph, get_file_imports

async def main():
    print("Connecting to Neo4j...")
    neo4j_db.connect()
    
    # Test function queries
    fn_name = "ingest_repository"
    print(f"\n--- Testing Function Queries for: '{fn_name}' ---")
    
    callers = await get_callers(fn_name)
    print("Callers:", callers)
    
    callees = await get_callees(fn_name)
    print("Callees:", callees)
    
    neighbors = await get_neighbors(fn_name)
    print("Neighbors (depth=1):", neighbors)
    
    subgraph = await get_subgraph(fn_name)
    print("Subgraph structure:")
    print(f"- Nodes count: {len(subgraph['nodes'])}")
    print(f"- Edges count: {len(subgraph['edges'])}")
    if subgraph['nodes']:
        print("Example Node:", subgraph['nodes'][0])
    if subgraph['edges']:
        print("Example Edge:", subgraph['edges'][0])
        
    # Test file import queries
    file_path = "backend/app/services/ingestion.py"
    print(f"\n--- Testing File Imports for: '{file_path}' ---")
    imports = await get_file_imports(file_path)
    print("Imports:", imports)
    
    await neo4j_db.close()
    print("\nSuccess! Graph queries verified.")

if __name__ == "__main__":
    asyncio.run(main())
