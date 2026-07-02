import os
import subprocess
import time
import httpx
import sys

def main():
    print("=== STARTING END-TO-END ENDPOINT VERIFICATION ===")
    
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    venv_python = os.path.join(backend_dir, "..", "venv", "Scripts", "python.exe")
    if not os.path.exists(venv_python):
        venv_python = "python"
        
    print(f"Using Python: {venv_python}")
    print("Launching FastAPI server (output logged to server_verify.log)...")
    
    log_file_path = os.path.join(backend_dir, "server_verify.log")
    
    with open(log_file_path, "w", encoding="utf-8") as log_file:
        server_process = subprocess.Popen(
            [venv_python, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
            cwd=backend_dir,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            text=True
        )
    
    # Wait for startup (CodeBERT takes ~12 seconds to load)
    print("Waiting 20 seconds for server startup...")
    time.sleep(20)
    
    # Check if process is still running
    if server_process.poll() is not None:
        print("CRITICAL: Server process died on startup!")
        if os.path.exists(log_file_path):
            with open(log_file_path, "r", encoding="utf-8") as f:
                print(f.read())
        sys.exit(1)
        
    client = httpx.Client(timeout=90.0)
    
    try:
        # Check health first
        print("\n--- Testing Health Check ---")
        try:
            r = client.get("http://localhost:8000/api/health")
            print(f"Status: {r.status_code}")
            print(r.json())
        except Exception as e:
            print(f"Failed to query /api/health: {e}")
            print("\n--- Server Stdout/Stderr logs ---")
            if os.path.exists(log_file_path):
                with open(log_file_path, "r", encoding="utf-8") as f:
                    print(f.read())
            sys.exit(1)
            
        # Ingest the workspace repo to populate data
        print("\n--- Ingesting Repository ---")
        repo_path = "c:/Users/kinja/Desktop/CSE/codebase-memory"
        try:
            r = client.post("http://localhost:8000/api/ingest", json={"repo_path": repo_path})
            print(f"Status: {r.status_code}")
            print(r.json())
        except Exception as e:
            print(f"Failed to query /api/ingest: {e}")
            
        # Query repos stats
        print("\n--- Querying /api/repos ---")
        try:
            r = client.get("http://localhost:8000/api/repos")
            print(f"Status: {r.status_code}")
            print(r.json())
        except Exception as e:
            print(f"Failed to query /api/repos: {e}")
            
        # Query health again (FAISS should be loaded now)
        print("\n--- Querying /api/health (After Ingest) ---")
        try:
            r = client.get("http://localhost:8000/api/health")
            print(f"Status: {r.status_code}")
            print(r.json())
        except Exception as e:
            print(f"Failed to query /api/health: {e}")
            
        # Docs for a function
        print("\n--- Generating Docs for 'get_db' ---")
        try:
            r = client.post("http://localhost:8000/api/docs/function", json={"function_name": "get_db"})
            print(f"Status: {r.status_code}")
            print(r.json())
        except Exception as e:
            print(f"Failed to query /api/docs/function: {e}")
            
        # Docs for a file
        print("\n--- Generating Docs for 'backend/app/database.py' ---")
        try:
            r = client.post("http://localhost:8000/api/docs/file", json={"file_path": "backend/app/database.py"})
            print(f"Status: {r.status_code}")
            print(r.json())
        except Exception as e:
            print(f"Failed to query /api/docs/file: {e}")
            
        # Git history
        print("\n--- Querying Git History for 'backend/app/database.py' ---")
        try:
            r = client.get("http://localhost:8000/api/history?file=backend/app/database.py&limit=5")
            print(f"Status: {r.status_code}")
            print(r.json())
        except Exception as e:
            print(f"Failed to query /api/history: {e}")
            
        # Code quality
        print("\n--- Querying Code Quality ---")
        try:
            r = client.get("http://localhost:8000/api/quality")
            print(f"Status: {r.status_code}")
            print(r.json())
        except Exception as e:
            print(f"Failed to query /api/quality: {e}")
            
        # Error handling test
        print("\n--- Error Handling Test: Docs for non-existing function ---")
        try:
            r = client.post("http://localhost:8000/api/docs/function", json={"function_name": "this_function_does_not_exist"})
            print(f"Status: {r.status_code}")
            print(r.json())
        except Exception as e:
            print(f"Failed to query non-existing function: {e}")

    finally:
        print("\nTerminating FastAPI server...")
        server_process.terminate()
        try:
            server_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server_process.kill()
        print("Server terminated successfully.")
        
        # Clean up log file
        try:
            if os.path.exists(log_file_path):
                os.remove(log_file_path)
        except Exception:
            pass
        
if __name__ == "__main__":
    main()
