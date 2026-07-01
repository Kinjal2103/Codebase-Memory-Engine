import sys
import os

# Add the current directory to sys.path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
from app.main import app

def test_graph_api():
    print("Testing GET /api/graph/ingest_repository...")
    with TestClient(app) as client:
        response = client.get("/api/graph/ingest_repository")
        
    print("Status Code:", response.status_code)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    data = response.json()
    assert "nodes" in data, "Response body should contain 'nodes'"
    assert "edges" in data, "Response body should contain 'edges'"
    
    print("API Response keys:", list(data.keys()))
    print("Nodes count:", len(data["nodes"]))
    print("Edges count:", len(data["edges"]))
    if data["nodes"]:
        print("Example Node:", data["nodes"][0])
    if data["edges"]:
        print("Example Edge:", data["edges"][0])
        
    print("\nSuccess! GET /api/graph/:function_name endpoint is registered and responsive.")

if __name__ == "__main__":
    test_graph_api()
