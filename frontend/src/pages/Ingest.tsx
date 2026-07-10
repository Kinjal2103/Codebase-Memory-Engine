import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useRepo } from "../components/Layout";
import { ingestLocal, ingestGithub, ingestUpload } from "../api/client";
import type { IngestResult } from "../api/client";

export const Ingest: React.FC = () => {
  const navigate = useNavigate();
  const { refreshRepos, setSelectedRepo } = useRepo();

  // Active tab state
  const [activeTab, setActiveTab] = useState<"local" | "github" | "zip">("local");

  // Input states
  const [localPath, setLocalPath] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Validation/Error states
  const [githubError, setGithubError] = useState<string | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);

  // Ingestion states
  const [loading, setLoading] = useState(false);
  const [successResult, setSuccessResult] = useState<IngestResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  
  // Rotating status message timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<number | null>(null);

  // File input ref for Zip Upload click
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop states
  const [dragOver, setDragOver] = useState(false);

  // Reset function
  const handleReset = () => {
    setSuccessResult(null);
    setApiError(null);
    setElapsedSeconds(0);
    setGithubError(null);
    setZipError(null);
  };

  // Start timer when loading
  useEffect(() => {
    if (loading) {
      setElapsedSeconds(0);
      timerRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [loading]);

  // Determine current status message
  const getStatusMessage = () => {
    if (elapsedSeconds < 2) return "Resolving repository...";
    if (elapsedSeconds < 10) return "Parsing source files...";
    if (elapsedSeconds < 20) return "Building knowledge graph...";
    if (elapsedSeconds < 40) return "Generating embeddings...";
    return "Almost done...";
  };

  // Submissions
  const handleIngestLocal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localPath.trim()) return;

    setLoading(true);
    setApiError(null);
    setSuccessResult(null);

    try {
      const res = await ingestLocal(localPath.trim());
      setSuccessResult(res);
      await refreshRepos();
      setSelectedRepo(localPath.trim());
    } catch (err: any) {
      setApiError(err.message || "Ingestion failed");
    } finally {
      setLoading(false);
    }
  };

  const handleIngestGithub = async (e: React.FormEvent) => {
    e.preventDefault();
    setGithubError(null);

    const trimmedUrl = githubUrl.trim();
    if (!trimmedUrl.startsWith("https://github.com/")) {
      setGithubError("GitHub repository URL must start with 'https://github.com/'");
      return;
    }

    setLoading(true);
    setApiError(null);
    setSuccessResult(null);

    try {
      const res = await ingestGithub(trimmedUrl);
      setSuccessResult(res);
      await refreshRepos();
      setSelectedRepo(trimmedUrl);
    } catch (err: any) {
      setApiError(err.message || "GitHub clone or ingestion failed");
    } finally {
      setLoading(false);
    }
  };

  const handleIngestZip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setLoading(true);
    setApiError(null);
    setSuccessResult(null);

    try {
      const res = await ingestUpload(selectedFile);
      setSuccessResult(res);
      await refreshRepos();
      setSelectedRepo(selectedFile.name);
    } catch (err: any) {
      setApiError(err.message || "Zip upload or ingestion failed");
    } finally {
      setLoading(false);
    }
  };

  // Drag and Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    setZipError(null);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (!file.name.toLowerCase().endsWith(".zip")) {
        setZipError("Only .zip files are supported.");
        setSelectedFile(null);
      } else {
        setSelectedFile(file);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setZipError(null);
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (!file.name.toLowerCase().endsWith(".zip")) {
        setZipError("Only .zip files are supported.");
        setSelectedFile(null);
      } else {
        setSelectedFile(file);
      }
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Repository Ingestion</h2>
        <p style={styles.subtitle}>
          Select a method below to parse, analyze, and index a codebase.
        </p>

        {/* Tab switcher */}
        <div style={styles.tabsContainer}>
          <button
            style={{
              ...styles.tabButton,
              ...(activeTab === "local" ? styles.tabButtonActive : {}),
            }}
            onClick={() => {
              setActiveTab("local");
              handleReset();
            }}
            disabled={loading}
          >
            💻 Local Path
          </button>
          <button
            style={{
              ...styles.tabButton,
              ...(activeTab === "github" ? styles.tabButtonActive : {}),
            }}
            onClick={() => {
              setActiveTab("github");
              handleReset();
            }}
            disabled={loading}
          >
            🐙 GitHub URL
          </button>
          <button
            style={{
              ...styles.tabButton,
              ...(activeTab === "zip" ? styles.tabButtonActive : {}),
            }}
            onClick={() => {
              setActiveTab("zip");
              handleReset();
            }}
            disabled={loading}
          >
            📦 ZIP Upload
          </button>
        </div>

        {/* Forms for each tab */}
        <div style={styles.tabContent}>
          {activeTab === "local" && (
            <form onSubmit={handleIngestLocal} style={styles.form}>
              <div style={styles.field}>
                <label style={styles.label}>Absolute path to repo on this machine</label>
                <input
                  type="text"
                  placeholder="/home/yourname/projects/myrepo"
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                  style={styles.input}
                  required
                  disabled={loading}
                />
                <span style={styles.helperText}>
                  Only works when running the app on your own computer.
                </span>
              </div>
              <button
                type="submit"
                style={{
                  ...styles.submitBtn,
                  ...(loading ? styles.submitBtnDisabled : {}),
                }}
                disabled={loading}
              >
                {loading ? "Ingesting..." : "Ingest repo"}
              </button>
            </form>
          )}

          {activeTab === "github" && (
            <form onSubmit={handleIngestGithub} style={styles.form}>
              <div style={styles.field}>
                <label style={styles.label}>GitHub repository URL</label>
                <input
                  type="text"
                  placeholder="https://github.com/username/repository"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  style={styles.input}
                  required
                  disabled={loading}
                />
                {githubError && <span style={styles.errorTextInline}>{githubError}</span>}
                <span style={styles.helperText}>
                  Repository must be public. Large repos may take 1-2 minutes to clone.
                </span>
              </div>
              <button
                type="submit"
                style={{
                  ...styles.submitBtn,
                  ...(loading ? styles.submitBtnDisabled : {}),
                }}
                disabled={loading}
              >
                {loading ? "Cloning..." : "Clone and ingest"}
              </button>
            </form>
          )}

          {activeTab === "zip" && (
            <form onSubmit={handleIngestZip} style={styles.form}>
              <div style={styles.field}>
                <label style={styles.label}>Upload a zipped repository</label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    ...styles.dropZone,
                    ...(dragOver ? styles.dropZoneActive : {}),
                  }}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".zip"
                    style={{ display: "none" }}
                    disabled={loading}
                  />
                  <div style={styles.dropZoneIcon}>📤</div>
                  <div style={styles.dropZoneText}>
                    Drag your repo ZIP here or <span style={styles.browseLink}>click to browse</span>
                  </div>
                </div>

                {zipError && <span style={styles.errorTextInline}>{zipError}</span>}

                {selectedFile && (
                  <div style={styles.fileDetails}>
                    <span style={styles.fileIcon}>📄</span>
                    <div style={styles.fileMeta}>
                      <div style={styles.fileName}>{selectedFile.name}</div>
                      <div style={styles.fileSize}>{formatBytes(selectedFile.size)}</div>
                    </div>
                  </div>
                )}
              </div>
              <button
                type="submit"
                style={{
                  ...styles.submitBtn,
                  ...(!selectedFile || loading ? styles.submitBtnDisabled : {}),
                }}
                disabled={!selectedFile || loading}
              >
                {loading ? "Uploading..." : "Upload and ingest"}
              </button>
            </form>
          )}
        </div>

        {/* LOADING STATE */}
        {loading && (
          <div style={styles.loadingContainer}>
            <div style={styles.spinner} />
            <div style={styles.rotatingMsg}>{getStatusMessage()}</div>
            <div style={styles.elapsedTime}>Elapsed: {elapsedSeconds}s</div>
          </div>
        )}

        {/* SUCCESS STATE */}
        {successResult && (
          <div style={styles.successContainer}>
            <div style={styles.successHeader}>
              <span style={styles.successIcon}>✓</span>
              <div style={styles.successTitle}>Repo ingested successfully</div>
            </div>
            
            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <div style={styles.statVal}>{successResult.files}</div>
                <div style={styles.statLabel}>Files Parsed</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statVal}>{successResult.functions}</div>
                <div style={styles.statLabel}>Functions Found</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statVal}>{successResult.classes}</div>
                <div style={styles.statLabel}>Classes Found</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statVal}>{successResult.commits}</div>
                <div style={styles.statLabel}>Commits Indexed</div>
              </div>
            </div>

            <button onClick={() => navigate("/")} style={styles.exploreBtn}>
              Start exploring →
            </button>
          </div>
        )}

        {/* ERROR STATE */}
        {apiError && (
          <div style={styles.errorContainer}>
            <div style={styles.errorHeader}>
              <span style={styles.errorIcon}>⚠</span>
              <div style={styles.errorTitle}>Ingestion Failed</div>
            </div>
            <div style={styles.errorDetail}>{apiError}</div>
            <button onClick={handleReset} style={styles.tryAgainBtn}>
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    padding: "40px",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    minHeight: "calc(100vh - 10px)",
    backgroundColor: "var(--bg-primary)",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: "680px",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "16px",
    padding: "32px",
    boxShadow: "0 8px 30px rgba(0, 0, 0, 0.4)",
  },
  title: {
    margin: "0 0 8px 0",
    fontSize: "24px",
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  subtitle: {
    margin: "0 0 28px 0",
    fontSize: "14px",
    color: "var(--text-secondary)",
  },
  tabsContainer: {
    display: "flex",
    borderBottom: "1px solid var(--border)",
    marginBottom: "24px",
    gap: "8px",
  },
  tabButton: {
    padding: "10px 18px",
    backgroundColor: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    color: "var(--text-secondary)",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  tabButtonActive: {
    color: "var(--accent)",
    borderBottom: "2px solid var(--accent)",
  },
  tabContent: {
    marginBottom: "24px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  input: {
    backgroundColor: "var(--bg-primary)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    color: "var(--text-primary)",
    padding: "12px 14px",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.2s",
  },
  helperText: {
    fontSize: "12px",
    color: "var(--text-secondary)",
  },
  submitBtn: {
    backgroundColor: "var(--accent)",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    padding: "12px 24px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background-color 0.2s",
    alignSelf: "flex-start",
  },
  submitBtnDisabled: {
    backgroundColor: "var(--border)",
    color: "var(--text-secondary)",
    cursor: "not-allowed",
  },
  dropZone: {
    border: "2px dashed var(--border)",
    borderRadius: "12px",
    padding: "36px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    backgroundColor: "var(--bg-primary)",
    transition: "all 0.2s",
  },
  dropZoneActive: {
    borderColor: "var(--accent)",
    backgroundColor: "rgba(108, 99, 255, 0.05)",
  },
  dropZoneIcon: {
    fontSize: "32px",
    marginBottom: "12px",
  },
  dropZoneText: {
    fontSize: "14px",
    color: "var(--text-secondary)",
    textAlign: "center",
  },
  browseLink: {
    color: "var(--accent)",
    fontWeight: 500,
    textDecoration: "underline",
  },
  fileDetails: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    backgroundColor: "var(--bg-primary)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    padding: "12px",
    marginTop: "4px",
  },
  fileIcon: {
    fontSize: "24px",
  },
  fileMeta: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  fileName: {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  fileSize: {
    fontSize: "11px",
    color: "var(--text-secondary)",
  },
  errorTextInline: {
    color: "var(--danger)",
    fontSize: "12px",
    fontWeight: 500,
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "24px",
    backgroundColor: "var(--bg-primary)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    marginTop: "20px",
  },
  spinner: {
    width: "36px",
    height: "36px",
    border: "3px solid var(--border)",
    borderTop: "3px solid var(--accent)",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    marginBottom: "16px",
  },
  rotatingMsg: {
    fontSize: "15px",
    fontWeight: 500,
    color: "var(--text-primary)",
    marginBottom: "6px",
  },
  elapsedTime: {
    fontSize: "12px",
    color: "var(--text-secondary)",
  },
  successContainer: {
    backgroundColor: "rgba(74, 222, 128, 0.05)",
    border: "1px solid var(--success)",
    borderRadius: "12px",
    padding: "24px",
    marginTop: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  successHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  successIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    backgroundColor: "var(--success)",
    color: "var(--bg-primary)",
    fontWeight: "bold",
    fontSize: "14px",
  },
  successTitle: {
    fontSize: "16px",
    fontWeight: 600,
    color: "var(--success)",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "12px",
  },
  statCard: {
    backgroundColor: "var(--bg-primary)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
  },
  statVal: {
    fontSize: "20px",
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  statLabel: {
    fontSize: "11px",
    color: "var(--text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  exploreBtn: {
    backgroundColor: "var(--success)",
    color: "#0f1117",
    border: "none",
    borderRadius: "8px",
    padding: "12px 24px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background-color 0.2s",
    alignSelf: "center",
  },
  errorContainer: {
    backgroundColor: "rgba(248, 113, 113, 0.05)",
    border: "1px solid var(--danger)",
    borderRadius: "12px",
    padding: "24px",
    marginTop: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  errorHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  errorIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    backgroundColor: "var(--danger)",
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: "14px",
  },
  errorTitle: {
    fontSize: "16px",
    fontWeight: 600,
    color: "var(--danger)",
  },
  errorDetail: {
    fontSize: "13px",
    color: "var(--text-primary)",
    lineHeight: "1.5",
    backgroundColor: "var(--bg-primary)",
    padding: "12px",
    borderRadius: "6px",
    border: "1px solid var(--border)",
  },
  tryAgainBtn: {
    backgroundColor: "var(--danger)",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    padding: "10px 20px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    alignSelf: "flex-start",
  },
};

// Inject spin animation
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.innerHTML = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}
