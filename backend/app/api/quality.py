import logging
import traceback
from fastapi import APIRouter, Depends, HTTPException, status
from app.neo4j_db import neo4j_db
from app.services.llm import ask_llm

logger = logging.getLogger("app.api.quality")
router = APIRouter()

@router.get("/quality")
async def get_code_quality():
    """
    GET /api/quality
    Scans the codebase using Neo4j call graph queries to find:
    1. Dead code (uncalled functions)
    2. Circular dependencies (functions calling each other in cycles)
    3. Highly coupled functions (functions calling > 5 others)
    Then, gets an LLM summary of the overall code quality.
    """
    try:
        # Check if driver is initialized
        if not neo4j_db._driver:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Neo4j driver is not initialized. Call connect() first."
            )

        # 1. Dead code detection
        dead_code_query = """
        MATCH (f:Function)
        WHERE NOT (f)<-[:CALLS]-()
        RETURN f.name as name, f.file as file
        """
        
        # 2. Circular dependency detection
        circular_query = """
        MATCH path=(a:Function)-[:CALLS*2..5]->(a)
        RETURN nodes(path) as nodes
        LIMIT 20
        """
        
        # 3. Highly coupled functions
        coupling_query = """
        MATCH (f:Function)-[:CALLS]->(other)
        WITH f, count(other) as out_degree
        WHERE out_degree > 5
        RETURN f.name as name, f.file as file, out_degree as out_degree
        ORDER BY out_degree DESC
        LIMIT 20
        """

        dead_code = []
        circular_deps = []
        high_coupling = []

        # Run Neo4j session queries
        try:
            async with neo4j_db._driver.session() as session:
                # Execute Dead Code Query
                res_dead = await session.run(dead_code_query)
                async for record in res_dead:
                    name = record["name"]
                    file = record["file"]
                    # Filter out: __init__, main, any function starting with "on_" or "handle_"
                    if name in ("__init__", "main") or name.startswith("on_") or name.startswith("handle_"):
                        continue
                    dead_code.append({"name": name, "file": file})

                # Execute Circular Dependency Query
                res_circ = await session.run(circular_query)
                async for record in res_circ:
                    nodes = record["nodes"]
                    cycle_names = [node.get("name") for node in nodes]
                    circular_deps.append({"cycle": cycle_names})

                # Execute High Coupling Query
                res_couple = await session.run(coupling_query)
                async for record in res_couple:
                    high_coupling.append({
                        "name": record["name"],
                        "file": record["file"],
                        "calls_count": record["out_degree"]
                    })
        except Exception as neo_err:
            logger.error(f"Neo4j query error: {neo_err}\n{traceback.format_exc()}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Neo4j connection error or query execution failed: {str(neo_err)}"
            )

        # 4. Generate LLM Overall Health Summary
        prompt = (
            f"Based on the following code quality metrics, summarize the overall codebase health in one short, descriptive sentence.\n\n"
            f"Metrics:\n"
            f"- Dead code functions (uncalled, excluding boilerplate): {len(dead_code)}\n"
            f"- Circular dependency cycles (length 2-5) detected: {len(circular_deps)}\n"
            f"- Highly coupled functions (calling > 5 others): {len(high_coupling)}\n"
        )
        
        summary = await ask_llm(prompt)
        
        # Check LLM communication errors
        if "Error calling" in summary or "Error:" in summary or not summary:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"LLM unavailable — start Ollama. Detail: {summary}"
            )

        return {
            "dead_code": dead_code,
            "circular_deps": circular_deps,
            "high_coupling": high_coupling,
            "summary": summary.strip()
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Unexpected error in get_code_quality: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
