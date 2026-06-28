import os
import pickle
import faiss
import numpy as np
from app.services.embedder import embed_chunks

current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(os.path.dirname(current_dir))
DATA_DIR = os.path.join(backend_dir, "data")
INDEX_PATH = os.path.join(DATA_DIR, "faiss.index")
META_PATH = os.path.join(DATA_DIR, "faiss_meta.pkl")

def build_index(embeddings: np.ndarray, metadata: list[dict]):
    """
    Builds a FAISS IndexFlatIP index, adds the embeddings, and saves the index
    and metadata to disk.
    """
    if len(embeddings) == 0:
        print("No embeddings to index.")
        return
        
    os.makedirs(DATA_DIR, exist_ok=True)
    
    # Initialize IndexFlatIP
    dimension = embeddings.shape[1]
    index = faiss.IndexFlatIP(dimension)
    
    # Add embeddings to the index (expects float32)
    index.add(embeddings.astype(np.float32))
    
    # Save the index to disk
    faiss.write_index(index, INDEX_PATH)
    
    # Save metadata to disk
    with open(META_PATH, "wb") as f:
        pickle.dump(metadata, f)
        
    print(f"FAISS index successfully built with {index.ntotal} vectors and saved to {INDEX_PATH}")

def search(query_text: str, top_k: int = 8) -> list[dict]:
    """
    Loads FAISS index and metadata, embeds query_text, performs similarity
    search, and returns the top-K metadata dicts with similarity scores.
    """
    if not os.path.exists(INDEX_PATH) or not os.path.exists(META_PATH):
        print(f"Warning: FAISS index or metadata file not found at {INDEX_PATH} or {META_PATH}. Return empty results.")
        return []
        
    try:
        # Load index and metadata
        index = faiss.read_index(INDEX_PATH)
        with open(META_PATH, "rb") as f:
            metadata = pickle.load(f)
    except Exception as e:
        print(f"Error loading index or metadata: {e}. Please rebuild the index.")
        return []
        
    # Embed query
    query_vectors = embed_chunks([query_text])
    if query_vectors.shape[0] == 0:
        return []
        
    # Search index
    k = min(top_k, index.ntotal)
    if k == 0:
        return []
        
    distances, indices = index.search(query_vectors, k)
    
    # Format results
    results = []
    for score, idx in zip(distances[0], indices[0]):
        if idx < 0 or idx >= len(metadata):
            continue
            
        meta = metadata[idx].copy()
        meta["score"] = float(score)
        results.append(meta)
        
    return results
