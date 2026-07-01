import sys
import os

# Add the current directory to sys.path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_ask_api():
    print("Testing POST /api/ask...")
    payload = {"question": "where is database connection established?"}
    with TestClient(app) as client:
        response = client.post("/api/ask", json=payload)
    
    print("Status Code:", response.status_code)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    data = response.json()
    assert "answer" in data, "Response body should contain 'answer'"
    assert "sources" in data, "Response body should contain 'sources'"
    assert "graph_context" in data, "Response body should contain 'graph_context'"
    
    print("API Response keys:", list(data.keys()))
    print("Sources found count:", len(data["sources"]))
    print("Graph context count:", len(data["graph_context"]))
    print("\nSuccess! /api/ask endpoint is registered and responsive.")

if __name__ == "__main__":
    test_ask_api()
