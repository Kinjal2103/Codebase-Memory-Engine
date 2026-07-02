// src/pages/Chat.tsx
import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { askQuestion } from "../api/client";
import { CodeViewer } from "../components/CodeViewer";
import { StatusBar } from "../components/StatusBar";

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  sources?: string[];
  timestamp: Date;
}

export const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedLine, setSelectedLine] = useState<number | undefined>(undefined);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const starterQuestions = [
    "Where is authentication handled?",
    "What are the most complex functions?",
    "Explain the overall architecture",
    "Where is error handling implemented?",
  ];

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Handle textarea height adjustment
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = {
      id: Math.random().toString(36).substr(2, 9),
      sender: "user",
      text: textToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const response = await askQuestion(textToSend);
      const aiMsg: Message = {
        id: Math.random().toString(36).substr(2, 9),
        sender: "ai",
        text: response.answer,
        sources: response.sources || [],
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: Math.random().toString(36).substr(2, 9),
        sender: "ai",
        text: `❌ **Error:** ${err.message || "Failed to get a response from the server. Make sure Ollama or Gemini is available."}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  const handleSourceClick = (source: string) => {
    // Robustly parse file paths with optional line numbers: path#L12 or path:12
    const hashParts = source.split("#L");
    if (hashParts.length > 1) {
      setSelectedFile(hashParts[0]);
      setSelectedLine(parseInt(hashParts[1], 10));
      return;
    }

    const colonParts = source.split(":");
    // Check if it looks like Windows path (C:\path:12) vs relative path (foo.py:12)
    if (colonParts.length > 2) {
      const lineStr = colonParts.pop();
      const pathStr = colonParts.join(":");
      const lineNum = parseInt(lineStr || "", 10);
      if (!isNaN(lineNum)) {
        setSelectedFile(pathStr);
        setSelectedLine(lineNum);
        return;
      }
    } else if (colonParts.length === 2 && !/^[a-zA-Z]$/.test(colonParts[0])) {
      setSelectedFile(colonParts[0]);
      setSelectedLine(parseInt(colonParts[1], 10));
      return;
    }

    setSelectedFile(source);
    setSelectedLine(undefined);
  };

  return (
    <div style={styles.chatPage}>
      {/* Top Status Bar */}
      <StatusBar />

      {/* Main Chat Pane */}
      <div style={styles.chatArea}>
        {messages.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.welcomeTitle}>How can I help you explore the codebase?</div>
            <div style={styles.welcomeSubtitle}>
              Ask questions about architecture, find bugs, or analyze functions.
            </div>
            <div style={styles.starterGrid}>
              {starterQuestions.map((q) => (
                <button key={q} onClick={() => handleSend(q)} style={styles.starterCard}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={styles.messageList}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  ...styles.messageRow,
                  justifyContent: msg.sender === "user" ? "flex-end" : "flex-start",
                }}
              >
                {msg.sender === "ai" && <div style={styles.avatar}>AI</div>}
                <div
                  style={{
                    ...styles.bubble,
                    ...(msg.sender === "user" ? styles.userBubble : styles.aiBubble),
                  }}
                >
                  <div style={styles.messageContent}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                  </div>

                  {msg.sources && msg.sources.length > 0 && (
                    <div style={styles.sourcesContainer}>
                      <div style={styles.sourcesLabel}>Sources referenced:</div>
                      <div style={styles.sourcesList}>
                        {msg.sources.map((src, i) => (
                          <button
                            key={i}
                            onClick={() => handleSourceClick(src)}
                            style={styles.sourceTag}
                          >
                            📄 {src.split(/[/\\]/).pop() || src}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div style={styles.messageRow}>
                <div style={styles.avatar}>AI</div>
                <div style={{ ...styles.bubble, ...styles.aiBubble }}>
                  <div style={styles.typingIndicator}>
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Bar (Fixed Bottom) */}
      <div style={styles.inputArea}>
        <div style={styles.inputWrapper}>
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about the codebase... (Press Enter to send, Shift+Enter for newline)"
            style={styles.textarea}
            disabled={loading}
          />
          <button
            onClick={() => handleSend(input)}
            style={{
              ...styles.sendBtn,
              opacity: input.trim() && !loading ? 1 : 0.5,
              cursor: input.trim() && !loading ? "pointer" : "default",
            }}
            disabled={!input.trim() || loading}
          >
            ➔
          </button>
        </div>
      </div>

      {/* Code Viewer Modal */}
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
  chatPage: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    position: "relative",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  chatArea: {
    flexGrow: 1,
    overflowY: "auto",
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
  },
  emptyState: {
    margin: "auto",
    maxWidth: "600px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    padding: "40px 20px",
  },
  welcomeTitle: {
    fontSize: "22px",
    fontWeight: "bold",
    color: "var(--text-primary)",
  },
  welcomeSubtitle: {
    fontSize: "14px",
    color: "var(--text-secondary)",
    marginBottom: "24px",
  },
  starterGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
    width: "100%",
  },
  starterCard: {
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    padding: "16px",
    color: "var(--text-primary)",
    cursor: "pointer",
    fontSize: "13px",
    textAlign: "left",
    lineHeight: "1.4",
    transition: "all 0.2s",
    outline: "none",
  },
  messageList: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    maxWidth: "900px",
    width: "100%",
    margin: "0 auto",
    paddingBottom: "80px", // space for floating inputs
  },
  messageRow: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
  },
  avatar: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    backgroundColor: "var(--accent)",
    color: "#fff",
    fontSize: "11px",
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: "4px",
  },
  bubble: {
    maxWidth: "80%",
    padding: "12px 16px",
    borderRadius: "12px",
    fontSize: "14px",
    lineHeight: "1.5",
  },
  userBubble: {
    backgroundColor: "var(--accent)",
    color: "#ffffff",
    borderBottomRightRadius: "4px",
  },
  aiBubble: {
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
    borderBottomLeftRadius: "4px",
  },
  messageContent: {
    wordBreak: "break-word",
  },
  sourcesContainer: {
    marginTop: "12px",
    paddingTop: "12px",
    borderTop: "1px solid var(--border)",
  },
  sourcesLabel: {
    fontSize: "11px",
    color: "var(--text-secondary)",
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: "8px",
  },
  sourcesList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
  },
  sourceTag: {
    backgroundColor: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    color: "var(--text-primary)",
    fontSize: "12px",
    padding: "4px 8px",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  typingIndicator: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    height: "18px",
    padding: "0 4px",
  },
  inputArea: {
    padding: "16px 24px",
    borderTop: "1px solid var(--border)",
    backgroundColor: "var(--bg-primary)",
    position: "sticky",
    bottom: 0,
  },
  inputWrapper: {
    maxWidth: "900px",
    margin: "0 auto",
    display: "flex",
    alignItems: "flex-end",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    padding: "8px 12px",
    gap: "10px",
  },
  textarea: {
    flexGrow: 1,
    backgroundColor: "transparent",
    border: "none",
    color: "var(--text-primary)",
    fontSize: "14px",
    lineHeight: "1.5",
    outline: "none",
    resize: "none",
    padding: "4px 0",
    maxHeight: "120px",
    fontFamily: "inherit",
  },
  sendBtn: {
    backgroundColor: "var(--accent)",
    border: "none",
    color: "#fff",
    width: "28px",
    height: "28px",
    borderRadius: "6px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
    flexShrink: 0,
  },
};
// Add CSS keyframes style programmatically for the typing dots animation
if (typeof document !== "undefined") {
  const styleEl = document.createElement("style");
  styleEl.innerHTML = `
    @keyframes typingDot {
      0%, 100% { opacity: 0.2; transform: translateY(0); }
      50% { opacity: 1; transform: translateY(-3px); }
    }
    .typing-indicator span {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: var(--text-secondary);
      animation: typingDot 1.4s infinite both;
    }
    .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
    .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
  `;
  document.head.appendChild(styleEl);
}
