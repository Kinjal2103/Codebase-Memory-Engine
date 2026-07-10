import os
import shutil
import tempfile
import zipfile
import stat
from pathlib import Path
import git
import subprocess

# Directories to skip entirely during local traversal check
IGNORED_FOLDERS = {
    "node_modules",
    ".git",
    "venv",
    "__pycache__",
    "dist",
    "build",
}

# Supported file extensions for validation
SUPPORTED_EXTENSIONS = {".py", ".js", ".ts", ".go", ".java"}

def force_cleanup_dir(path: str):
    """
    Force deletes a directory by resetting read-only permissions on Windows if needed.
    """
    def remove_readonly(func, p, excinfo):
        try:
            os.chmod(p, stat.S_IWRITE)
            func(p)
        except Exception:
            pass
            
    if os.path.exists(path):
        # First try normal rmtree, if it fails, fallback to onerror handler
        try:
            shutil.rmtree(path)
        except Exception:
            try:
                shutil.rmtree(path, onerror=remove_readonly)
            except Exception:
                pass

class RepoResolver:
    @staticmethod
    def from_local_path(path: str) -> str:
        """
        METHOD 1 — from_local_path(path: str) -> str
        - Validate the path exists on disk: if not, raise ValueError("Path does not exist: {path}")
        - Validate it is a directory: if not, raise ValueError("Path is not a directory: {path}")
        - Validate it contains at least one .py, .js, .ts, .go, or .java file: 
          if not, raise ValueError("No supported source files found in {path}")
        - Return the path as-is (no copy needed)
        - No cleanup needed for local paths
        """
        p = Path(path)
        if not p.exists():
            raise ValueError(f"Path does not exist: {path}")
        if not p.is_dir():
            raise ValueError(f"Path is not a directory: {path}")
        
        # Traverse recursively to look for at least one supported file
        found = False
        for root, dirs, files in os.walk(p):
            # Prune ignored folders in-place
            dirs[:] = [d for d in dirs if d not in IGNORED_FOLDERS]
            for file in files:
                if Path(file).suffix.lower() in SUPPORTED_EXTENSIONS:
                    found = True
                    break
            if found:
                break
        
        if not found:
            raise ValueError(f"No supported source files found in {path}")
            
        return str(p.resolve())

    @staticmethod
    def from_github_url(url: str) -> tuple[str, callable]:
        """
        METHOD 2 — from_github_url(url: str) -> tuple[str, callable]
        - Validate URL starts with https://github.com/ — raise ValueError if not
        - Strip trailing .git from URL if present
        - Extract owner/repo from URL using simple string split (no regex)
        - Create a temp directory using tempfile.mkdtemp()
        - Clone the repo using: git.Repo.clone_from(url, tmpdir, depth=1)
          depth=1 means shallow clone — only latest commit, much faster
        - If clone fails (private repo, bad URL, no network):
          catch git.exc.GitCommandError and raise ValueError("Could not clone repo: {url}. Is it public?")
        - Return (tmpdir, cleanup_fn) where cleanup_fn = lambda: shutil.rmtree(tmpdir)
        - Set a clone timeout of 60 seconds
        """
        stripped_url = url.strip()
        if not stripped_url.startswith("https://github.com/"):
            raise ValueError(f"URL does not start with https://github.com/: {url}")
            
        cleaned_url = stripped_url
        if cleaned_url.endswith(".git"):
            cleaned_url = cleaned_url[:-4]
            
        # Extract owner/repo using simple string split
        path_part = cleaned_url[len("https://github.com/"):]
        parts = [p for p in path_part.split("/") if p]
        if len(parts) < 2:
            raise ValueError(f"Invalid GitHub URL format: {url}")
            
        # Create temp directory
        tmpdir = tempfile.mkdtemp()
        cleanup_fn = lambda: force_cleanup_dir(tmpdir)
        
        try:
            # We enforce a timeout of 60 seconds.
            # GitPython's clone_from does not support kill_after_timeout on Windows.
            # Thus, we handle it platform-dependently.
            if os.name == 'nt':
                # Windows implementation using subprocess
                try:
                    subprocess.run(
                        ["git", "clone", "--depth", "1", stripped_url, tmpdir],
                        timeout=60,
                        check=True,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE
                    )
                except subprocess.TimeoutExpired as e:
                    raise TimeoutError("Clone timed out. Repo may be too large.") from e
                except subprocess.CalledProcessError as e:
                    stderr_msg = e.stderr.decode(errors='replace') if e.stderr else ""
                    raise git.exc.GitCommandError(e.cmd, e.returncode, stderr=stderr_msg) from e
            else:
                # Unix implementation using GitPython's kill_after_timeout
                git.Repo.clone_from(stripped_url, tmpdir, depth=1, kill_after_timeout=60)
                
        except git.exc.GitCommandError as e:
            cleanup_fn()
            # If the process is terminated via signal or timeout on Unix (status -9 or SIGKILL)
            if hasattr(e, "status") and e.status == -9:
                raise TimeoutError("Clone timed out. Repo may be too large.") from e
            raise ValueError(f"Could not clone repo: {url}. Is it public?") from e
        except TimeoutError as e:
            cleanup_fn()
            raise e
        except Exception as e:
            cleanup_fn()
            raise e
            
        return tmpdir, cleanup_fn

    @staticmethod
    def from_zip_upload(zip_bytes: bytes) -> tuple[str, callable]:
        """
        METHOD 3 — from_zip_upload(zip_bytes: bytes) -> tuple[str, callable]
        - Create a temp directory using tempfile.mkdtemp()
        - Write zip_bytes to a file in that temp dir
        - Validate it is a real zip: use zipfile.is_zipfile() — raise ValueError if not
        - Check zip does not contain path traversal (no "../" in any member name):
          raise ValueError("Invalid zip file — contains unsafe paths") if found
        - Extract zip to tmpdir using zipfile.ZipFile.extractall()
        - After extracting, find the actual repo root:
          if all files are inside one top-level folder (common when zipping a repo),
          return that subfolder as the path, not tmpdir itself
        - Return (tmpdir, cleanup_fn) where cleanup_fn = lambda: shutil.rmtree(tmpdir)
        """
        tmpdir = tempfile.mkdtemp()
        cleanup_fn = lambda: force_cleanup_dir(tmpdir)
        
        try:
            # Write zip bytes to a temp file
            zip_filepath = os.path.join(tmpdir, "uploaded_repo.zip")
            with open(zip_filepath, "wb") as f:
                f.write(zip_bytes)
                
            # Validate it is a real zip
            if not zipfile.is_zipfile(zip_filepath):
                raise ValueError("Uploaded file is not a valid zip archive.")
                
            # Check path traversal
            with zipfile.ZipFile(zip_filepath) as z:
                for name in z.namelist():
                    if "../" in name or "..\\" in name:
                        raise ValueError("Invalid zip file — contains unsafe paths")
                        
                # Extract zip to tmpdir
                z.extractall(tmpdir)
                
            # Clean up the zip file itself so it doesn't get processed
            if os.path.exists(zip_filepath):
                os.remove(zip_filepath)
                
            # Find the actual repo root
            contents = os.listdir(tmpdir)
            # Remove system files like __MACOSX if present
            contents = [c for c in contents if c != "__MACOSX"]
            
            target_path = tmpdir
            if len(contents) == 1:
                subpath = os.path.join(tmpdir, contents[0])
                if os.path.isdir(subpath):
                    target_path = subpath
                    
            return target_path, cleanup_fn
            
        except Exception as e:
            cleanup_fn()
            raise e
