# Codebase Memory

Small Python experiments for turning source code into searchable memory:

- `parser.py` parses `sample.py` with Tree-sitter and prints discovered functions and function calls.
- `graph_builder.py` builds a simple Neo4j graph of files, functions, and call relationships.
- `semantic_search.py` embeds function source with Sentence Transformers and stores a FAISS index for natural-language search.

## Project Layout

```text
.
├── graph_builder.py      # Parse code and load a call graph into Neo4j
├── parser.py             # Parse Python source and print functions/calls
├── sample.py             # Example Python file used by the scripts
├── semantic_search.py    # Build embeddings and search functions semantically
├── codebase.index        # Generated FAISS index
└── functions.json        # Generated function metadata
```

## Requirements

- Python 3.10+
- Neo4j running locally, only needed for `graph_builder.py`
- Python packages:
  - `tree-sitter`
  - `tree-sitter-python`
  - `neo4j`
  - `numpy`
  - `faiss-cpu`
  - `sentence-transformers`

## Setup

Create and activate a virtual environment:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

Install dependencies:

```powershell
pip install tree-sitter tree-sitter-python neo4j numpy faiss-cpu sentence-transformers
```

## Usage

Parse the sample file:

```powershell
python parser.py
```

Build and query a Neo4j call graph:

```powershell
python graph_builder.py
```

Before running `graph_builder.py`, start Neo4j locally on `bolt://localhost:7687` and update the password in the script if needed.

Build a semantic search index and run example searches:

```powershell
python semantic_search.py
```

The first semantic search run downloads the embedding model, then writes:

- `codebase.index`
- `functions.json`

These files can be regenerated from the source code.

## Notes

The scripts currently analyze `sample.py`. To analyze another file, update the `FILENAME` value or file path in the relevant script.
