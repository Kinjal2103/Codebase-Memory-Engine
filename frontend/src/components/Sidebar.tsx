// src/components/Sidebar.tsx
import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useRepo } from "./Layout";
import { ingestRepo } from "../api/client";

interface SidebarProps {
  onIngestSuccess?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onIngestSuccess }) => {
  const navigate = useNavigate();
  const { repos, selectedRepo, setSelectedRepo, refreshRepos, loadingRepos } = useRepo();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [repoPath, setRepoPath] = useState("");
  const [ingesting, setIngesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const links = [
    { to: "/", label: "Chat", icon: "💬" },
    { to: "/search", label: "Search", icon: "🔍" },
    { to: "/graph", label: "Graph", icon: "🕸" },
    { to: "/impact", label: "Impact", icon: "💥" },
    { to: "/quality", label: "Quality", icon: "🧹" },
    { to: "/history", label: "History", icon: "📜" },
  ];

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoPath.trim()) return;

    setIngesting(true);
    setError(null);
    try {
      await ingestRepo(repoPath.trim());
      await refreshRepos();
      setSelectedRepo(repoPath.trim());
      setRepoPath("");
      setIsModalOpen(false);
      if (onIngestSuccess) onIngestSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to ingest repository");
    } finally {
      setIngesting(false);
    }
  };

  return (
    <aside style={styles.sidebar}>
      {/* Sidebar Header / Logo */}
      <div style={styles.header}>
        <div style={styles.logoIcon}>⚡</div>
        <div style={styles.logoText}>
          <div style={styles.logoTitle}>Codebase Memory</div>
          <div style={styles.logoSubtitle}>Code Engine</div>
        </div>
      </div>

      {/* Nav Links */}
      <nav style={styles.nav}>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            style={({ isActive }) => ({
              ...styles.navLink,
              ...(isActive ? styles.navLinkActive : {}),
            })}
          >
            <span style={styles.navIcon}>{link.icon}</span>
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Repo Management Selector at the bottom */}
      <div style={styles.bottomSection}>
        <div style={styles.repoLabel}>Selected Repository</div>
        {loadingRepos ? (
          <div style={styles.loadingText}>Loading repositories...</div>
        ) : (
          <select
            value={selectedRepo || ""}
            onChange={(e) => setSelectedRepo(e.target.value || null)}
            style={styles.select}
          >
            <option value="">-- Select a Repo --</option>
            {repos.map((repo) => (
              <option key={repo.repo_path} value={repo.repo_path}>
                {repo.repo_path.split(/[/\\]/).pop() || repo.repo_path}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={() => {
            navigate("/ingest");
          }}
          style={styles.ingestBtn}
        >
          ➕ Ingest new repo
        </button>
      </div>


      {/* Ingestion Modal Overlay */}
      {isModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Ingest Repository</h3>
              <button onClick={() => setIsModalOpen(false)} style={styles.modalCloseBtn}>
                ✕
              </button>
            </div>
            <form onSubmit={handleIngest} style={styles.form}>
              <p style={styles.modalDescription}>
                Enter the absolute local directory path of the git repository to parse and index.
              </p>
              <input
                type="text"
                placeholder="e.g. C:/Users/name/projects/my-repo"
                value={repoPath}
                onChange={(e) => setRepoPath(e.target.value)}
                style={styles.input}
                required
                disabled={ingesting}
              />
              {error && <div style={styles.errorText}>{error}</div>}
              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={styles.cancelBtn}
                  disabled={ingesting}
                >
                  Cancel
                </button>
                <button type="submit" style={styles.submitBtn} disabled={ingesting}>
                  {ingesting ? "Ingesting..." : "Start Ingestion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  sidebar: {
    width: "220px",
    height: "100vh",
    backgroundColor: "var(--bg-secondary)",
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    position: "fixed",
    left: 0,
    top: 0,
    zIndex: 100,
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  header: {
    padding: "20px 16px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    borderBottom: "1px solid var(--border)",
  },
  logoIcon: {
    fontSize: "24px",
    color: "var(--accent)",
  },
  logoText: {
    display: "flex",
    flexDirection: "column",
  },
  logoTitle: {
    fontWeight: "bold",
    fontSize: "16px",
    color: "var(--text-primary)",
  },
  logoSubtitle: {
    fontSize: "11px",
    color: "var(--text-secondary)",
  },
  nav: {
    padding: "20px 12px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    flexGrow: 1,
    overflowY: "auto",
  },
  navLink: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 12px",
    borderRadius: "6px",
    color: "var(--text-secondary)",
    textDecoration: "none",
    fontSize: "14px",
    transition: "all 0.2s ease-in-out",
  },
  navLinkActive: {
    backgroundColor: "var(--bg-tertiary)",
    color: "var(--text-primary)",
    borderLeft: "3px solid var(--accent)",
    paddingLeft: "9px", // compensate border width
  },
  navIcon: {
    fontSize: "16px",
  },
  bottomSection: {
    padding: "16px",
    borderTop: "1px solid var(--border)",
    backgroundColor: "var(--bg-primary)",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  repoLabel: {
    fontSize: "12px",
    color: "var(--text-secondary)",
    fontWeight: 500,
  },
  loadingText: {
    fontSize: "12px",
    color: "var(--text-secondary)",
    fontStyle: "italic",
  },
  select: {
    width: "100%",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    color: "var(--text-primary)",
    padding: "8px",
    fontSize: "13px",
    cursor: "pointer",
    outline: "none",
  },
  ingestBtn: {
    width: "100%",
    backgroundColor: "transparent",
    border: "1px dashed var(--border)",
    borderRadius: "6px",
    color: "var(--text-primary)",
    padding: "8px",
    fontSize: "12px",
    cursor: "pointer",
    transition: "all 0.2s",
    textAlign: "center",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  modalContent: {
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    width: "450px",
    padding: "24px",
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  modalTitle: {
    margin: 0,
    fontSize: "18px",
    color: "var(--text-primary)",
  },
  modalCloseBtn: {
    background: "none",
    border: "none",
    color: "var(--text-secondary)",
    fontSize: "18px",
    cursor: "pointer",
  },
  modalDescription: {
    fontSize: "13px",
    color: "var(--text-secondary)",
    lineHeight: "1.5",
    margin: "0 0 16px 0",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  input: {
    backgroundColor: "var(--bg-primary)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    color: "var(--text-primary)",
    padding: "10px 12px",
    fontSize: "14px",
    outline: "none",
  },
  errorText: {
    color: "var(--danger)",
    fontSize: "13px",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
  },
  cancelBtn: {
    backgroundColor: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    color: "var(--text-secondary)",
    padding: "8px 16px",
    cursor: "pointer",
    fontSize: "13px",
  },
  submitBtn: {
    backgroundColor: "var(--accent)",
    border: "none",
    borderRadius: "6px",
    color: "#ffffff",
    padding: "8px 16px",
    cursor: "pointer",
    fontWeight: 500,
    fontSize: "13px",
    transition: "background-color 0.2s",
  },
};
