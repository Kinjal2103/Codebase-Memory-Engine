import os
from datetime import datetime, timezone
from pathlib import Path

# Directories to skip entirely
IGNORED_FOLDERS = {
    "node_modules",
    ".git",
    "venv",
    "__pycache__",
    "dist",
    "build",
}

# File extensions to map to languages
SUPPORTED_EXTENSIONS = {
    ".py": "python",
    ".js": "javascript",
    ".ts": "typescript",
}

def walk_repository(repo_path: str) -> list[dict]:
    """
    Recursively walks a repository directory path to find Python, JavaScript, 
    and TypeScript source files, skipping ignored directories.

    Returns a list of dicts:
        [
            {
                "abs_path": str,       # Absolute path to the file
                "rel_path": str,       # Path relative to repo_path
                "language": str,       # 'python', 'javascript', or 'typescript'
                "last_modified": datetime # Timezone-aware modification time
            },
            ...
        ]
    """
    base_path = Path(repo_path).resolve()
    if not base_path.exists() or not base_path.is_dir():
        raise ValueError(f"Path does not exist or is not a directory: {repo_path}")

    matching_files = []

    for root, dirs, files in os.walk(base_path):
        # Prune ignored directories in-place so os.walk does not traverse them
        dirs[:] = [d for d in dirs if d not in IGNORED_FOLDERS]

        for file in files:
            file_path = Path(root) / file
            suffix = file_path.suffix.lower()

            if suffix in SUPPORTED_EXTENSIONS:
                try:
                    stat_info = file_path.stat()
                    # Convert to timezone-aware UTC datetime
                    last_modified = datetime.fromtimestamp(stat_info.st_mtime, tz=timezone.utc)

                    matching_files.append({
                        "abs_path": str(file_path),
                        "rel_path": str(file_path.relative_to(base_path)),
                        "language": SUPPORTED_EXTENSIONS[suffix],
                        "last_modified": last_modified
                    })
                except Exception as e:
                    print(f"Warning: Could not read stat for {file_path}: {e}")

    return matching_files
