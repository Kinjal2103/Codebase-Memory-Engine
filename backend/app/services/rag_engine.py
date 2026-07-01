from sqlalchemy import select
from app.database import async_session
from app.models.code_node import DBFunction, DBCommit, DBFile
from app.services.vector_store import search as faiss_search
from app.services.graph_queries import get_neighbors, get_callers, get_callees
from app.services.llm import ask_llm

# RAG prompt template for answering questions
ANSWER_PROMPT_TEMPLATE = """You are a senior software engineer analyzing a codebase.

USER QUESTION: {question}

RELEVANT CODE (retrieved by semantic search):
{code_chunks}

DEPENDENCY CONTEXT (from call graph):
{graph_context}

RECENT GIT HISTORY (for these files):
{git_context}

Instructions:
- Answer the question directly and specifically
- Reference exact file names and function names
- If you identify a risk, explain the reason
- If you are unsure, say so — do not hallucinate function names
- Keep your answer under 300 words"""

# Prompt template for impact analysis
IMPACT_PROMPT_TEMPLATE = """Function being modified: {function_name}

Functions that CALL this (will be affected if signature changes):
{callers}

Functions this CALLS (dependencies it relies on):
{callees}

Based on this dependency graph:
1. Rate the risk of modifying this function: LOW / MEDIUM / HIGH
2. List which callers will definitely need to be updated
3. List what could silently break (runtime errors, not compile errors)
4. Give one specific recommendation for how to safely make this change"""

async def answer_question(question: str) -> dict:
    """
    RAG pipeline that:
      1. Performs FAISS semantic search for the top 6 chunks.
      2. Queries PostgreSQL to retrieve full source code for the chunks.
      3. Queries Neo4j to find depth-1 neighborhood (dependencies).
      4. Queries PostgreSQL to get git history for the involved files.
      5. Synthesizes a prompt and queries the LLM.
    """
    print(f"RAG: Searching FAISS for question '{question}'...")
    # Step 1: FAISS search -> top 6 chunks
    faiss_results = faiss_search(question, top_k=6)
    
    # Step 2: Fetch source code from PostgreSQL and get Neo4j neighbors
    func_ids = [r["function_id"] for r in faiss_results if "function_id" in r]
    
    source_codes = {}
    if func_ids:
        async with async_session() as db:
            stmt = select(DBFunction).where(DBFunction.id.in_(func_ids))
            db_res = await db.execute(stmt)
            funcs = db_res.scalars().all()
            for f in funcs:
                source_codes[f.id] = f.source_code
                
    code_chunks_list = []
    sources = []
    all_neighbors = set()
    file_paths = set()
    
    for r in faiss_results:
        fid = r.get("function_id")
        code = source_codes.get(fid, "")
        file_path = r.get("file")
        func_name = r.get("name")
        
        if file_path:
            file_paths.add(file_path)
            
        code_chunks_list.append(
            f"FILE: {file_path}\nFUNCTION: {func_name}\n\n{code}"
        )
        
        sources.append({
            "function_name": func_name,
            "file": file_path,
            "start_line": r.get("line")
        })
        
        # Step 3: Get Neo4j neighbors (depth=1)
        if func_name:
            neighbors = await get_neighbors(func_name, depth=1)
            all_neighbors.update(neighbors)
            
    code_chunks_formatted = "\n---\n".join(code_chunks_list)
    graph_context_formatted = ", ".join(all_neighbors) if all_neighbors else "No immediate neighbors found."
    
    # Step 4: Fetch git history from PostgreSQL
    git_commits = []
    if file_paths:
        async with async_session() as db:
            stmt = (
                select(DBCommit)
                .join(DBCommit.files)
                .where(DBFile.path.in_(list(file_paths)))
                .order_by(DBCommit.date.desc())
            )
            db_res = await db.execute(stmt)
            commits = db_res.scalars().all()
            
            seen_hashes = set()
            for c in commits:
                if c.hash not in seen_hashes:
                    seen_hashes.add(c.hash)
                    git_commits.append(
                        f"Commit: {c.hash[:7]} by {c.author} on {c.date.strftime('%Y-%m-%d')}\nMessage: {c.message}"
                    )
                    
    git_context_formatted = "\n---\n".join(git_commits) if git_commits else "No recent git history found."
    
    # Step 5: Format prompt and call LLM
    prompt = ANSWER_PROMPT_TEMPLATE.format(
        question=question,
        code_chunks=code_chunks_formatted,
        graph_context=graph_context_formatted,
        git_context=git_context_formatted
    )
    
    print("RAG: Prompt generated. Querying LLM...")
    answer = await ask_llm(prompt)
    
    return {
        "answer": answer,
        "sources": sources,
        "graph_context": list(all_neighbors)
    }

async def analyze_impact(function_name: str) -> dict:
    """
    Impact analysis pipeline that:
      1. Finds callers (depth=3) in Neo4j call graph.
      2. Finds callees (depth=2) in Neo4j call graph.
      3. Constructs prompt and queries the LLM for risk analysis.
    """
    print(f"RAG: Performing impact analysis for function '{function_name}'...")
    # Step 1: Callers (depth=3)
    callers = await get_callers(function_name, depth=3)
    
    # Step 2: Callees (depth=2)
    callees = await get_callees(function_name, depth=2)
    
    # Step 3: Format impact prompt
    prompt = IMPACT_PROMPT_TEMPLATE.format(
        function_name=function_name,
        callers=", ".join(callers) if callers else "None (No caller functions found)",
        callees=", ".join(callees) if callees else "None (No dependency functions called)"
    )
    
    # Step 4: Ask LLM
    print("RAG: Querying LLM for change impact...")
    risk_analysis = await ask_llm(prompt)
    
    # Boolean indicator: if there are no calling functions, it is safer to modify.
    safe_to_modify = len(callers) == 0
    
    return {
        "risk_analysis": risk_analysis,
        "affected_functions": callers,
        "safe_to_modify": safe_to_modify
    }
