// src/components/StatusBar.tsx
import React, { useEffect, useState } from "react";
import { getHealth } from "../api/client";
import type { HealthResponse } from "../api/client";
import { useRepo } from "./Layout";

export const StatusBar: React.FC = () => {
  const { selectedRepo } = useRepo();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    try {
      const data = await getHealth();
      setHealth(data);
    } catch (err) {
      console.error("Failed to fetch health status:", err);
      // Set statuses to error in case of server unreachable
      setHealth({
        status: "degraded",
        postgres: "error",
        neo4j: "error",
        faiss_index: "not built",
        llm: "error",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (statusVal: string | undefined) => {
    if (loading || !statusVal) return "var(--warning)"; // yellow for checking / loading
    if (statusVal === "ok" || statusVal === "loaded") return "var(--success)"; // green
    return "var(--danger)"; // red
  };

  const getStatusTitle = (statusVal: string | undefined, serviceName: string) => {
    if (loading) return `${serviceName}: Checking...`;
    return `${serviceName}: ${statusVal || "unknown"}`;
  };

  // Extract a readable repo folder name from absolute path
  const repoName = selectedRepo
    ? selectedRepo.split(/[/\\]/).pop() || selectedRepo
    : "No Repository Selected";

  return (
    <div style={styles.statusBar}>
      {/* Health Indicators (Left) */}
      <div style={styles.healthContainer}>
        <span style={styles.sectionLabel}>Services:</span>
        <div style={styles.serviceItem} title={getStatusTitle(health?.postgres, "Postgres")}>
          <span
            style={{
              ...styles.dot,
              backgroundColor: getStatusColor(health?.postgres),
            }}
          />
          <span style={styles.serviceLabel}>Postgres</span>
        </div>
        <span style={styles.separator}>·</span>
        <div style={styles.serviceItem} title={getStatusTitle(health?.neo4j, "Neo4j")}>
          <span
            style={{
              ...styles.dot,
              backgroundColor: getStatusColor(health?.neo4j),
            }}
          />
          <span style={styles.serviceLabel}>Neo4j</span>
        </div>
        <span style={styles.separator}>·</span>
        <div style={styles.serviceItem} title={getStatusTitle(health?.faiss_index, "FAISS Index")}>
          <span
            style={{
              ...styles.dot,
              backgroundColor: getStatusColor(health?.faiss_index),
            }}
          />
          <span style={styles.serviceLabel}>FAISS</span>
        </div>
        <span style={styles.separator}>·</span>
        <div style={styles.serviceItem} title={getStatusTitle(health?.llm, "LLM Service")}>
          <span
            style={{
              ...styles.dot,
              backgroundColor: getStatusColor(health?.llm),
            }}
          />
          <span style={styles.serviceLabel}>LLM</span>
        </div>
      </div>

      {/* Selected Repo Info (Right) */}
      <div style={styles.repoContainer} title={selectedRepo || ""}>
        <span style={styles.repoIcon}>📂</span>
        <span style={styles.repoText}>{repoName}</span>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  statusBar: {
    height: "32px",
    backgroundColor: "var(--bg-secondary)",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 16px",
    fontSize: "12px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    userSelect: "none",
  },
  healthContainer: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  sectionLabel: {
    color: "var(--text-secondary)",
    fontWeight: 500,
    marginRight: "4px",
  },
  serviceItem: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  dot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    display: "inline-block",
    boxShadow: "0 0 4px rgba(0, 0, 0, 0.4)",
    transition: "background-color 0.3s ease",
  },
  serviceLabel: {
    color: "var(--text-primary)",
  },
  separator: {
    color: "var(--border)",
    fontWeight: "bold",
  },
  repoContainer: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    maxWidth: "40%",
    overflow: "hidden",
  },
  repoIcon: {
    fontSize: "14px",
  },
  repoText: {
    color: "var(--text-secondary)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontWeight: 500,
  },
};
