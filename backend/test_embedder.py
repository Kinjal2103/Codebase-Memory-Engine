import sys
import os
import numpy as np

# Add the current directory to sys.path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app.services.embedder import embed_chunks

def test_embed():
    test_texts = [
        "def hello_world():\n    print('Hello World')",
        "def add(a, b):\n    return a + b",
        "class A:\n    pass"
    ]
    
    print("Testing embed_chunks...")
    embeddings = embed_chunks(test_texts)
    
    print("\nResult properties:")
    print("Embeddings type:", type(embeddings))
    print("Embeddings shape:", embeddings.shape)
    print("Embeddings dtype:", embeddings.dtype)
    
    # Verify shape
    assert embeddings.shape == (3, 768), f"Expected shape (3, 768), got {embeddings.shape}"
    assert embeddings.dtype == np.float32, f"Expected dtype float32, got {embeddings.dtype}"
    
    # Verify L2 normalization: each row's norm should be close to 1.0
    norms = np.linalg.norm(embeddings, axis=1)
    print("Vector norms (should be very close to 1.0):", norms)
    for i, norm in enumerate(norms):
        assert np.isclose(norm, 1.0, atoll=1e-5), f"Vector {i} is not normalized (norm={norm})"
        
    print("\nSuccess! Embedder verified and working correctly.")

if __name__ == "__main__":
    test_embed()
