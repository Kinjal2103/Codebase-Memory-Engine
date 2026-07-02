// src/components/Layout.tsx
import React, { createContext, useContext, useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { getRepos } from "../api/client";
import type { RepoItem } from "../api/client";

export interface RepoContextType {
  repos: RepoItem[];
  selectedRepo: string | null;
  setSelectedRepo: (path: string | null) => void;
  refreshRepos: () => Promise<void>;
  loadingRepos: boolean;
}

const RepoContext = createContext<RepoContextType | undefined>(undefined);

export const useRepo = () => {
  const context = useContext(RepoContext);
  if (!context) {
    throw new Error("useRepo must be used within a RepoProvider");
  }
  return context;
};

export const Layout: React.FC = () => {
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [selectedRepo, setSelectedRepoState] = useState<string | null>(null);
  const [loadingRepos, setLoadingRepos] = useState(true);

  const fetchRepos = async () => {
    setLoadingRepos(true);
    try {
      const data = await getRepos();
      setRepos(data);
      // Auto-select first repo if none selected
      if (data.length > 0 && !selectedRepo) {
        setSelectedRepoState(data[0].repo_path);
      }
    } catch (err) {
      console.error("Failed to load repositories:", err);
    } finally {
      setLoadingRepos(false);
    }
  };

  useEffect(() => {
    fetchRepos();
  }, []);

  const setSelectedRepo = (path: string | null) => {
    setSelectedRepoState(path);
    if (path) {
      localStorage.setItem("selected_repo_path", path);
    } else {
      localStorage.removeItem("selected_repo_path");
    }
  };

  // Hydrate selected repo on startup
  useEffect(() => {
    const saved = localStorage.getItem("selected_repo_path");
    if (saved) {
      setSelectedRepoState(saved);
    }
  }, []);

  return (
    <RepoContext.Provider
      value={{
        repos,
        selectedRepo,
        setSelectedRepo,
        refreshRepos: fetchRepos,
        loadingRepos,
      }}
    >
      <div style={styles.container}>
        <Sidebar onIngestSuccess={fetchRepos} />
        <div style={styles.mainArea}>
          <Outlet />
        </div>
      </div>
    </RepoContext.Provider>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: "flex",
    minHeight: "100vh",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
  },
  mainArea: {
    marginLeft: "220px", // Sidebar width
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0, // Prevent flex items from overflowing
  },
};
