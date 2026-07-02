// src/pages/Quality.tsx
import React, { useState, useEffect } from "react";
import { getQuality, searchCode } from "../api/client";
import type { QualityResponse } from "../api/client";
import { CodeViewer } from "../components/CodeViewer";
import { StatusBar } from "../components/StatusBar";

export const Quality: React.FC = () => {
  const [data, setData] = useState<QualityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expandable sections states
  const [deadExpanded, setDeadExpanded] = useState(true);
  const [circularExpanded, setCircularExpanded] = useState(true);
  const [coupledExpanded, setCoupledExpanded] = useState(true);

  // File viewer states
  const [resolvingFile, setResolvingFile] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedLine, setSelectedLine] = useState<number | undefined>(undefined);

  const fetchQuality = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getQuality();
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load code quality analysis.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuality();
  }, []);

  const calculateHealthScore = (response: QualityResponse) => {
    const deadCount = response.dead_code?.length || 0;
    const circCount = response.circular_deps?.length || 0;
    const coupleCount = response.high_coupling?.length || 0;

    const penalty = deadCount * 2 + circCount * 5 + coupleCount * 3;
    const score = 100 - penalty;
    return Math.max(0, Math.min(100, score));
  };

  const getScoreColor = (score: number) => {
    if (score > 80) return "var(--success)"; // Green
    if (score >= 50) return "var(--warning)"; // Amber
    return "var(--danger)"; // Red
  };

  const handleViewCode = async (funcName: string, filePath?: string) => {
    if (filePath) {
      setSelectedFile(filePath);
      // Try to find the start line via search
      setResolvingFile(funcName);
      try {
        const searchRes = await searchCode(funcName, 1);
        const found = searchRes.results.find(
          (r) => r.function_name.toLowerCase() === funcName.toLowerCase()
        );
        if (found) {
          setSelectedLine(found.start_line);
        } else {
          setSelectedLine(1);
        }
      } catch {
        setSelectedLine(1);
      } finally {
        setResolvingFile(null);
      }
      return;
    }

    // If no filePath provided, resolve dynamically
    setResolvingFile(funcName);
    try {
      const searchRes = await searchCode(funcName, 1);
      const found = searchRes.results.find(
        (r) => r.function_name.toLowerCase() === funcName.toLowerCase()
      );
      if (found) {
        setSelectedFile(found.file);
        setSelectedLine(found.start_line);
      } else {
        alert(`Could not locate function: ${funcName}`);
      }
    } catch (err) {
      console.error(err);
      alert(`Error locating function: ${funcName}`);
    } finally {
      setResolvingFile(null);
    }
  };

  const healthScore = data ? calculateHealthScore(data) : 100;
  const scoreColor = getScoreColor(healthScore);

  return (
    <div style={styles.page}>
      <StatusBar />

      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.titleRow}>
            <h2 style={styles.title}>Code Quality Scanner</h2>
            <button onClick={fetchQuality} style={styles.refreshBtn} disabled={loading}>
              🔄 {loading ? "Analyzing..." : "Run Scanner"}
            </button>
          </div>
          <p style={styles.subtitle}>
            Detect dead code, circular invocation chains, and highly coupled hotspots in the Neo4j call graph.
          </p>
        </div>

        {error && <div style={styles.errorAlert}>⚠️ {error}</div>}

        {loading && (
          <div style={styles.loadingContainer}>
            <div style={styles.spinner}></div>
            <div style={styles.loadingText}>Running call graph analysis algorithms...</div>
          </div>
        )}

        {!loading && data && (
          <div style={styles.dashboard}>
            {/* Health Score Card */}
            <div style={styles.scoreCard}>
              <div style={styles.scoreValueContainer}>
                <div style={{ ...styles.scoreCircle, borderColor: scoreColor }}>
                  <span style={{ ...styles.scoreNum, color: scoreColor }}>{healthScore}</span>
                  <span style={styles.scoreText}>Score</span>
                </div>
                <div style={styles.scoreDetails}>
                  <h3 style={styles.scoreTitle}>Base Health Score</h3>
                  <p style={styles.scoreDesc}>
                    Weighted penalty index of code smells: Dead code functions (-2), Circular cycles (-5), and High coupling hotspots (-3).
                  </p>
                </div>
              </div>
              <div style={styles.summaryBox}>
                <span style={styles.summaryLabel}>LLM Summary:</span>
                <p style={styles.summaryText}>"{data.summary || "No smells detected."}"</p>
              </div>
            </div>

            {/* SMELLS LISTING */}
            <div style={styles.groupsContainer}>
              {/* 1. Dead Code Section */}
              <div style={styles.groupCard}>
                <button
                  onClick={() => setDeadExpanded(!deadExpanded)}
                  style={styles.groupHeader}
                >
                  <div style={styles.groupHeaderLeft}>
                    <span style={styles.groupIcon}>🧹</span>
                    <span style={styles.groupName}>Dead Code</span>
                    <span style={styles.groupCountBadge}>
                      {data.dead_code?.length || 0} functions
                    </span>
                  </div>
                  <span style={styles.chevron}>{deadExpanded ? "▲" : "▼"}</span>
                </button>

                {deadExpanded && (
                  <div style={styles.groupBody}>
                    {(!data.dead_code || data.dead_code.length === 0) ? (
                      <div style={styles.noIssues}>✓ Clean! No dead functions detected.</div>
                    ) : (
                      <div style={styles.deadCodeList}>
                        {data.dead_code.map((item, idx) => (
                          <div key={idx} style={styles.itemRow}>
                            <div style={styles.itemDetails}>
                              <span style={styles.itemTitle}>{item.name}</span>
                              <span style={styles.itemPath}>📁 {item.file}</span>
                            </div>
                            <button
                              onClick={() => handleViewCode(item.name, item.file)}
                              style={styles.viewBtn}
                              disabled={resolvingFile === item.name}
                            >
                              {resolvingFile === item.name ? "Locating..." : "View"}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Circular Dependencies Section */}
              <div style={styles.groupCard}>
                <button
                  onClick={() => setCircularExpanded(!circularExpanded)}
                  style={styles.groupHeader}
                >
                  <div style={styles.groupHeaderLeft}>
                    <span style={styles.groupIcon}>🔄</span>
                    <span style={styles.groupName}>Circular Dependencies</span>
                    <span style={styles.groupCountBadge}>
                      {data.circular_deps?.length || 0} cycles
                    </span>
                  </div>
                  <span style={styles.chevron}>{circularExpanded ? "▲" : "▼"}</span>
                </button>

                {circularExpanded && (
                  <div style={styles.groupBody}>
                    {(!data.circular_deps || data.circular_deps.length === 0) ? (
                      <div style={styles.noIssues}>✓ Clean! No circular references detected.</div>
                    ) : (
                      <div style={styles.cyclesList}>
                        {data.circular_deps.map((item, idx) => (
                          <div key={idx} style={styles.cycleCard}>
                            <div style={styles.cycleLabel}>Smell Alert: Cycle #{idx + 1}</div>
                            <div style={styles.cycleChain}>
                              {item.cycle.map((node, i) => (
                                <React.Fragment key={i}>
                                  <button
                                    onClick={() => handleViewCode(node)}
                                    style={styles.cycleNodeBtn}
                                    title={`Click to view ${node}`}
                                  >
                                    {node}
                                  </button>
                                  {i < item.cycle.length - 1 && <span style={styles.chainArrow}>➔</span>}
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 3. Highly Coupled Functions Section */}
              <div style={styles.groupCard}>
                <button
                  onClick={() => setCoupledExpanded(!coupledExpanded)}
                  style={styles.groupHeader}
                >
                  <div style={styles.groupHeaderLeft}>
                    <span style={styles.groupIcon}>💥</span>
                    <span style={styles.groupName}>Highly Coupled Hotspots</span>
                    <span style={styles.groupCountBadge}>
                      {data.high_coupling?.length || 0} functions
                    </span>
                  </div>
                  <span style={styles.chevron}>{coupledExpanded ? "▲" : "▼"}</span>
                </button>

                {coupledExpanded && (
                  <div style={styles.groupBody}>
                    {(!data.high_coupling || data.high_coupling.length === 0) ? (
                      <div style={styles.noIssues}>✓ Clean! No high-coupling hotspots detected.</div>
                    ) : (
                      <div style={styles.coupledList}>
                        {data.high_coupling.map((item, idx) => {
                          const callPercentage = Math.min(100, (item.calls_count / 15) * 100);
                          return (
                            <div key={idx} style={styles.coupledRow}>
                              <div style={styles.coupledDetails}>
                                <div style={styles.coupledTitleRow}>
                                  <span style={styles.itemTitle}>{item.name}</span>
                                  <span style={styles.callsBadge}>{item.calls_count} calls</span>
                                </div>
                                <span style={styles.itemPath}>📁 {item.file}</span>
                                <div style={styles.coupledProgressBg}>
                                  <div
                                    style={{
                                      ...styles.coupledProgressFill,
                                      width: `${callPercentage}%`,
                                    }}
                                  />
                                </div>
                              </div>
                              <button
                                onClick={() => handleViewCode(item.name, item.file)}
                                style={styles.viewBtn}
                                disabled={resolvingFile === item.name}
                              >
                                {resolvingFile === item.name ? "Locating..." : "View"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
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
  page: {
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  container: {
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
  titleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    margin: 0,
    fontSize: "22px",
    fontWeight: "bold",
    color: "var(--text-primary)",
  },
  refreshBtn: {
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
    padding: "8px 16px",
    borderRadius: "6px",
    fontSize: "13px",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  subtitle: {
    margin: 0,
    fontSize: "14px",
    color: "var(--text-secondary)",
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
  dashboard: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  scoreCard: {
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "10px",
    padding: "20px",
    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  scoreValueContainer: {
    display: "flex",
    alignItems: "center",
    gap: "24px",
  },
  scoreCircle: {
    width: "80px",
    height: "80px",
    borderRadius: "50%",
    borderWidth: "5px",
    borderStyle: "solid",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreNum: {
    fontSize: "26px",
    fontWeight: "bold",
  },
  scoreText: {
    fontSize: "10px",
    color: "var(--text-secondary)",
    textTransform: "uppercase",
  },
  scoreDetails: {
    flexGrow: 1,
  },
  scoreTitle: {
    margin: "0 0 6px 0",
    fontSize: "16px",
    color: "var(--text-primary)",
  },
  scoreDesc: {
    margin: 0,
    fontSize: "13px",
    color: "var(--text-secondary)",
    lineHeight: "1.4",
  },
  summaryBox: {
    borderTop: "1px solid var(--border)",
    paddingTop: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  summaryLabel: {
    fontSize: "11px",
    color: "var(--text-secondary)",
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  summaryText: {
    margin: 0,
    fontSize: "13.5px",
    color: "var(--text-primary)",
    fontStyle: "italic",
  },
  groupsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  groupCard: {
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    overflow: "hidden",
  },
  groupHeader: {
    width: "100%",
    backgroundColor: "var(--bg-tertiary)",
    border: "none",
    padding: "14px 20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "pointer",
    outline: "none",
  },
  groupHeaderLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  groupIcon: {
    fontSize: "18px",
  },
  groupName: {
    fontSize: "15px",
    fontWeight: "bold",
    color: "var(--text-primary)",
  },
  groupCountBadge: {
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-secondary)",
    fontSize: "11px",
    padding: "2px 8px",
    borderRadius: "12px",
    border: "1px solid var(--border)",
    fontWeight: 500,
  },
  chevron: {
    fontSize: "10px",
    color: "var(--text-secondary)",
  },
  groupBody: {
    padding: "20px",
    borderTop: "1px solid var(--border)",
  },
  noIssues: {
    fontSize: "13px",
    color: "var(--success)",
    fontWeight: 500,
  },
  deadCodeList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    maxHeight: "300px",
    overflowY: "auto",
  },
  itemRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    padding: "8px 14px",
  },
  itemDetails: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    maxWidth: "80%",
  },
  itemTitle: {
    fontSize: "13px",
    fontWeight: "bold",
    color: "var(--text-primary)",
    fontFamily: "monospace",
  },
  itemPath: {
    fontSize: "11px",
    color: "var(--text-secondary)",
    fontFamily: "monospace",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  viewBtn: {
    backgroundColor: "var(--bg-primary)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
    fontSize: "12px",
    padding: "6px 12px",
    borderRadius: "4px",
    cursor: "pointer",
  },
  cyclesList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  cycleCard: {
    backgroundColor: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    padding: "14px",
  },
  cycleLabel: {
    fontSize: "11px",
    color: "var(--danger)",
    fontWeight: "bold",
    textTransform: "uppercase",
    marginBottom: "8px",
  },
  cycleChain: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "6px 8px",
  },
  cycleNodeBtn: {
    backgroundColor: "var(--bg-primary)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
    fontFamily: "monospace",
    fontSize: "12px",
    padding: "4px 8px",
    borderRadius: "4px",
    cursor: "pointer",
  },
  chainArrow: {
    fontSize: "12px",
    color: "var(--text-secondary)",
  },
  coupledList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    maxHeight: "350px",
    overflowY: "auto",
  },
  coupledRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    padding: "10px 14px",
  },
  coupledDetails: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    flexGrow: 1,
    marginRight: "20px",
  },
  coupledTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  callsBadge: {
    backgroundColor: "rgba(248, 113, 113, 0.15)",
    border: "1px solid var(--danger)",
    color: "var(--danger)",
    fontSize: "10px",
    fontWeight: "bold",
    padding: "1px 6px",
    borderRadius: "4px",
  },
  coupledProgressBg: {
    height: "4px",
    backgroundColor: "var(--bg-primary)",
    borderRadius: "2px",
    width: "100%",
    overflow: "hidden",
  },
  coupledProgressFill: {
    height: "100%",
    backgroundColor: "var(--danger)",
    borderRadius: "2px",
  },
};
