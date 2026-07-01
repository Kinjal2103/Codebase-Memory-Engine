import sys
import os

# Add the current directory to sys.path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
from app.main import app

def test_impact_api():
    print("Testing POST /api/impact...")
    payload = {"function_name": "ingest_repository"}
    with TestClient(app) as client:
        response = client.post("/api/impact", json=payload)
        
    print("Status Code:", response.status_code)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    data = response.json()
    assert "risk_analysis" in data, "Response body should contain 'risk_analysis'"
    assert "affected_functions" in data, "Response body should contain 'affected_functions'"
    assert "safe_to_modify" in data, "Response body should contain 'safe_to_modify'"
    
    print("API Response keys:", list(data.keys()))
    print("Affected functions (callers):", data["affected_functions"])
    print("Safe to modify:", data["safe_to_modify"])
    print("\nSuccess! /api/impact endpoint is registered and responsive.")

if __name__ == "__main__":
    test_impact_api()
