import asyncio
from app.neo4j_db import neo4j_db

async def main():
    neo4j_db.connect()
    async with neo4j_db._driver.session() as s:
        print("--- File paths present in Neo4j ---")
        res = await s.run("MATCH (f:File) RETURN f.path as path LIMIT 10")
        async for r in res:
            print("-", r['path'])
            
        print("\n--- Example Imports ---")
        res = await s.run("MATCH (f:File)-[:IMPORTS]->(imp:File) RETURN f.path as source, imp.path as target LIMIT 10")
        async for r in res:
            print(f"{r['source']} -> {r['target']}")
    await neo4j_db.close()

if __name__ == "__main__":
    asyncio.run(main())
