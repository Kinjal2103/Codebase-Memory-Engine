from neo4j import AsyncGraphDatabase
from app.config import settings

class Neo4jDatabase:
    def __init__(self):
        self._driver = None

    def connect(self):
        """
        Initializes the async Neo4j driver.
        """
        self._driver = AsyncGraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
        )

    async def close(self):
        """
        Closes the Neo4j driver connection.
        """
        if self._driver:
            await self._driver.close()

    async def verify_connection(self) -> dict:
        """
        Verifies the Neo4j connection by writing a test node, reading it back,
        and deleting it to clean up.
        """
        if not self._driver:
            raise RuntimeError("Neo4j driver is not initialized. Call connect() first.")

        async with self._driver.session() as session:
            # 1. Write a test node
            write_query = """
            MERGE (t:TestNode {id: $id})
            ON CREATE SET t.name = $name, t.created_at = timestamp()
            RETURN t.id as id, t.name as name
            """
            write_result = await session.run(write_query, id="connection_test_123", name="FastAPI Connection Node")
            write_record = await write_result.single()
            if not write_record:
                raise RuntimeError("Failed to write/merge the test node into Neo4j.")

            # 2. Read the test node back
            read_query = """
            MATCH (t:TestNode {id: $id})
            RETURN t.id as id, t.name as name
            """
            read_result = await session.run(read_query, id="connection_test_123")
            read_record = await read_result.single()
            if not read_record:
                raise RuntimeError("Failed to read the test node back from Neo4j.")

            # 3. Clean up (delete) the test node
            delete_query = """
            MATCH (t:TestNode {id: $id})
            DETACH DELETE t
            """
            await session.run(delete_query, id="connection_test_123")

            return {
                "status": "healthy",
                "message": "Neo4j connection verified successfully! Wrote and read back test node.",
                "test_node": {
                    "id": read_record["id"],
                    "name": read_record["name"]
                }
            }

# Global database instance
neo4j_db = Neo4jDatabase()
