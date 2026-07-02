// src/pages/Search.tsx
import React, { useState, useEffect } from "react";
import { searchCode } from "../api/client";
import type { SearchResult } from "../api/client";
import { CodeViewer } from "../components/CodeViewer";
import { StatusBar } from "../components/StatusBar";

export const Search: React.FC = () => {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedLine, setSelectedLine] = useState<number | undefined>(undefined);

  // Debounce query change by 400ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  // Execute search when debounced query changes
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedQuery.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await searchCode(debouncedQuery);
        setResults(response.results || []);
      } catch (err: any) {
        setError(err.message || "Failed to search codebase");
      } finally {
        setLoading(false);
      }
    };

    performSearch();
  }, [debouncedQuery]);

  return (
    <div style={styles.searchPage}>
      <StatusBar />

      <div style={styles.searchContainer}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Semantic Code Search</h2>
          <p style={styles.subtitle}>Search your codebase in plain English using vector similarity matching.</p>
        </div>

        {/* Input Bar */}
        <div style={styles.inputWrapper}>
          <span style={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Type search terms... (e.g. 'database connection pool' or 'jwt error handling')"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={styles.searchInput}
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery("")} style={styles.clearBtn} title="Clear search">
              ✕
            </button>
          )}
        </div>

        {/* Error Alert */}
        {error && <div style={styles.errorAlert}>⚠️ {error}</div>}

        {/* Results Area */}
        <div style={styles.resultsArea}>
          {loading ? (
            // Skeleton Loader Cards
            <div style={styles.resultsGrid}>
              {[1, 2, 3, 4].map((n) => (
                <div key={n} style={{ ...styles.card, ...styles.skeletonCard }}>
                  <div style={styles.skeletonTitle}></div>
                  <div style={styles.skeletonSubtitle}></div>
                  <div style={styles.skeletonBar}></div>
                </div>
              ))}
            </div>
          ) : !debouncedQuery.trim() ? (
            // Empty State
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>🔍</div>
              <div style={styles.emptyText}>
                Search your codebase in plain English — try "error handling" or "database connection"
              </div>
            </div>
          ) : results.length === 0 ? (
            // No Results
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>❓</div>
              <div style={styles.emptyText}>No matching functions found for "{debouncedQuery}"</div>
            </div>
          ) : (
            // Results Grid
            <div style={styles.resultsGrid}>
              {results.map((res, i) => {
                const scorePercentage = Math.round(res.score * 100);
                // Color match based on score
                const barColor =
                  res.score > 0.8
                    ? "var(--success)"
                    : res.score > 0.5
                    ? "var(--warning)"
                    : "var(--accent)";

                return (
                  <div key={i} style={styles.card}>
                    <div style={styles.cardHeader}>
                      <span style={styles.funcName}>{res.function_name}</span>
                      <span style={{ ...styles.scoreBadge, color: barColor }}>
                        {scorePercentage}% match
                      </span>
                    </div>

                    <div style={styles.cardDetails}>
                      <span style={styles.filePath} title={res.file}>
                        📁 {res.file}
                      </span>
                      <span style={styles.lineTag}>Line {res.start_line}</span>
                    </div>

                    {/* Progress Bar Container */}
                    <div style={styles.progressContainer}>
                      <div
                        style={{
                          ...styles.progressBar,
                          width: `${scorePercentage}%`,
                          backgroundColor: barColor,
                        }}
                      />
                    </div>

                    <button
                      onClick={() => {
                        setSelectedFile(res.file);
                        setSelectedLine(res.start_line);
                      }}
                      style={styles.viewBtn}
                    >
                      View Code
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Monaco Code Viewer Modal */}
      {selectedFile && (
        <CodeViewer
          filePath={selectedFile}
          startLine={selectedLine}
          onClose={() => {
            setSelectedFile(null);
            setSelectedLine(undefined);
          }}
        />
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  searchPage: {
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  searchContainer: {
    padding: "30px 24px",
    maxWidth: "1000px",
    width: "100%",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  header: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  title: {
    margin: 0,
    fontSize: "22px",
    fontWeight: "bold",
    color: "var(--text-primary)",
  },
  subtitle: {
    margin: 0,
    fontSize: "14px",
    color: "var(--text-secondary)",
  },
  inputWrapper: {
    display: "flex",
    alignItems: "center",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    padding: "10px 16px",
    gap: "12px",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.2)",
  },
  searchIcon: {
    fontSize: "18px",
    color: "var(--text-secondary)",
  },
  searchInput: {
    flexGrow: 1,
    backgroundColor: "transparent",
    border: "none",
    color: "var(--text-primary)",
    fontSize: "15px",
    outline: "none",
  },
  clearBtn: {
    background: "none",
    border: "none",
    color: "var(--text-secondary)",
    cursor: "pointer",
    fontSize: "14px",
  },
  errorAlert: {
    backgroundColor: "rgba(248, 113, 113, 0.1)",
    border: "1px solid var(--danger)",
    color: "var(--danger)",
    padding: "12px 16px",
    borderRadius: "8px",
    fontSize: "14px",
  },
  resultsArea: {
    minHeight: "300px",
  },
  resultsGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  card: {
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    padding: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.15)",
    transition: "transform 0.2s, border-color 0.2s",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  funcName: {
    fontSize: "16px",
    fontWeight: "bold",
    color: "var(--text-primary)",
    fontFamily: "monospace",
  },
  scoreBadge: {
    fontSize: "12px",
    fontWeight: "bold",
  },
  cardDetails: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    fontSize: "13px",
  },
  filePath: {
    color: "var(--text-secondary)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "80%",
  },
  lineTag: {
    backgroundColor: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    color: "var(--text-secondary)",
    padding: "2px 6px",
    borderRadius: "4px",
    fontFamily: "monospace",
  },
  progressContainer: {
    height: "6px",
    width: "100%",
    backgroundColor: "var(--bg-tertiary)",
    borderRadius: "3px",
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: "3px",
    transition: "width 0.5s ease",
  },
  viewBtn: {
    alignSelf: "flex-end",
    backgroundColor: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    color: "var(--text-primary)",
    padding: "6px 12px",
    fontSize: "13px",
    cursor: "pointer",
    transition: "background-color 0.2s",
    marginTop: "4px",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "80px 24px",
    gap: "16px",
    textAlign: "center",
  },
  emptyIcon: {
    fontSize: "40px",
    opacity: 0.5,
  },
  emptyText: {
    fontSize: "14px",
    color: "var(--text-secondary)",
    maxWidth: "400px",
    lineHeight: "1.5",
  },
  skeletonCard: {
    pointerEvents: "none",
  },
  skeletonTitle: {
    height: "18px",
    width: "40%",
    backgroundColor: "var(--bg-tertiary)",
    borderRadius: "4px",
    animation: "pulse 1.5s infinite ease-in-out",
  },
  skeletonSubtitle: {
    height: "14px",
    width: "70%",
    backgroundColor: "var(--bg-tertiary)",
    borderRadius: "4px",
    animation: "pulse 1.5s infinite ease-in-out",
  },
  skeletonBar: {
    height: "6px",
    width: "100%",
    backgroundColor: "var(--bg-tertiary)",
    borderRadius: "3px",
    animation: "pulse 1.5s infinite ease-in-out",
  },
};

if (typeof document !== "undefined") {
  const styleEl = document.createElement("style");
  styleEl.innerHTML = `
    @keyframes pulse {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 0.3; }
    }
  `;
  document.head.appendChild(styleEl);
}
