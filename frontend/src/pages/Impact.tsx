// src/pages/Impact.tsx
import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getImpact, searchCode, getGraph } from "../api/client";
import type { ImpactResponse } from "../api/client";
import { CodeViewer } from "../components/CodeViewer";
import { StatusBar } from "../components/StatusBar";

export const Impact: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const functionParam = searchParams.get("function");

  const [functionInput, setFunctionInput] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImpactResponse | null>(null);

  // File resolver states
  const [resolvingFile, setResolvingFile] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedLine, setSelectedLine] = useState<number | undefined>(undefined);

  const analyzeFunction = async (name: string) => {
    if (!name.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await getImpact(name.trim());
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to analyze change impact.");
    } finally {
      setLoading(false);
    }
  };

  // Trigger analysis if parameter is provided in URL
  useEffect(() => {
    if (functionParam) {
      setFunctionInput(functionParam);
      analyzeFunction(functionParam);
    }
  }, [functionParam]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!functionInput.trim()) return;
    setSearchParams({ function: functionInput.trim() });
  };

  // Helper to parse risk level from LLM response text
  const getRiskLevel = (text: string) => {
    const lower = text.toLowerCase();
    if (lower.includes("high risk") || lower.includes("risk: high") || lower.includes("high blast radius")) {
      return "HIGH";
    }
    if (
      lower.includes("medium risk") ||
      lower.includes("risk: medium") ||
      lower.includes("moderate risk") ||
      lower.includes("risk: moderate")
    ) {
      return "MEDIUM";
    }
    if (lower.includes("low risk") || lower.includes("risk: low") || lower.includes("safe to modify")) {
      return "LOW";
    }

    // fallback to regex match
    const match = text.match(/\b(high|medium|moderate|low)\b/i);
    if (match) {
      const level = match[1].toUpperCase();
      return level === "MODERATE" ? "MEDIUM" : level;
    }
    return "MEDIUM"; // default
  };

  const handleFunctionClick = async (funcName: string) => {
    setResolvingFile(funcName);
    try {
      // 1. Try to find function in Postgres/Vector Index using searchCode
      const searchRes = await searchCode(funcName, 1);
      const found = searchRes.results.find(
        (r) => r.function_name.toLowerCase() === funcName.toLowerCase()
      );
      if (found) {
        setSelectedFile(found.file);
        setSelectedLine(found.start_line);
        return;
      }

      // 2. Try graph nodes as backup
      const graphRes = await getGraph(funcName);
      const node = graphRes.nodes.find((n) => n.name.toLowerCase() === funcName.toLowerCase());
      if (node) {
        setSelectedFile(node.file);
        setSelectedLine(1); // default line
        return;
      }

      // 3. Fallback search
      if (searchRes.results.length > 0) {
        setSelectedFile(searchRes.results[0].file);
        setSelectedLine(searchRes.results[0].start_line);
        return;
      }

      alert(`Could not locate source file for function "${funcName}" in current index.`);
    } catch (err) {
      console.error(err);
      alert(`Error locating source code for function: ${funcName}`);
    } finally {
      setResolvingFile(null);
    }
  };

  const riskLevel = result ? getRiskLevel(result.risk_analysis) : "MEDIUM";
  const riskBadgeStyles = {
    HIGH: { backgroundColor: "rgba(248, 113, 113, 0.2)", color: "var(--danger)", border: "1px solid var(--danger)" },
    MEDIUM: { backgroundColor: "rgba(251, 191, 36, 0.2)", color: "var(--warning)", border: "1px solid var(--warning)" },
    LOW: { backgroundColor: "rgba(74, 222, 128, 0.2)", color: "var(--success)", border: "1px solid var(--success)" },
  }[riskLevel];

  const affectedCount = result?.affected_functions?.length || 0;

  return (
    <div style={styles.page}>
      <StatusBar />

      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Change Impact Analysis</h2>
          <p style={styles.subtitle}>
            Enter a function name to analyze what calling code will be affected by changes, and view the generated LLM risk assessment.
          </p>
        </div>

        {/* Input form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="text"
            placeholder="e.g. analyze_impact"
            value={functionInput}
            onChange={(e) => setFunctionInput(e.target.value)}
            style={styles.input}
          />
          <button type="submit" style={styles.submitBtn} disabled={loading}>
            {loading ? "Analyzing..." : "Analyze Impact"}
          </button>
        </form>

        {error && <div style={styles.errorAlert}>⚠️ {error}</div>}

        {loading && (
          <div style={styles.loadingContainer}>
            <div style={styles.spinner}></div>
            <div style={styles.loadingText}>Running static dependency checks & querying LLM...</div>
          </div>
        )}

        {!loading && !result && !error && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>💥</div>
            <div style={styles.emptyText}>
              Provide a function name above to trace the callers tree, map the blast radius, and receive a change risk report.
            </div>
          </div>
        )}

        {!loading && result && (
          <div style={styles.resultsGrid}>
            {/* Risk Badge & Summary */}
            <div style={styles.topCard}>
              <div style={styles.badgeRow}>
                <span style={styles.badgeLabel}>Assessed Risk Level:</span>
                <span style={{ ...styles.riskBadge, ...riskBadgeStyles }}>{riskLevel}</span>
              </div>
              <div style={{ ...styles.badgeRow, marginTop: "12px" }}>
                <span style={styles.badgeLabel}>Safe to Modify:</span>
                <span
                  style={{
                    ...styles.safeBadge,
                    color: result.safe_to_modify ? "var(--success)" : "var(--warning)",
                  }}
                >
                  {result.safe_to_modify
                    ? "✓ Yes (No immediate callers detected)"
                    : "✗ Caution (Calling dependencies exist)"}
                </span>
              </div>
            </div>

            {/* High Blast Radius Warning Banner */}
            {affectedCount > 10 && (
              <div style={styles.warningBanner}>
                ⚠️ High blast radius — {affectedCount} functions affected. Consider breaking this change into smaller steps.
              </div>
            )}

            {/* Results Split Screen */}
            <div style={styles.splitLayout}>
              {/* Affected Functions List (Left) */}
              <div style={styles.leftPanel}>
                <div style={styles.panelTitle}>
                  Affected Functions ({affectedCount})
                </div>
                {affectedCount === 0 ? (
                  <div style={styles.noAffected}>No direct calling dependencies found in the Neo4j call graph.</div>
                ) : (
                  <div style={styles.functionsList}>
                    {result.affected_functions.map((fn, idx) => (
                      <div key={idx} style={styles.functionItem}>
                        <span style={styles.funcIcon}>⚡</span>
                        <span style={styles.funcName} title={fn}>
                          {fn}
                        </span>
                        <button
                          onClick={() => handleFunctionClick(fn)}
                          style={styles.viewBtn}
                          disabled={resolvingFile === fn}
                        >
                          {resolvingFile === fn ? "Locating..." : "View File"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* LLM Risk Report (Right) */}
              <div style={styles.rightPanel}>
                <div style={styles.panelTitle}>LLM Change Risk Assessment</div>
                <div style={styles.markdownWrapper}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.risk_analysis}</ReactMarkdown>
                </div>
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
    maxWidth: "1100px",
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
    padding: "60px 0",
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
  resultsGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  topCard: {
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
  },
  badgeRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  badgeLabel: {
    fontSize: "13px",
    color: "var(--text-secondary)",
    fontWeight: 500,
  },
  riskBadge: {
    fontSize: "11px",
    fontWeight: "bold",
    padding: "3px 10px",
    borderRadius: "12px",
    letterSpacing: "0.5px",
  },
  safeBadge: {
    fontSize: "13px",
    fontWeight: 600,
  },
  warningBanner: {
    backgroundColor: "rgba(248, 113, 113, 0.15)",
    border: "1px solid var(--danger)",
    color: "var(--danger)",
    padding: "12px 16px",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: 500,
  },
  splitLayout: {
    display: "grid",
    gridTemplateColumns: "350px 1fr",
    gap: "20px",
    alignItems: "stretch",
  },
  leftPanel: {
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  rightPanel: {
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  panelTitle: {
    fontSize: "15px",
    fontWeight: "bold",
    color: "var(--text-primary)",
    borderBottom: "1px solid var(--border)",
    paddingBottom: "10px",
  },
  noAffected: {
    fontSize: "13px",
    color: "var(--text-secondary)",
    fontStyle: "italic",
    lineHeight: "1.4",
  },
  functionsList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    overflowY: "auto",
    maxHeight: "400px",
  },
  functionItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    padding: "8px 12px",
  },
  funcIcon: {
    color: "var(--accent)",
  },
  funcName: {
    flexGrow: 1,
    fontSize: "13px",
    color: "var(--text-primary)",
    fontFamily: "monospace",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  viewBtn: {
    backgroundColor: "var(--bg-primary)",
    border: "1px solid var(--border)",
    color: "var(--text-secondary)",
    fontSize: "11px",
    padding: "4px 8px",
    borderRadius: "4px",
    cursor: "pointer",
    transition: "color 0.2s",
  },
  markdownWrapper: {
    fontSize: "14px",
    lineHeight: "1.6",
    color: "var(--text-primary)",
    overflowY: "auto",
    maxHeight: "500px",
    paddingRight: "10px",
  },
};
