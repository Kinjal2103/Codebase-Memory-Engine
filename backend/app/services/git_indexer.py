import git
from datetime import datetime
from pathlib import Path

def get_git_history(repo_path: str, max_commits: int = 100) -> list[dict]:
    """
    Extracts commit history (last 100 commits max) from a local Git repository.
    
    For each commit, extracts:
      - hash: commit hex hash (SHA-1)
      - author: author name and email
      - date: commit date (timezone-aware datetime)
      - message: commit message
      - changed_files: list of relative file paths modified/added/deleted in this commit
    """
    path = Path(repo_path).resolve()
    if not path.exists():
        raise ValueError(f"Path does not exist: {repo_path}")
        
    try:
        repo = git.Repo(str(path), search_parent_directories=True)
    except git.InvalidGitRepositoryError:
        print(f"Warning: {repo_path} is not a valid Git repository.")
        return []
    
    if repo.bare or not repo.head.is_valid():
        return []

    commits_list = []
    
    # Iterate through HEAD branch commits (up to max_commits count)
    for commit in repo.iter_commits(max_count=max_commits):
        changed_files = set()
        
        try:
            if commit.parents:
                # Compare against all parents to extract changed files
                for parent in commit.parents:
                    diffs = parent.diff(commit)
                    for diff in diffs:
                        if diff.a_path:
                            changed_files.add(diff.a_path)
                        if diff.b_path:
                            changed_files.add(diff.b_path)
            else:
                # Initial commit: diff against the empty tree
                diffs = commit.diff(git.NULL_TREE)
                for diff in diffs:
                    if diff.b_path:
                        changed_files.add(diff.b_path)
        except Exception as e:
            print(f"Warning: Failed to extract diff files for commit {commit.hexsha[:7]}: {e}")

        commits_list.append({
            "hash": commit.hexsha,
            "author": f"{commit.author.name} <{commit.author.email}>" if commit.author else "Unknown",
            "date": commit.committed_datetime,
            "message": commit.message.strip() if commit.message else "",
            "changed_files": list(changed_files)
        })
        
    return commits_list
