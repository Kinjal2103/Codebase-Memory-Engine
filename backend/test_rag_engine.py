import asyncio
import sys
import os

# Add the current directory to sys.path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app.neo4j_db import neo4j_db
from app.services.rag_engine import answer_question, analyze_impact

async def main():
    print("Initializing databases...")
    neo4j_db.connect()
    
    # 1. Test answer_question
    question = "where is database connection established?"
    print(f"\n--- Testing answer_question: '{question}' ---")
    
    res_ans = await answer_question(question)
    print("\nResult Keys:", list(res_ans.keys()))
    print("Sources found:", len(res_ans["sources"]))
    print("Graph context (neighbors found):", res_ans["graph_context"])
    print("\nAnswer response snippet:\n", res_ans["answer"][:300])
    
    # 2. Test analyze_impact
    fn_name = "ingest_repository"
    print(f"\n--- Testing analyze_impact: '{fn_name}' ---")
    
    res_imp = await analyze_impact(fn_name)
    print("\nResult Keys:", list(res_imp.keys()))
    print("Affected callers count:", len(res_imp["affected_functions"]))
    print("Safe to modify:", res_imp["safe_to_modify"])
    print("\nRisk analysis snippet:\n", res_imp["risk_analysis"][:300])
    
    await neo4j_db.close()
    print("\nSuccess! RAG Engine pipeline verified.")

if __name__ == "__main__":
    asyncio.run(main())
