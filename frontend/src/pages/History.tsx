// src/pages/History.tsx
import React, { useState, useEffect } from "react";
import { getHistory } from "../api/client";
import type { Commit, HistoryResponse } from "../api/client";
import { StatusBar } from "../components/StatusBar";

export const History: React.FC = () => {
  const [filePathInput, setFilePathInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<HistoryResponse | null>(null);

  // Popover state
  const [selectedCommit, setSelectedCommit] = useState<Commit | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number } | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filePathInput.trim()) return;

    setLoading(true);
    setError(null);
    setData(null);
    setSelectedCommit(null);
    try {
      const response = await getHistory(filePathInput.trim());
      setData(response);
    } catch (err: any) {
      setError(err.message || "Failed to load git history. Make sure the file exists and is ingested.");
    } finally {
      setLoading(false);
    }
  };

  const handleCommitClick = (e: React.MouseEvent, commit: Commit) => {
    e.stopPropagation();
    setSelectedCommit(commit);
    setPopoverPosition({
      x: e.clientX,
      y: e.clientY + 15, // offset slightly below cursor
    });
  };

  // Close popover when clicking anywhere else
  useEffect(() => {
    const handleOutsideClick = () => {
      setSelectedCommit(null);
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div style={styles.page}>
      <StatusBar />

      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Git History & Evolution</h2>
          <p style={styles.subtitle}>
            Enter a file path to inspect its commit logs over time, and see an LLM-synthesized summary of how it has evolved.
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSearch} style={styles.form}>
          <input
            type="text"
            placeholder="e.g. backend/app/main.py"
            value={filePathInput}
            onChange={(e) => setFilePathInput(e.target.value)}
            style={styles.input}
          />
          <button type="submit" style={styles.submitBtn} disabled={loading}>
            {loading ? "Fetching..." : "Fetch History"}
          </button>
        </form>

        {error && <div style={styles.errorAlert}>⚠️ {error}</div>}

        {loading && (
          <div style={styles.loadingContainer}>
            <div style={styles.spinner}></div>
            <div style={styles.loadingText}>Fetching commit logs and calling LLM for evolution analysis...</div>
          </div>
        )}

        {!loading && !data && !error && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📜</div>
            <div style={styles.emptyText}>
              Provide a repository file path above to render a chronological git commit timeline and evolution summary.
            </div>
          </div>
        )}

        {!loading && data && (
          <div style={styles.resultsArea}>
            {/* Evolution Summary Box */}
            <div style={styles.summaryCard}>
              <div style={styles.summaryIcon}>🤖</div>
              <div style={styles.summaryContent}>
                <h4 style={styles.summaryTitle}>LLM Evolution Summary</h4>
                <p style={styles.summaryText}>{data.evolution_summary}</p>
              </div>
            </div>

            {/* Timeline */}
            <div style={styles.timelineContainer}>
              <h3 style={styles.timelineHeader}>File Commits Timeline</h3>
              {data.commits.length === 0 ? (
                <div style={styles.noCommits}>No commits recorded for this file in database.</div>
              ) : (
                <div style={styles.timeline}>
                  <div style={styles.timelineLine} />

                  {data.commits.map((commit, index) => (
                    <div key={commit.hash} style={styles.timelineItem}>
                      {/* Left: Date */}
                      <div style={styles.timelineLeft}>{formatDate(commit.date)}</div>

                      {/* Middle: Dot */}
                      <div style={styles.timelineMiddle}>
                        <button
                          onClick={(e) => handleCommitClick(e, commit)}
                          style={{
                            ...styles.timelineDot,
                            backgroundColor: index === 0 ? "var(--accent)" : "var(--border)",
                          }}
                          title="Click to view details"
                        />
                      </div>

                      {/* Right: Message & Author */}
                      <div
                        onClick={(e) => handleCommitClick(e, commit)}
                        style={styles.timelineRight}
                      >
                        <div style={styles.commitMsg}>{commit.message}</div>
                        <div style={styles.commitMeta}>
                          <span style={styles.author}>{commit.author}</span>
                          <span style={styles.hash}>({commit.hash})</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Popover / Tooltip Overlay */}
      {selectedCommit && popoverPosition && (
        <div
          onClick={(e) => e.stopPropagation()} // Prevent closing
          style={{
            ...styles.popover,
            left: `${Math.min(popoverPosition.x, window.innerWidth - 320)}px`,
            top: `${popoverPosition.y}px`,
          }}
        >
          <div style={styles.popoverHeader}>
            <span style={styles.popoverHash}>Commit details ({selectedCommit.hash})</span>
            <button onClick={() => setSelectedCommit(null)} style={styles.popoverClose}>
              ✕
            </button>
          </div>
          <div style={styles.popoverBody}>
            <div style={styles.popoverAuthor}>
              <strong>Author:</strong> {selectedCommit.author}
            </div>
            <div style={styles.popoverDate}>
              <strong>Date:</strong> {new Date(selectedCommit.date).toLocaleString()}
            </div>
            <div style={styles.popoverMsgLabel}>Full Message:</div>
            <div style={styles.popoverMsgText}>{selectedCommit.message}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  page: {
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  container: {
    padding: "30px 24px",
    maxWidth: "900px",
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
  form: {
    display: "flex",
    gap: "10px",
    maxWidth: "500px",
  },
  input: {
    flexGrow: 1,
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    color: "var(--text-primary)",
    padding: "10px 12px",
    fontSize: "13px",
    outline: "none",
  },
  submitBtn: {
    backgroundColor: "var(--accent)",
    border: "none",
    borderRadius: "6px",
    color: "#fff",
    padding: "10px 18px",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  errorAlert: {
    backgroundColor: "rgba(248, 113, 113, 0.1)",
    border: "1px solid var(--danger)",
    color: "var(--danger)",
    padding: "12px 16px",
    borderRadius: "6px",
    fontSize: "13px",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "80px 0",
    gap: "12px",
  },
  spinner: {
    width: "30px",
    height: "30px",
    border: "3px solid var(--border)",
    borderTopColor: "var(--accent)",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  loadingText: {
    fontSize: "13px",
    color: "var(--text-secondary)",
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
  resultsArea: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  summaryCard: {
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "10px",
    padding: "20px",
    display: "flex",
    gap: "16px",
    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
  },
  summaryIcon: {
    fontSize: "28px",
  },
  summaryContent: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  summaryTitle: {
    margin: 0,
    fontSize: "15px",
    color: "var(--text-primary)",
    fontWeight: "bold",
  },
  summaryText: {
    margin: 0,
    fontSize: "14px",
    color: "var(--text-secondary)",
    lineHeight: "1.5",
  },
  timelineContainer: {
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "10px",
    padding: "24px 20px",
  },
  timelineHeader: {
    margin: "0 0 24px 0",
    fontSize: "16px",
    color: "var(--text-primary)",
  },
  noCommits: {
    fontSize: "14px",
    color: "var(--text-secondary)",
    fontStyle: "italic",
  },
  timeline: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  timelineLine: {
    position: "absolute",
    left: "125px",
    top: "10px",
    bottom: "10px",
    width: "2px",
    backgroundColor: "var(--border)",
  },
  timelineItem: {
    display: "flex",
    alignItems: "flex-start",
    position: "relative",
  },
  timelineLeft: {
    width: "110px",
    textAlign: "right",
    paddingRight: "16px",
    fontSize: "12px",
    color: "var(--text-secondary)",
    fontFamily: "monospace",
    paddingTop: "3px",
  },
  timelineMiddle: {
    width: "32px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
  },
  timelineDot: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    border: "2px solid var(--bg-secondary)",
    cursor: "pointer",
    padding: 0,
  },
  timelineRight: {
    flexGrow: 1,
    paddingLeft: "12px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  commitMsg: {
    fontSize: "13.5px",
    fontWeight: 500,
    color: "var(--text-primary)",
    wordBreak: "break-all",
    lineHeight: "1.4",
  },
  commitMeta: {
    display: "flex",
    gap: "8px",
    fontSize: "11px",
    color: "var(--text-secondary)",
  },
  author: {
    fontWeight: "bold",
  },
  hash: {
    fontFamily: "monospace",
  },
  popover: {
    position: "fixed",
    width: "300px",
    backgroundColor: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
    padding: "16px",
    zIndex: 9999,
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  popoverHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid var(--border)",
    paddingBottom: "8px",
  },
  popoverHash: {
    fontSize: "11px",
    fontWeight: "bold",
    color: "var(--text-secondary)",
    textTransform: "uppercase",
  },
  popoverClose: {
    background: "none",
    border: "none",
    color: "var(--text-secondary)",
    cursor: "pointer",
    fontSize: "14px",
  },
  popoverBody: {
    fontSize: "13px",
    color: "var(--text-primary)",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  popoverAuthor: {
    fontSize: "12px",
  },
  popoverDate: {
    fontSize: "12px",
  },
  popoverMsgLabel: {
    fontSize: "11px",
    fontWeight: "bold",
    color: "var(--text-secondary)",
    marginTop: "4px",
  },
  popoverMsgText: {
    fontSize: "12px",
    lineHeight: "1.4",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    maxHeight: "150px",
    overflowY: "auto",
    backgroundColor: "var(--bg-primary)",
    padding: "8px",
    borderRadius: "4px",
    border: "1px solid var(--border)",
  },
};
