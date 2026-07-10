// src/api/client.ts

// ==========================================
// TypeScript Interfaces & Types
// ==========================================

export interface SearchResult {
  function_name: string;
  file: string;
  start_line: number;
  score: number;
}

export interface GraphNode {
  id: string;
  name: string;
  file: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ImpactResponse {
  risk_analysis: string;
  affected_functions: string[];
  safe_to_modify: boolean;
}

export interface DeadCodeItem {
  name: string;
  file: string;
}

export interface CircularDepItem {
  cycle: string[];
}

export interface HighCouplingItem {
  name: string;
  file: string;
  calls_count: number;
}

export interface QualityResponse {
  dead_code: DeadCodeItem[];
  circular_deps: CircularDepItem[];
  high_coupling: HighCouplingItem[];
  summary: string;
}

export interface Commit {
  hash: string;
  author: string;
  date: string;
  message: string;
}

export interface HistoryResponse {
  file: string;
  commits: Commit[];
  evolution_summary: string;
}

export interface FunctionDocResponse {
  function_name: string;
  file: string;
  generated_doc: string;
}

export interface FileDocResponse {
  file_path: string;
  generated_doc: string;
}

export interface HealthResponse {
  status: string;
  postgres: string;
  neo4j: string;
  faiss_index: string;
  llm: string;
  timestamp: string;
}

export interface RepoItem {
  repo_path: string;
  file_count: number;
  function_count: number;
  last_ingested: string | null;
}

export interface IngestResult {
  method: "local" | "github" | "upload";
  files: number;
  functions: number;
  classes: number;
  commits: number;
  repo_name?: string;
  url?: string;
  path?: string;
  filename?: string;
}

// ==========================================
// API Client Constants & Helpers
// ==========================================

const BASE_URL = "http://localhost:8000/api";

/**
 * Helper to process JSON requests with error handling
 */
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      message = body.detail || body.error || message;
    } catch {
      try {
        const text = await response.text();
        if (text) message = text;
      } catch {}
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

/**
 * Helper to process plain text requests with error handling
 */
async function requestText(url: string, options?: RequestInit): Promise<string> {
  const response = await fetch(url, options);
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      message = body.detail || body.error || message;
    } catch {
      try {
        const text = await response.text();
        if (text) message = text;
      } catch {}
    }
    throw new Error(message);
  }
  return response.text();
}

// ==========================================
// API Endpoint Functions
// ==========================================

export async function ingestRepo(repoPath: string): Promise<any> {
  return request<any>(`${BASE_URL}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repo_path: repoPath }),
  });
}

export async function askQuestion(question: string): Promise<{ answer: string; sources: string[] }> {
  return request<{ answer: string; sources: string[] }>(`${BASE_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
}

export async function getImpact(functionName: string): Promise<ImpactResponse> {
  return request<ImpactResponse>(`${BASE_URL}/impact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ function_name: functionName }),
  });
}

export async function searchCode(query: string, topK?: number): Promise<{ results: SearchResult[] }> {
  const url = new URL(`${BASE_URL}/search`);
  url.searchParams.append("q", query);
  if (topK !== undefined) {
    url.searchParams.append("top_k", topK.toString());
  }
  return request<{ results: SearchResult[] }>(url.toString());
}

export async function getGraph(functionName: string): Promise<GraphResponse> {
  // graph_endpoint is registered under GET /api/graph/{function_name}
  return request<GraphResponse>(`${BASE_URL}/graph/${encodeURIComponent(functionName)}`);
}

export async function generateFunctionDoc(functionName: string): Promise<FunctionDocResponse> {
  return request<FunctionDocResponse>(`${BASE_URL}/docs/function`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ function_name: functionName }),
  });
}

export async function generateFileDoc(filePath: string): Promise<FileDocResponse> {
  return request<FileDocResponse>(`${BASE_URL}/docs/file`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_path: filePath }),
  });
}

export async function getHistory(filePath: string): Promise<HistoryResponse> {
  const url = new URL(`${BASE_URL}/history`);
  url.searchParams.append("file", filePath);
  return request<HistoryResponse>(url.toString());
}

export async function getQuality(): Promise<QualityResponse> {
  return request<QualityResponse>(`${BASE_URL}/quality`);
}

export async function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>(`${BASE_URL}/health`);
}

export async function getRepos(): Promise<RepoItem[]> {
  return request<RepoItem[]>(`${BASE_URL}/repos`);
}

export async function getFileContent(filePath: string): Promise<string> {
  const url = new URL(`${BASE_URL}/file`);
  url.searchParams.append("path", filePath);
  return requestText(url.toString());
}

export async function ingestLocal(repoPath: string): Promise<IngestResult> {
  const res = await fetch(`${BASE_URL}/ingest/local`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repo_path: repoPath })
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || "Ingestion failed")
  }
  return res.json()
}

export async function ingestGithub(githubUrl: string): Promise<IngestResult> {
  const res = await fetch(`${BASE_URL}/ingest/github`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ github_url: githubUrl })
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || "Clone failed")
  }
  return res.json()
}

export async function ingestUpload(file: File): Promise<IngestResult> {
  const form = new FormData()
  form.append("file", file)
  const res = await fetch(`${BASE_URL}/ingest/upload`, {
    method: "POST",
    body: form
    // NO Content-Type header — browser sets it automatically with boundary
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || "Upload failed")
  }
  return res.json()
}
