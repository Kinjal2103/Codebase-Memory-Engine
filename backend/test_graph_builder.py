import asyncio
import sys
import os

# Add the current directory to sys.path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app.database import async_session
from app.neo4j_db import neo4j_db
from app.services.graph_builder import build_graph

async def verify_nodes_and_edges():
    async with neo4j_db._driver.session() as session:
        # Count nodes
        res_nodes = await session.run("MATCH (n) RETURN labels(n)[0] as label, count(n) as count")
        print("\nNeo4j Nodes created:")
        async for r in res_nodes:
            print(f"- {r['label']}: {r['count']}")
            
        # Count relationships
        res_rels = await session.run("MATCH ()-[r]->() RETURN type(r) as type, count(r) as count")
        print("\nNeo4j Relationships created:")
        async for r in res_rels:
            print(f"- {r['type']}: {r['count']}")

async def main():
    print("Initializing databases...")
    neo4j_db.connect()
    
    print("\nRunning build_graph...")
    async with async_session() as db:
        await build_graph(db)
        
    print("\nVerifying Neo4j graph contents...")
    await verify_nodes_and_edges()
    
    await neo4j_db.close()
    print("\nSuccess! Graph builder verified and database populated.")

if __name__ == "__main__":
    asyncio.run(main())
