import sys
import os

# Add current directory to path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_search_api():
    print("Testing GET /api/search with no query (should return 422 validation error)...")
    response = client.get("/api/search")
    assert response.status_code == 422, f"Expected 422, got {response.status_code}"
    print("Received expected 422 validation error.")

    print("\nTesting GET /api/search?q=test...")
    response = client.get("/api/search?q=test")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    data = response.json()
    assert "results" in data, "Response body should contain 'results' key"
    print("API Response:", data)
    print("\nSuccess! GET /api/search endpoint is registered and responsive.")

if __name__ == "__main__":
    test_search_api()
