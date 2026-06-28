import sys
import os
import numpy as np

# Add the current directory to sys.path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app.services.vector_store import build_index, search, INDEX_PATH, META_PATH

def clean_files():
    if os.path.exists(INDEX_PATH):
        os.remove(INDEX_PATH)
    if os.path.exists(META_PATH):
        os.remove(META_PATH)

def test_vector_store():
    print("1. Cleaning existing index files...")
    clean_files()
    
    print("\n2. Testing search on missing index (should handle gracefully)...")
    res = search("test query")
    assert res == [], f"Expected empty list, got {res}"
    print("Missing index handled gracefully.")
    
    print("\n3. Building index with dummy embeddings...")
    dummy_embeddings = np.random.randn(3, 768).astype(np.float32)
    # L2 normalize dummy embeddings
    norms = np.linalg.norm(dummy_embeddings, axis=1, keepdims=True)
    dummy_embeddings = dummy_embeddings / norms
    
    dummy_metadata = [
        {"function_id": 1, "name": "hello_world", "file": "hello.py", "line": 5},
        {"function_id": 2, "name": "add", "file": "calc.py", "line": 10},
        {"function_id": 3, "name": "sub", "file": "calc.py", "line": 15}
    ]
    
    build_index(dummy_embeddings, dummy_metadata)
    
    assert os.path.exists(INDEX_PATH), "faiss.index not written"
    assert os.path.exists(META_PATH), "faiss_meta.pkl not written"
    print("Files successfully saved to disk.")
    
    print("\n4. Testing search with existing index...")
    # Search for something
    results = search("hello", top_k=2)
    print("Search results:")
    for r in results:
        print(r)
        
    assert len(results) > 0, "No results returned"
    assert "score" in results[0], "Score missing from results"
    assert "file" in results[0], "File missing from results"
    
    print("\nSuccess! Vector store verified and working correctly.")
    
    # Keep files or clean? Let's leave them or clean them. Let's clean them to avoid issues for next step tests.
    clean_files()

if __name__ == "__main__":
    test_vector_store()
