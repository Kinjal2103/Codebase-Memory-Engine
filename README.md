# 🧠 Codebase Memory Engine

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![Neo4j](https://img.shields.io/badge/Graph_Database-Neo4j-008CC1.svg?logo=neo4j&logoColor=white)](https://neo4j.com/)
[![FAISS](https://img.shields.io/badge/Vector_Store-FAISS-blue.svg)](https://github.com/facebookresearch/faiss)

An advanced AI-powered codebase indexing, visualization, and Retrieval-Augmented Generation (RAG) assistant. The **Codebase Memory Engine** ingests source repositories, parses their Abstract Syntax Trees (AST) using Tree-sitter, resolves calling relationships to construct a dependency graph in Neo4j, generates semantic embeddings of functions via CodeBERT, and exposes a React frontend for semantic search, interactive graph exploration, code quality analysis, change-impact analysis, and RAG-based AI chat.

---

## 🛠️ Key Features

* **⚡ Repository Ingestion & AST Parsing**: Index local or remote Git repositories. Automatically walks files, parses them with Tree-sitter (supporting Python & JavaScript), and extracts files, functions, classes, and calling relationships.
* **🔍 Semantic Code Search**: Embeds function/code block source code using CodeBERT (`microsoft/codebert-base`) via Sentence Transformers and indexes them into a high-performance FAISS vector store for semantic, natural-language query retrieval.
* **🕸️ Interactive Call Graph Visualization**: Automatically maps function call hierarchies, file hierarchies, and structural dependencies in a Neo4j graph database. Includes an interactive visualizer built with Cytoscape.js.
* **📈 Impact Analysis**: Trace dependencies recursively to identify what other parts of the codebase will be impacted if a given function or file is modified.
* **🩺 Code Quality & Smell Detection**: Computes metrics like lines of code (LOC), function complexity, and automatically tags code smells or excessive nesting.
* **💬 AI RAG Chat**: Chat directly with your codebase memory. The engine queries the vector store (for semantic context) and the Neo4j database (for call hierarchy context), supplying this data to Google Gemini to explain logic, debug issues, or write code.

---

## 📐 System Architecture

The following diagram illustrates how the frontend, backend, databases, and LLM services interact during repository ingestion and query execution:

```mermaid
flowchart TB
    subgraph Frontend [React + TS Client]
        UI[Cytoscape Call Graph UI]
        Chat[RAG Chat Interface]
        Search[Semantic Search Panel]
        Quality[Impact & Quality Dashboard]
    end

    subgraph Backend [FastAPI Server]
        API[FastAPI Router]
        Ingest[Ingestion & AST Engine]
        Embed[CodeBERT Embedder]
        RAG[RAG & Query Engine]
    end

    subgraph Databases [Data & Graph Layer]
        PG[(PostgreSQL - Meta & Repos)]
        Neo[(Neo4j - Call Graphs)]
        FAISS[(FAISS Index - Vector Storage)]
    end

    subgraph LLM [AI Layer]
        Gemini[Google Gemini API]
    end

    %% Ingestion Flow
    UI -- "1. Ingest Repo Request" --> API
    API --> Ingest
    Ingest -- "Extract File Metadata" --> PG
    Ingest -- "Build Call Hierarchies" --> Neo
    Ingest -- "Generates Code Snippets" --> Embed
    Embed -- "Saves Vector Index" --> FAISS

    %% Chat & RAG Flow
    Chat -- "2. Ask Question" --> API
    API --> RAG
    RAG -- "3a. Semantic Search" --> FAISS
    RAG -- "3b. Lookup Call Context" --> Neo
    RAG -- "4. Sends Augmentation Context" --> Gemini
    Gemini -- "5. Return Answer" --> RAG
    RAG --> Chat
```

---

## 📂 Project Structure

```text
.
├── backend/                   # FastAPI Backend
│   ├── app/
│   │   ├── api/               # API Router endpoints (ingest, search, ask, graph, etc.)
│   │   ├── services/          # Services (AST parser, embedder, rag_engine, vector_store)
│   │   ├── models/            # SQLAlchemy database models
│   │   ├── config.py          # Environment configs
│   │   └── main.py            # Backend entrypoint and startup lifecycle
│   ├── data/                  # Local directory for saving FAISS indexes and metadata
│   ├── requirements.txt       # Backend base dependencies
│   └── .env                   # Configuration file (Postgres, Neo4j, Gemini API)
│
├── frontend/                  # React Frontend
│   ├── src/
│   │   ├── components/        # Reusable UI components (Sidebar, Code Viewer, etc.)
│   │   ├── pages/             # App pages (Chat, Search, Graph, Quality, Impact, Ingest)
│   │   └── main.tsx           # React entry point
│   ├── index.html             # Document index file
│   └── package.json           # Frontend dependencies
│
├── docker-compose.yml         # Container configuration for PostgreSQL and Neo4j
├── graph_builder.py           # Legacy/Standalone call graph script
├── parser.py                  # Standalone Tree-sitter AST parser script
└── semantic_search.py         # Standalone FAISS semantic search script
```

---

## 🚀 Getting Started

### Prerequisites

* [Docker](https://www.docker.com/) and Docker Compose installed.
* [Python 3.10+](https://www.python.org/downloads/) installed.
* [Node.js 18+](https://nodejs.org/) installed.
* A [Google Gemini API Key](https://aistudio.google.com/).

---

### Step 1: Start the Databases

Run the following command to spin up PostgreSQL and Neo4j database containers in the background:

```bash
docker-compose up -d
```

* **PostgreSQL** runs on port `5432` (database: `codebase_memory`).
* **Neo4j** Bolt runs on port `7687` and HTTP Browser dashboard runs on `7474`.

---

### Step 2: Set up the Backend

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment and activate it:
   * **Windows (PowerShell):**
     ```powershell
     python -m venv venv
     .\venv\Scripts\Activate.ps1
     ```
   * **macOS / Linux:**
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. Install the dependencies:
   ```bash
   pip install -r requirements.txt numpy faiss-cpu sentence-transformers torch
   ```

4. Create a `.env` file in the `backend/` directory with the following contents:
   ```env
   # PostgreSQL Configuration (Asyncpg driver)
   DATABASE_URL=postgresql+asyncpg://postgres:password123@localhost:5432/codebase_memory

   # Neo4j Configuration
   NEO4J_URI=bolt://localhost:7687
   NEO4J_USER=neo4j
   NEO4J_PASSWORD=password123

   # LLM Configuration
   LLM_PROVIDER=gemini
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

5. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   The backend API will be available at [http://localhost:8000](http://localhost:8000) and Swagger API docs at [http://localhost:8000/docs](http://localhost:8000/docs).

---

### Step 3: Set up the Frontend

1. Navigate to the `frontend` directory:
   ```bash
   cd ../frontend
   ```

2. Install the node packages:
   ```bash
   npm install
   ```

3. Start the Vite React development server:
   ```bash
   npm run dev
   ```
   The application UI will be accessible at [http://localhost:5173](http://localhost:5173).

---

## 💡 Usage Guide

### 📥 1. Ingestion
1. Open the UI at [http://localhost:5173](http://localhost:5173) and navigate to **Ingest**.
2. Provide the absolute directory path of any codebase repository you want to index.
3. Click **Ingest Repository**. The system will scan, parse, generate vector embeddings, and construct call relationships.

### 🔍 2. Semantic Search
1. Navigate to **Search**.
2. Type a natural-language description of what you are looking for (e.g., `"Where is the database connection initialized?"` or `"function that verifies auth token"`).
3. Review matching code snippets with highlighted source code and similarity scores.

### 🕸️ 3. Interactive Call Graph
1. Navigate to **Call Graph**.
2. Select an ingested repository.
3. Explore the visual representation of files, functions, and their calls (caller-callee arrows). Double-click nodes to expand details or inspect parameters.

### 🩺 4. Code Quality & Smells
1. Navigate to **Code Quality**.
2. Check metrics such as average lines of code, code complexity markers, and code smells like deeply nested structures or bloated functions.

### 💬 5. RAG Assistant Chat
1. Navigate to **Chat**.
2. Ask questions about the codebase (e.g., `"Explain how impact analysis is calculated in the backend, and write a Python unit test for it."`).
3. The AI agent will leverage the combination of PostgreSQL (meta tracking), Neo4j (graph relations), and FAISS (semantically retrieved snippets) to generate context-aware explanations and refactorings.

---

## 🛠️ Technology Stack

### Backend
* **FastAPI**: High performance, asynchronous web framework.
* **SQLAlchemy & Asyncpg**: Async database access to PostgreSQL.
* **Neo4j Driver**: Graph queries and relationship loading.
* **Tree-sitter & Tree-sitter languages**: Robust AST parsing of source files.
* **Sentence-Transformers**: Runs the `CodeBERT` model for semantic embeddings.
* **FAISS (Facebook AI Similarity Search)**: Native, local vector store for fast L2/IP search.
* **GitPython**: Git workspace utility.

### Frontend
* **React + Vite**: Fast, modern frontend build tool and component system.
* **TypeScript**: Type-safe development.
* **Cytoscape.js**: Graph layout and navigation visualization.
* **React Router**: Frontend routing.
* **Vanilla CSS**: Flexible, custom-themed styling with dark mode elements.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
