import asyncio
import sys
import os

# Add the current directory to sys.path so we can import app
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app.database import async_session
from app.utils.chunker import chunk_functions

async def main():
    print("Connecting to database and running chunk_functions...")
    async with async_session() as session:
        chunks = await chunk_functions(session)
        print(f"Successfully retrieved {len(chunks)} chunks.")
        if chunks:
            print("\nExample Chunk 1:")
            print("-" * 40)
            print("TEXT:\n", chunks[0]["text"])
            print("-" * 40)
            print("METADATA:", chunks[0]["meta"])
        else:
            print("No chunks returned (is the database empty or has no functions with >= 10 chars code?)")

if __name__ == "__main__":
    asyncio.run(main())
