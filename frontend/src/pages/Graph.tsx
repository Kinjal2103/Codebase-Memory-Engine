// src/pages/Graph.tsx
import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import CytoscapeComponent from "react-cytoscapejs";
import { getGraph } from "../api/client";
import type { GraphNode, GraphEdge } from "../api/client";
import { StatusBar } from "../components/StatusBar";

export const Graph: React.FC = () => {
  const navigate = useNavigate();
  const [functionInput, setFunctionInput] = useState("");

  const [elements, setElements] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected node details for the right sidebar
  const [selectedNode, setSelectedNode] = useState<{
    id: string;
    name: string;
    file: string;
    type: "function" | "file";
  } | null>(null);

  const cyRef = useRef<any>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!functionInput.trim()) return;

    setLoading(true);
    setError(null);
    setSelectedNode(null);
    try {
      const data = await getGraph(functionInput.trim());


      const cyElements: any[] = [];
      const fileNodesSet = new Set<string>();

      // 1. Map function nodes
      data.nodes.forEach((node: GraphNode) => {
        cyElements.push({
          data: {
            id: node.id,
            label: node.name,
            type: "function",
            file: node.file,
            // Mark if it's the exact searched function
            isSearched: node.name.toLowerCase() === functionInput.trim().toLowerCase(),
          },
        });

        // Track unique files to synthesize file nodes
        if (node.file) {
          fileNodesSet.add(node.file);
        }
      });

      // 2. Synthesize File nodes
      fileNodesSet.forEach((filePath) => {
        const fileId = `file:${filePath}`;
        cyElements.push({
          data: {
            id: fileId,
            label: filePath.split(/[/\\]/).pop() || filePath, // filename only
            type: "file",
            file: filePath,
          },
        });
      });

      // 3. Map CALLS edges
      data.edges.forEach((edge: GraphEdge) => {
        cyElements.push({
          data: {
            id: `edge:${edge.source}-${edge.target}`,
            source: edge.source,
            target: edge.target,
            type: edge.type || "CALLS",
          },
        });
      });

      // 4. Create DEFINED_IN relationships connecting function nodes to their file nodes
      data.nodes.forEach((node: GraphNode) => {
        if (node.file) {
          cyElements.push({
            data: {
              id: `def:${node.id}-${node.file}`,
              source: node.id,
              target: `file:${node.file}`,
              type: "IMPORTS", // Render as dashed edge per instruction
            },
          });
        }
      });

      setElements(cyElements);
    } catch (err: any) {
      setError(err.message || "Failed to load dependency graph. Make sure the function exists.");
      setElements([]);
    } finally {
      setLoading(false);
    }
  };

  const handleResetView = () => {
    if (cyRef.current) {
      cyRef.current.fit();
      cyRef.current.center();
    }
  };

  const handleZoomIn = () => {
    if (cyRef.current) {
      cyRef.current.zoom(cyRef.current.zoom() * 1.2);
    }
  };

  const handleZoomOut = () => {
    if (cyRef.current) {
      cyRef.current.zoom(cyRef.current.zoom() / 1.2);
    }
  };

  // Attach event handlers to Cytoscape instance
  const initCytoscape = (cy: any) => {
    cyRef.current = cy;

    cy.on("tap", "node", (evt: any) => {
      const node = evt.target;
      const data = node.data();
      setSelectedNode({
        id: data.id,
        name: data.label,
        file: data.file,
        type: data.type,
      });
    });

    cy.on("tap", (evt: any) => {
      if (evt.target === cy) {
        setSelectedNode(null);
      }
    });
  };

  const cytoscapeStylesheet = [
    {
      selector: "node[type='function']",
      style: {
        "background-color": "var(--accent)",
        label: "data(label)",
        color: "var(--text-primary)",
        shape: "ellipse",
        width: 32,
        height: 32,
        "font-size": 11,
        "text-valign": "bottom" as any,
        "text-margin-y": 6,
        "font-family": "system-ui, sans-serif",
      },
    },
    {
      selector: "node[type='function'][?isSearched]",
      style: {
        "background-color": "var(--warning)", // Selected / Searched target node is larger + orange
        width: 44,
        height: 44,
        "border-width": 2,
        "border-color": "#ffffff",
      },
    },
    {
      selector: "node[type='file']",
      style: {
        "background-color": "var(--bg-tertiary)",
        label: "data(label)",
        color: "var(--text-secondary)",
        shape: "rectangle" as any,
        width: 70,
        height: 28,
        "border-width": 1,
        "border-color": "var(--border)",
        "font-size": 10,
        "font-family": "monospace",
        "text-valign": "center" as any,
        "text-halign": "center" as any,
      },
    },
    {
      selector: "node:selected",
      style: {
        "border-width": 3,
        "border-color": "var(--warning)",
        "background-color": "var(--warning)",
      },
    },
    {
      selector: "edge[type='CALLS']",
      style: {
        width: 2,
        "line-color": "var(--border)",
        "target-arrow-color": "var(--border)",
        "target-arrow-shape": "triangle" as any,
        "curve-style": "bezier" as any,
      },
    },
    {
      selector: "edge[type='IMPORTS']",
      style: {
        width: 1.5,
        "line-color": "var(--text-secondary)",
        "line-style": "dashed" as any, // Imports/Definition edges are dashed
        "target-arrow-color": "var(--text-secondary)",
        "target-arrow-shape": "triangle" as any,
        "curve-style": "bezier" as any,
      },
    },
  ];

  return (
    <div style={styles.graphPage}>
      <StatusBar />

      <div style={styles.graphContainer}>
        {/* Search Header */}
        <div style={styles.searchBar}>
          <form onSubmit={handleSearch} style={styles.form}>
            <input
              type="text"
              placeholder="Enter a function name (e.g. 'verify_connection')"
              value={functionInput}
              onChange={(e) => setFunctionInput(e.target.value)}
              style={styles.input}
            />
            <button type="submit" style={styles.searchBtn} disabled={loading}>
              {loading ? "Loading..." : "Visualize Graph"}
            </button>
          </form>

          {/* Reset / Zoom controls */}
          {elements.length > 0 && (
            <div style={styles.controls}>
              <button onClick={handleZoomIn} style={styles.ctrlBtn} title="Zoom In">
                ➕
              </button>
              <button onClick={handleZoomOut} style={styles.ctrlBtn} title="Zoom Out">
                ➖
              </button>
              <button onClick={handleResetView} style={styles.ctrlBtn} title="Reset View">
                🔄 Reset
              </button>
            </div>
          )}
        </div>

        {/* Graph Display Area */}
        <div style={styles.workspace}>
          {error && <div style={styles.errorAlert}>⚠️ {error}</div>}

          {elements.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>🕸️</div>
              <div style={styles.emptyText}>
                Enter a function name above to explore its call relationships and file boundaries in the interactive graph canvas.
              </div>
            </div>
          ) : (
            <div style={styles.canvasWrapper}>
              <CytoscapeComponent
                elements={elements}
                style={{ width: "100%", height: "calc(100vh - 120px)" }}
                stylesheet={cytoscapeStylesheet}
                cy={initCytoscape}
                layout={{
                  name: "breadthfirst",
                  directed: true,
                  padding: 30,
                  spacingFactor: 1.1,
                }}
              />

              {/* Selection Right Drawer Panel */}
              {selectedNode && (
                <div style={styles.detailsPanel}>
                  <div style={styles.panelHeader}>
                    <span style={styles.panelTag}>
                      {selectedNode.type === "function" ? "Function" : "File"}
                    </span>
                    <button onClick={() => setSelectedNode(null)} style={styles.panelClose}>
                      ✕
                    </button>
                  </div>
                  <h3 style={styles.panelNodeName}>{selectedNode.name}</h3>
                  <div style={styles.panelDetail}>
                    <div style={styles.detailLabel}>File Path</div>
                    <div style={styles.detailValue} title={selectedNode.file}>
                      {selectedNode.file || "Unknown"}
                    </div>
                  </div>

                  <div style={styles.panelActions}>
                    <button
                      onClick={() =>
                        navigate("/", {
                          state: {
                            initialQuestion: `How does the ${
                              selectedNode.type === "function" ? "function" : "module file"
                            } "${selectedNode.name}" work and what are its dependencies?`,
                          },
                        })
                      }
                      style={styles.actionBtn}
                    >
                      💬 Ask about this
                    </button>

                    {selectedNode.type === "function" && (
                      <button
                        onClick={() => navigate(`/impact?function=${selectedNode.name}`)}
                        style={{ ...styles.actionBtn, backgroundColor: "var(--bg-primary)" }}
                      >
                        💥 Check impact
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  graphPage: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  graphContainer: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    overflow: "hidden",
  },
  searchBar: {
    padding: "12px 20px",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "var(--bg-secondary)",
    gap: "16px",
  },
  form: {
    display: "flex",
    gap: "10px",
    flexGrow: 1,
    maxWidth: "500px",
  },
  input: {
    flexGrow: 1,
    backgroundColor: "var(--bg-primary)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    color: "var(--text-primary)",
    padding: "8px 12px",
    fontSize: "13px",
    outline: "none",
  },
  searchBtn: {
    backgroundColor: "var(--accent)",
    border: "none",
    borderRadius: "6px",
    color: "#fff",
    padding: "8px 16px",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  controls: {
    display: "flex",
    gap: "8px",
  },
  ctrlBtn: {
    backgroundColor: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
    padding: "6px 12px",
    borderRadius: "6px",
    fontSize: "12px",
    cursor: "pointer",
  },
  workspace: {
    flexGrow: 1,
    position: "relative",
    overflow: "hidden",
  },
  canvasWrapper: {
    position: "relative",
    width: "100%",
    height: "100%",
    backgroundColor: "#0d0e12", // dark canvas grid background
  },
  detailsPanel: {
    position: "absolute",
    right: "20px",
    top: "20px",
    bottom: "20px",
    width: "280px",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "10px",
    padding: "16px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    zIndex: 1000,
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  panelTag: {
    fontSize: "10px",
    fontWeight: "bold",
    textTransform: "uppercase",
    backgroundColor: "rgba(108, 99, 255, 0.2)",
    border: "1px solid var(--accent)",
    color: "var(--text-primary)",
    padding: "2px 6px",
    borderRadius: "4px",
  },
  panelClose: {
    background: "none",
    border: "none",
    color: "var(--text-secondary)",
    cursor: "pointer",
    fontSize: "14px",
  },
  panelNodeName: {
    margin: 0,
    fontSize: "16px",
    fontWeight: "bold",
    color: "var(--text-primary)",
    fontFamily: "monospace",
    wordBreak: "break-all",
  },
  panelDetail: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  detailLabel: {
    fontSize: "11px",
    color: "var(--text-secondary)",
    textTransform: "uppercase",
  },
  detailValue: {
    fontSize: "13px",
    color: "var(--text-primary)",
    fontFamily: "monospace",
    wordBreak: "break-all",
  },
  panelActions: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginTop: "auto",
  },
  actionBtn: {
    backgroundColor: "var(--accent)",
    border: "1px solid var(--border)",
    color: "#fff",
    borderRadius: "6px",
    padding: "8px",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    textAlign: "center",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: "16px",
    padding: "40px",
    textAlign: "center",
  },
  emptyIcon: {
    fontSize: "48px",
    opacity: 0.4,
  },
  emptyText: {
    fontSize: "14px",
    color: "var(--text-secondary)",
    maxWidth: "400px",
    lineHeight: "1.5",
  },
  errorAlert: {
    margin: "20px",
    backgroundColor: "rgba(248, 113, 113, 0.1)",
    border: "1px solid var(--danger)",
    color: "var(--danger)",
    padding: "12px 16px",
    borderRadius: "6px",
    fontSize: "13px",
  },
};
