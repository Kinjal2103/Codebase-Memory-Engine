// src/components/CodeViewer.tsx
import React, { useEffect, useState, useRef } from "react";
import Editor from "@monaco-editor/react";
import { getFileContent } from "../api/client";

interface CodeViewerProps {
  filePath: string;
  startLine?: number;
  language?: string;
  onClose: () => void;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({
  filePath,
  startLine,
  language,
  onClose,
}) => {
  const [code, setCode] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<any>(null);

  // Auto-detect language
  const detectLanguage = (path: string) => {
    if (language) return language;
    const ext = path.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "py":
        return "python";
      case "js":
      case "jsx":
        return "javascript";
      case "ts":
      case "tsx":
        return "typescript";
      case "json":
        return "json";
      case "html":
        return "html";
      case "css":
        return "css";
      case "md":
        return "markdown";
      case "sh":
        return "shell";
      case "yml":
      case "yaml":
        return "yaml";
      default:
        return "plaintext";
    }
  };

  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true);
      setError(null);
      try {
        const text = await getFileContent(filePath);
        setCode(text);
      } catch (err: any) {
        setError(err.message || "Failed to load file contents");
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, [filePath]);

  // Scroll to and highlight line when editor is ready
  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;

    if (startLine && startLine > 0) {
      // Small timeout to let Monaco initialize layout
      setTimeout(() => {
        editor.revealLineInCenter(startLine);
        
        // Highlight line using DeltaDecorations
        editor.deltaDecorations(
          [],
          [
            {
              range: new monaco.Range(startLine, 1, startLine, 1),
              options: {
                isWholeLine: true,
                className: "active-line-highlight",
              },
            },
          ]
        );

        // Put cursor at the start of that line
        editor.setPosition({ lineNumber: startLine, column: 1 });
      }, 100);
    }
  };

  const detectedLang = detectLanguage(filePath);

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Modal Header */}
        <div style={styles.header}>
          <div style={styles.headerTitle}>
            <span style={styles.fileIcon}>📄</span>
            <span style={styles.filePath} title={filePath}>
              {filePath}
            </span>
            {startLine && <span style={styles.lineTag}>Line {startLine}</span>}
          </div>
          <button onClick={onClose} style={styles.closeBtn} title="Close Code Viewer">
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={styles.body}>
          {loading && (
            <div style={styles.loadingContainer}>
              <div style={styles.spinner}></div>
              <div style={styles.loadingText}>Fetching file content...</div>
            </div>
          )}

          {error && (
            <div style={styles.errorContainer}>
              <div style={styles.errorIcon}>⚠️</div>
              <div style={styles.errorTitle}>Error Loading File</div>
              <div style={styles.errorText}>{error}</div>
            </div>
          )}

          {!loading && !error && (
            <Editor
              height="100%"
              theme="vs-dark"
              language={detectedLang}
              value={code}
              onMount={handleEditorDidMount}
              options={{
                readOnly: true,
                fontSize: 13,
                fontFamily: "monospace",
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                lineNumbersMinChars: 3,
                cursorBlinking: "solid",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(10, 11, 15, 0.8)",
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99999,
  },
  modal: {
    width: "85vw",
    height: "85vh",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6)",
  },
  header: {
    height: "48px",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 16px",
    backgroundColor: "var(--bg-tertiary)",
  },
  headerTitle: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    maxWidth: "80%",
  },
  fileIcon: {
    fontSize: "16px",
  },
  filePath: {
    fontSize: "14px",
    color: "var(--text-primary)",
    fontWeight: "bold",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  lineTag: {
    fontSize: "11px",
    backgroundColor: "rgba(108, 99, 255, 0.2)",
    border: "1px solid var(--accent)",
    color: "var(--text-primary)",
    padding: "2px 6px",
    borderRadius: "4px",
    fontWeight: 500,
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "var(--text-secondary)",
    fontSize: "18px",
    cursor: "pointer",
    transition: "color 0.2s",
  },
  body: {
    flexGrow: 1,
    height: "calc(100% - 48px)",
    position: "relative",
    backgroundColor: "#1e1e1e", // Monaco editor matches vs-dark default
  },
  loadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    backgroundColor: "var(--bg-secondary)",
  },
  spinner: {
    width: "36px",
    height: "36px",
    border: "3px solid var(--border)",
    borderTopColor: "var(--accent)",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  loadingText: {
    fontSize: "13px",
    color: "var(--text-secondary)",
  },
  errorContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    backgroundColor: "var(--bg-secondary)",
    textAlign: "center",
  },
  errorIcon: {
    fontSize: "40px",
    marginBottom: "8px",
  },
  errorTitle: {
    fontSize: "18px",
    fontWeight: "bold",
    color: "var(--text-primary)",
    marginBottom: "8px",
  },
  errorText: {
    fontSize: "14px",
    color: "var(--danger)",
    maxWidth: "500px",
  },
};

// Add CSS programmatically for spinner spin and line highlight in Monaco
if (typeof document !== "undefined") {
  const styleEl = document.createElement("style");
  styleEl.innerHTML = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .active-line-highlight {
      background-color: rgba(108, 99, 255, 0.15) !important;
      border-left: 3px solid var(--accent);
    }
  `;
  document.head.appendChild(styleEl);
}
