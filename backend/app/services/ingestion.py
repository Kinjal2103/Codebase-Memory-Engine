from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete
from app.services.file_walker import walk_repository
from app.services.ast_parser import parse_file
from app.services.git_indexer import get_git_history
from app.models.code_node import DBFile, DBFunction, DBClass, DBImport, DBCommit, commit_files
from app.utils.chunker import chunk_functions
from app.services.embedder import embed_chunks
from app.services.vector_store import build_index

async def ingest_repository(repo_path: str, db: AsyncSession) -> dict:
    """
    Orchestrates the ingestion pipeline for a local Git repository:
      1. Clears old data (cascade deletes files and associated AST nodes, and deletes commits).
      2. Walks the filesystem to scan for supported code files (.py, .js, .ts).
      3. Parses AST nodes (classes, functions, imports) for each file.
      4. Fetches Git history and maps commits to touched files in PostgreSQL.
      5. Commits changes transactionally and returns a summary dict.
    """
    # 1. Clean previous data from database tables
    # Since DBFile defines cascade deletes, deleting all files cleans functions, classes, and imports.
    await db.execute(delete(DBFile))
    await db.execute(delete(DBCommit))
    await db.commit()

    # 2. Walk the repository to find source files
    files_meta = walk_repository(repo_path)
    
    path_to_file_id = {}
    total_files = len(files_meta)
    total_functions = 0
    total_classes = 0

    # 3. Process each file and extract AST nodes
    for file_info in files_meta:
        # Standardize path string to use forward slashes for cross-OS mapping consistency
        rel_path_std = file_info["rel_path"].replace("\\", "/")

        db_file = DBFile(
            path=rel_path_std,
            language=file_info["language"],
            last_modified=file_info["last_modified"]
        )
        db.add(db_file)
        # Flush to generate the primary key ID
        await db.flush()

        path_to_file_id[rel_path_std] = db_file.id

        # Parse functions, classes, and imports
        ast_nodes = parse_file(file_info["abs_path"], file_info["rel_path"], file_info["language"])

        # Insert Functions
        for func in ast_nodes["functions"]:
            db_func = DBFunction(
                file_id=db_file.id,
                name=func["name"],
                start_line=func["start_line"],
                end_line=func["end_line"],
                source_code=func["source_code"]
            )
            db.add(db_func)
            total_functions += 1

        # Insert Classes
        for cls in ast_nodes["classes"]:
            db_class = DBClass(
                file_id=db_file.id,
                name=cls["name"],
                start_line=cls["start_line"],
                end_line=cls["end_line"]
            )
            db.add(db_class)
            total_classes += 1

        # Insert Imports
        for imp in ast_nodes["imports"]:
            db_imp = DBImport(
                file_id=db_file.id,
                imported_name=imp["imported_name"],
                source_module=imp["source_module"]
            )
            db.add(db_imp)

    # Flush all AST models to the DB
    await db.flush()

    # 4. Process Git History
    commits_meta = get_git_history(repo_path)
    total_commits = len(commits_meta)

    for commit_info in commits_meta:
        db_commit = DBCommit(
            hash=commit_info["hash"],
            author=commit_info["author"],
            date=commit_info["date"],
            message=commit_info["message"]
        )
        db.add(db_commit)
        # Flush to obtain commit ID
        await db.flush()

        # Link commits to files they touched (many-to-many relationship)
        for changed_path in commit_info["changed_files"]:
            changed_path_std = changed_path.replace("\\", "/")
            file_id = path_to_file_id.get(changed_path_std)
            if file_id:
                # Direct SQL insert to bypass async lazy-loading bugs
                await db.execute(
                    commit_files.insert().values(
                        commit_id=db_commit.id,
                        file_id=file_id
                    )
                )

    # 5. Commit all changes transactionally
    await db.commit()

    # 6. Build and save the FAISS vector index automatically
    try:
        print("=== Building Vector Embeddings & FAISS Index ===")
        chunks = await chunk_functions(db)
        if chunks:
            texts = [c["text"] for c in chunks]
            metadata = [c["meta"] for c in chunks]
            embeddings = embed_chunks(texts)
            build_index(embeddings, metadata)
            print(f"Successfully built FAISS index for {len(chunks)} functions.")
        else:
            print("No functions found to index in FAISS.")
    except Exception as e:
        import traceback
        print("CRITICAL ERROR building vector index:")
        traceback.print_exc()
        raise RuntimeError(f"Failed to build vector index: {str(e)}") from e

    return {
        "files": total_files,
        "functions": total_functions,
        "classes": total_classes,
        "commits": total_commits
    }
