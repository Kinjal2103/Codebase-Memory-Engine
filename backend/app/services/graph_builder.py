import os
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.neo4j_db import neo4j_db
from app.models.code_node import DBFile, DBFunction, DBClass, DBImport

async def build_graph(db: AsyncSession):
    """
    Clears the existing Neo4j database, queries AST data from PostgreSQL,
    and inserts Files, Functions, and Classes as nodes with CALLS, IMPORTS,
    and DEFINED_IN relationships.
    """
    print("Connecting to Neo4j session...")
    async with neo4j_db._driver.session() as session:
        # Clear existing nodes and relationships
        print("Clearing existing Neo4j graph data...")
        await session.run("MATCH (n) DETACH DELETE n")

        # 1. Query all entities from PostgreSQL
        print("Fetching code entities from PostgreSQL...")
        
        # Fetch Files
        res_files = await db.execute(select(DBFile))
        files = res_files.scalars().all()
        
        # Fetch Functions with File relationship loaded
        res_funcs = await db.execute(select(DBFunction).options(selectinload(DBFunction.file)))
        functions = res_funcs.scalars().all()
        
        # Fetch Classes with File relationship loaded
        res_classes = await db.execute(select(DBClass).options(selectinload(DBClass.file)))
        classes = res_classes.scalars().all()
        
        # Fetch Imports with File relationship loaded
        res_imports = await db.execute(select(DBImport).options(selectinload(DBImport.file)))
        imports = res_imports.scalars().all()

        print(f"Entities to insert: {len(files)} files, {len(functions)} functions, {len(classes)} classes, {len(imports)} imports.")

        # 2. Insert File Nodes
        print("Creating (:File) nodes...")
        for f in files:
            await session.run(
                """
                MERGE (file:File {path: $path})
                ON CREATE SET file.language = $language
                ON MATCH SET file.language = $language
                """,
                path=f.path,
                language=f.language
            )

        # 3. Insert Function Nodes and DEFINED_IN relationships
        print("Creating (:Function) nodes and DEFINED_IN relationships...")
        for fn in functions:
            if not fn.name:
                continue
            file_path = fn.file.path if fn.file else "unknown"
            
            # MERGE Function Node
            await session.run(
                """
                MERGE (func:Function {name: $name, file: $file})
                ON CREATE SET func.start_line = $start_line, func.end_line = $end_line
                ON MATCH SET func.start_line = $start_line, func.end_line = $end_line
                """,
                name=fn.name,
                file=file_path,
                start_line=fn.start_line,
                end_line=fn.end_line
            )
            
            # MERGE DEFINED_IN relationship to File
            await session.run(
                """
                MATCH (func:Function {name: $name, file: $file})
                MATCH (file:File {path: $file})
                MERGE (func)-[:DEFINED_IN]->(file)
                """,
                name=fn.name,
                file=file_path
            )

        # 4. Insert Class Nodes (and link DEFINED_IN to File if applicable)
        print("Creating (:Class) nodes...")
        for c in classes:
            if not c.name:
                continue
            file_path = c.file.path if c.file else "unknown"
            
            # MERGE Class Node
            await session.run(
                """
                MERGE (cls:Class {name: $name, file: $file})
                ON CREATE SET cls.start_line = $start_line
                ON MATCH SET cls.start_line = $start_line
                """,
                name=c.name,
                file=file_path,
                start_line=c.start_line
            )

        # 5. Detect and Create CALLS relationships (Function -> Function)
        print("Detecting and creating CALLS relationships...")
        for f1 in functions:
            if not f1.name or not f1.source_code:
                continue
            f1_file = f1.file.path if f1.file else "unknown"
            
            for f2 in functions:
                # Exclude self-calls and empty names
                if f1.id == f2.id or not f2.name:
                    continue
                
                # Simple substring matching
                if f2.name in f1.source_code:
                    f2_file = f2.file.path if f2.file else "unknown"
                    await session.run(
                        """
                        MATCH (fn1:Function {name: $name1, file: $file1})
                        MATCH (fn2:Function {name: $name2, file: $file2})
                        MERGE (fn1)-[:CALLS]->(fn2)
                        """,
                        name1=f1.name,
                        file1=f1_file,
                        name2=f2.name,
                        file2=f2_file
                    )

        # 6. Detect and Create IMPORTS relationships (File -> File)
        print("Detecting and creating IMPORTS relationships...")
        def path_to_module(path: str) -> str:
            base, _ = os.path.splitext(path)
            return base.replace("/", ".")

        module_to_file = {}
        for f in files:
            mod = path_to_module(f.path)
            module_to_file[mod] = f.path
            base_name = os.path.basename(f.path).split('.')[0]
            module_to_file[base_name] = f.path

        for imp in imports:
            source_file = imp.file.path if imp.file else None
            if not source_file:
                continue
                
            target_file = None
            if imp.source_module:
                if imp.source_module in module_to_file:
                    target_file = module_to_file[imp.source_module]
                else:
                    for mod, p in module_to_file.items():
                        if mod.endswith(imp.source_module):
                            target_file = p
                            break
            
            if not target_file and imp.imported_name:
                if imp.imported_name in module_to_file:
                    target_file = module_to_file[imp.imported_name]
                else:
                    for mod, p in module_to_file.items():
                        if mod.endswith(imp.imported_name):
                            target_file = p
                            break
                            
            if target_file and target_file != source_file:
                await session.run(
                    """
                    MATCH (f1:File {path: $source})
                    MATCH (f2:File {path: $target})
                    MERGE (f1)-[:IMPORTS]->(f2)
                    """,
                    source=source_file,
                    target=target_file
                )
                
    print("Neo4j graph building completed successfully.")
