from app.neo4j_db import neo4j_db

async def get_callers(fn_name: str, depth: int = 2) -> list[str]:
    """
    Returns a list of distinct function names that call the target function
    up to the specified depth.
    """
    depth_val = int(depth)
    query = f"""
    MATCH (target:Function {{name: $name}})
    MATCH (caller:Function)-[:CALLS*1..{depth_val}]->(target)
    RETURN DISTINCT caller.name as name
    """
    async with neo4j_db._driver.session() as session:
        res = await session.run(query, name=fn_name)
        return [record["name"] async for record in res]

async def get_callees(fn_name: str, depth: int = 2) -> list[str]:
    """
    Returns a list of distinct function names that the target function calls
    up to the specified depth.
    """
    depth_val = int(depth)
    query = f"""
    MATCH (source:Function {{name: $name}})
    MATCH (source)-[:CALLS*1..{depth_val}]->(callee:Function)
    RETURN DISTINCT callee.name as name
    """
    async with neo4j_db._driver.session() as session:
        res = await session.run(query, name=fn_name)
        return [record["name"] async for record in res]

async def get_neighbors(fn_name: str, depth: int = 1) -> list[str]:
    """
    Returns a combined list of immediate callers and callees (depth=1 by default).
    Deduplicates the output while preserving ordering.
    """
    callers = await get_callers(fn_name, depth=depth)
    callees = await get_callees(fn_name, depth=depth)
    
    seen = set()
    result = []
    for name in callers + callees:
        if name not in seen and name != fn_name:
            seen.add(name)
            result.append(name)
    return result

async def get_subgraph(fn_name: str, depth: int = 2) -> dict:
    """
    Returns a subgraph (nodes and edges) containing the target function node and
    its calling/called neighbors up to depth.
    """
    depth_val = int(depth)
    query = f"""
    MATCH (fn:Function {{name: $name}})
    MATCH path = (a:Function)-[:CALLS*0..{depth_val}]-(b:Function)
    WHERE fn in nodes(path)
    RETURN path
    """
    nodes_dict = {}
    edges_set = set()
    
    async with neo4j_db._driver.session() as session:
        res = await session.run(query, name=fn_name)
        async for record in res:
            path = record["path"]
            
            # Extract nodes from the path
            for node in path.nodes:
                node_id = node.element_id
                nodes_dict[node_id] = {
                    "id": node_id,
                    "name": node.get("name"),
                    "file": node.get("file")
                }
                
            # Extract edges from the path
            for rel in path.relationships:
                source_id = rel.start_node.element_id
                target_id = rel.end_node.element_id
                edges_set.add((source_id, target_id, rel.type))
                
    edges_list = []
    for src, tgt, rel_type in edges_set:
        edges_list.append({
            "source": src,
            "target": tgt,
            "type": rel_type
        })
        
    return {
        "nodes": list(nodes_dict.values()),
        "edges": edges_list
    }

async def get_file_imports(file_path: str) -> list[str]:
    """
    Returns a list of paths of files that the target file imports.
    """
    query = """
    MATCH (f:File {path: $path})
    MATCH (f)-[:IMPORTS]->(imp:File)
    RETURN DISTINCT imp.path as path
    """
    async with neo4j_db._driver.session() as session:
        res = await session.run(query, path=file_path)
        return [record["path"] async for record in res]
