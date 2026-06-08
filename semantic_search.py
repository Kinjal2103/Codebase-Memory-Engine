# semantic_search.py — turns functions into embeddings and enables semantic search

import numpy as np
import faiss
import json
from sentence_transformers import SentenceTransformer
import tree_sitter_python as tspython
from tree_sitter import Language, Parser

# ── 1. Parse the file (same as before) ─────────────────────────────
PY_LANGUAGE = Language(tspython.language())
parser = Parser(PY_LANGUAGE)

FILENAME = "sample.py"
with open(FILENAME, "rb") as f:
    source_code = f.read()

tree = parser.parse(source_code)

# Extract functions WITH their full source code this time
# (not just names — the full code gives better embeddings)
functions = []
current_function = [None]

def walk(node):
    if node.type == "function_definition":
        name_node = node.child_by_field_name("name")
        if name_node:
            func_name = source_code[name_node.start_byte:name_node.end_byte].decode()
            # Get the FULL source code of this function
            func_code = source_code[node.start_byte:node.end_byte].decode()
            line = node.start_point[0] + 1

            functions.append({
                "name": func_name,
                "code": func_code,
                "line": line,
                "file": FILENAME
            })

    for child in node.children:
        walk(child)

walk(tree.root_node)
print(f"Found {len(functions)} functions to embed\n")

# ── 2. Load the embedding model ─────────────────────────────────────
# This downloads a small model (~90MB) the first time, then caches it
# It converts any text into a list of 384 numbers
print("Loading embedding model... (first run downloads ~90MB)")
model = SentenceTransformer("all-MiniLM-L6-v2")
print("Model ready!\n")

# ── 3. Create embeddings for every function ─────────────────────────
# We embed the function NAME + its CODE together
# This gives the model more context to understand what the function does
texts_to_embed = []
for func in functions:
    # Combine name and code into one string for embedding
    combined = f"function {func['name']}:\n{func['code']}"
    texts_to_embed.append(combined)
    print(f"  Preparing embedding for: {func['name']}")

print("\nGenerating embeddings...")
embeddings = model.encode(texts_to_embed)
# embeddings is now a 2D array: shape = (num_functions, 384)
# each row is one function's embedding
print(f"Embeddings shape: {embeddings.shape}")
# e.g. (4, 384) means 4 functions, each with 384 numbers

# ── 4. Build the FAISS index ────────────────────────────────────────
# FAISS needs float32 numbers specifically
embeddings = np.array(embeddings).astype("float32")

# IndexFlatL2 = "flat index using L2 distance"
# L2 distance = straight-line distance between two points in number-space
# The closer two embeddings are, the more similar the functions are
dimension = embeddings.shape[1]   # 384
index = faiss.IndexFlatL2(dimension)

# Add all our function embeddings to the index
index.add(embeddings)
print(f"Added {index.ntotal} embeddings to FAISS index\n")

# ── 5. Save everything to disk ──────────────────────────────────────
# So we don't have to re-parse and re-embed every time we search
faiss.write_index(index, "codebase.index")

# Save the function metadata (name, file, line) separately
with open("functions.json", "w") as f:
    json.dump(functions, f, indent=2)

print("Saved index to codebase.index")
print("Saved function data to functions.json\n")

# ── 6. Search! ──────────────────────────────────────────────────────
def search(query, top_k=3):
    """
    Given a plain English query, find the most relevant functions.
    top_k = how many results to return
    """
    print(f"Searching for: '{query}'")
    print("-" * 40)

    # Convert the query into an embedding (same model, same number-space)
    query_embedding = model.encode([query])
    query_embedding = np.array(query_embedding).astype("float32")

    # Ask FAISS: "find the top_k closest embeddings to this query"
    distances, indices = index.search(query_embedding, top_k)
    # distances = how far away each result is (lower = more similar)
    # indices   = which function in our list matched

    results = []
    for i, idx in enumerate(indices[0]):
        func = functions[idx]
        distance = distances[0][i]
        # Convert distance to a similarity score (0 to 100, higher = better)
        similarity = round(max(0, 100 - distance * 20), 1)
        results.append({
            "name": func["name"],
            "file": func["file"],
            "line": func["line"],
            "similarity": similarity,
            "code": func["code"]
        })
        print(f"  {i+1}. {func['name']}()  "
              f"[similarity: {similarity}%]  "
              f"— line {func['line']} in {func['file']}")

    print()
    return results

# Try some searches
search("mathematical calculation")
search("run or execute something")
search("add numbers together")