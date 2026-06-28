import numpy as np
from sentence_transformers import SentenceTransformer

MODEL_NAME = "microsoft/codebert-base"

print(f"Loading SentenceTransformer model '{MODEL_NAME}' at module level...")
# Load once at module level. Default to CPU if CUDA is problematic, or let it choose.
try:
    # We can force CPU or let it auto-detect. To be safe against CUDA OOM, 
    # we default to CPU, or try auto-detect and fallback to CPU.
    import torch
    device = "cpu"  # Force CPU by default as requested/safest for CUDA OOM
    model = SentenceTransformer(MODEL_NAME, device=device)
except Exception as e:
    print(f"Error loading model: {e}. Retrying on CPU...")
    model = SentenceTransformer(MODEL_NAME, device="cpu")

print(f"Model '{MODEL_NAME}' loaded successfully.")

def embed_chunks(texts: list[str]) -> np.ndarray:
    """
    Encodes a list of text chunks into normalized embeddings using CodeBERT.
    Returns a numpy float32 array of shape (len(texts), 768).
    """
    if not texts:
        # CodeBERT embedding dimension is 768
        return np.empty((0, 768), dtype=np.float32)
        
    print(f"Embedding {len(texts)} chunks...")
    
    # encode handles batching, progress bar, numpy conversion and L2 normalization
    embeddings = model.encode(
        texts,
        batch_size=16,
        show_progress_bar=True,
        convert_to_numpy=True,
        normalize_embeddings=True
    )
    
    return embeddings.astype(np.float32)
