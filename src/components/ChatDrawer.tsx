"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ChatMessage {
  _id: string;
  role: "user" | "assistant";
  content: string;
  images?: string[];
  model?: string;
  timestamp: number;
}

interface ChatSession {
  _id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (content: string, images?: string[]) => void;
  isLoading: boolean;
  selectedModel: string;
  onModelChange: (model: string) => void;
  onClearChat: () => void;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  streamingContent: string;
  isStreaming: boolean;
}

const MODELS = [
  { label: "Gemini 3.1 Pro", value: "google/gemini-3.1-pro-preview" },
  { label: "Claude Sonnet 4.6", value: "anthropic/claude-sonnet-4.6" },
  { label: "MiniMax M2.5", value: "minimax/minimax-m2.5" },
  { label: "GLM-5", value: "z-ai/glm-5" },
  { label: "Kimi K2.5", value: "moonshotai/kimi-k2.5" },
  { label: "DeepSeek V3.2", value: "deepseek/deepseek-v3.2" },
];

const NON_VISION_MODELS = [
  "minimax/minimax-m2.5",
  "z-ai/glm-5",
  "deepseek/deepseek-v3.2",
];

function getModelLabel(value: string): string {
  return MODELS.find((m) => m.value === value)?.label ?? value;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatRelativeDate(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function renderMarkdown(text: string): string {
  // Strip any raw HTML tags first for safety
  let safe = text.replace(/<[^>]*>/g, "");
  // Bold: **text**
  safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic: *text* (but not inside bold)
  safe = safe.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");
  // Inline code: `code`
  safe = safe.replace(
    /`([^`]+)`/g,
    '<code style="background:rgba(255,255,255,0.06);padding:1px 5px;border-radius:4px;font-family:var(--font-mono);font-size:12px">$1</code>',
  );
  // Process line by line for bullets and line breaks
  const lines = safe.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (line.startsWith("- ")) {
      out.push(
        `<div style="display:flex;gap:8px;padding-left:8px"><span style="color:#ff2d2d">•</span><span>${line.slice(2)}</span></div>`,
      );
    } else {
      out.push(line);
    }
  }
  return out.join("<br />");
}

export default function ChatDrawer({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  isLoading,
  selectedModel,
  onModelChange,
  onClearChat,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  streamingContent,
  isStreaming,
}: ChatDrawerProps) {
  const [input, setInput] = useState("");
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previousMessageCountRef = useRef(0);
  const previousStreamingLengthRef = useRef(0);
  const streamScrollRafRef = useRef<number | null>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  const isNearBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    const distanceFromBottom = container.scrollHeight - (container.scrollTop + container.clientHeight);
    return distanceFromBottom <= 120;
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    previousMessageCountRef.current = messages.length;
    previousStreamingLengthRef.current = streamingContent.length;
    scrollToBottom("auto");
  }, [activeSessionId, isOpen, scrollToBottom]);

  useEffect(() => {
    if (!isOpen) {
      previousMessageCountRef.current = messages.length;
      return;
    }

    if (messages.length > previousMessageCountRef.current) {
      scrollToBottom(previousMessageCountRef.current > 0 ? "smooth" : "auto");
    }
    previousMessageCountRef.current = messages.length;
  }, [isOpen, messages.length, scrollToBottom]);

  useEffect(() => {
    const streamingLength = streamingContent.length;

    if (!isOpen || !isStreaming) {
      previousStreamingLengthRef.current = streamingLength;
      return;
    }

    if (streamingLength <= previousStreamingLengthRef.current) {
      previousStreamingLengthRef.current = streamingLength;
      return;
    }

    previousStreamingLengthRef.current = streamingLength;
    if (!isNearBottom()) return;
    if (streamScrollRafRef.current !== null) return;

    streamScrollRafRef.current = window.requestAnimationFrame(() => {
      streamScrollRafRef.current = null;
      if (isNearBottom()) {
        scrollToBottom("auto");
      }
    });
  }, [isNearBottom, isOpen, isStreaming, scrollToBottom, streamingContent.length]);

  useEffect(() => {
    return () => {
      if (streamScrollRafRef.current !== null) {
        window.cancelAnimationFrame(streamScrollRafRef.current);
        streamScrollRafRef.current = null;
      }
    };
  }, []);

  // Focus input when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Close sidebar when drawer closes
  useEffect(() => {
    if (!isOpen) setIsSidebarOpen(false);
  }, [isOpen]);

  const handleSend = () => {
    const trimmed = input.trim();
    const hasImages = attachedImages.length > 0;
    if ((!trimmed && !hasImages) || isLoading) return;
    onSendMessage(trimmed, hasImages ? attachedImages : undefined);
    setInput("");
    setAttachedImages([]);
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const readFilesAsDataUrls = (files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setAttachedImages((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = e.clipboardData.files;
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length > 0) {
      e.preventDefault();
      readFilesAsDataUrls(imageFiles);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      readFilesAsDataUrls(e.target.files);
    }
    // Reset so re-selecting the same file works
    e.target.value = "";
  };

  const handleSelectSession = (id: string) => {
    onSelectSession(id);
    setIsSidebarOpen(false);
  };

  const handleNewChat = () => {
    onNewChat();
    setIsSidebarOpen(false);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col w-full md:w-[420px]"
        style={{
          background: "rgba(10, 10, 10, 0.98)",
          backdropFilter: "blur(24px)",
          borderLeft: "1px solid rgba(255,45,45,0.15)",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 300ms ease",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4 shrink-0 relative z-20"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          {/* History/sidebar toggle */}
          <button
            onClick={() => setIsSidebarOpen((o) => !o)}
            className="p-2 rounded-lg cursor-pointer transition-colors"
            style={{ color: isSidebarOpen ? "#ff2d2d" : "rgba(255,255,255,0.4)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#ff2d2d";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = isSidebarOpen
                ? "#ff2d2d"
                : "rgba(255,255,255,0.4)";
            }}
            title="Chat history"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* Title + pulse dot */}
          <div className="flex items-center gap-2 mr-auto">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background: "#ff2d2d",
                animation: "chatPulse 2s ease-in-out infinite",
              }}
            />
            <span
              className="font-semibold"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "18px",
                color: "#ebebeb",
              }}
            >
              Zenith AI
            </span>
          </div>

          {/* Model selector */}
          <select
            value={selectedModel}
            onChange={(e) => onModelChange(e.target.value)}
            className="rounded-lg px-2 py-1.5 text-xs outline-none cursor-pointer"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.6)",
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,45,45,0.4)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
            }}
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          {/* Clear chat */}
          <button
            onClick={onClearChat}
            className="p-2 rounded-lg cursor-pointer transition-colors"
            style={{ color: "rgba(255,255,255,0.4)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#ff2d2d";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(255,255,255,0.4)";
            }}
            title="Clear chat"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-2 rounded-lg cursor-pointer transition-colors"
            style={{ color: "rgba(255,255,255,0.4)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#ff2d2d";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(255,255,255,0.4)";
            }}
            title="Close chat"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content area: sidebar + messages */}
        <div className="flex-1 relative overflow-hidden">
          {/* Session sidebar */}
          <div
            className="absolute top-0 left-0 bottom-0 z-10 flex flex-col w-full md:w-[220px]"
            style={{
              background: "rgba(10, 10, 10, 0.98)",
              backdropFilter: "blur(24px)",
              borderRight: "1px solid rgba(255,45,45,0.1)",
              transform: isSidebarOpen ? "translateX(0)" : "translateX(-100%)",
              transition: "transform 300ms ease",
            }}
          >
            {/* Mobile back button */}
            <div className="flex items-center gap-2 px-3 py-3 md:hidden"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-1.5 rounded-lg cursor-pointer transition-colors"
                style={{ color: "rgba(255,255,255,0.5)" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#ff2d2d"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  color: "rgba(255,255,255,0.4)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                History
              </span>
            </div>

            {/* New Chat button */}
            <div className="px-3 py-3">
              <button
                onClick={handleNewChat}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all"
                style={{
                  background: "rgba(255,45,45,0.06)",
                  border: "1px solid rgba(255,45,45,0.2)",
                  color: "#ff2d2d",
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,45,45,0.12)";
                  e.currentTarget.style.borderColor = "rgba(255,45,45,0.35)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,45,45,0.06)";
                  e.currentTarget.style.borderColor = "rgba(255,45,45,0.2)";
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New Chat
              </button>
            </div>

            {/* Session list */}
            <div className="flex-1 overflow-y-auto px-2 pb-3">
              {sessions.map((session) => {
                const isActive = session._id === activeSessionId;
                const isHovered = session._id === hoveredSessionId;
                return (
                  <button
                    key={session._id}
                    onClick={() => handleSelectSession(session._id)}
                    onMouseEnter={() => setHoveredSessionId(session._id)}
                    onMouseLeave={() => setHoveredSessionId(null)}
                    className="w-full text-left px-3 py-2.5 rounded-lg cursor-pointer transition-all mb-0.5 relative group"
                    style={{
                      background: isActive
                        ? "rgba(255,45,45,0.08)"
                        : isHovered
                          ? "rgba(255,255,255,0.04)"
                          : "transparent",
                      borderLeft: isActive
                        ? "2px solid #ff2d2d"
                        : "2px solid transparent",
                    }}
                  >
                    <div
                      className="truncate"
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "11px",
                        color: isActive ? "#ebebeb" : "rgba(255,255,255,0.55)",
                        lineHeight: "1.4",
                      }}
                    >
                      {session.title}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "10px",
                        color: "rgba(255,255,255,0.25)",
                        marginTop: "2px",
                      }}
                    >
                      {formatRelativeDate(session.updatedAt)}
                    </div>

                    {/* Delete button on hover */}
                    {isHovered && sessions.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(session._id);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded cursor-pointer transition-colors"
                        style={{ color: "rgba(255,255,255,0.3)" }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = "#ff2d2d";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "rgba(255,255,255,0.3)";
                        }}
                        title="Delete chat"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                      </button>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Messages area */}
          <div ref={messagesContainerRef} className="absolute inset-0 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                {/* Brain icon */}
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2a7 7 0 0 0-7 7c0 3 1.5 5.5 4 7v3h6v-3c2.5-1.5 4-4 4-7a7 7 0 0 0-7-7z" />
                  <path d="M9 22h6" />
                  <path d="M10 19h4" />
                </svg>
                <p
                  className="text-center leading-relaxed"
                  style={{
                    color: "rgba(255,255,255,0.3)",
                    fontFamily: "var(--font-sans)",
                    fontSize: "14px",
                    maxWidth: "240px",
                  }}
                >
                  Ask me to log a workout or check your stats...
                </p>
                {/* Suggestion chips */}
                <div className="flex flex-wrap justify-center gap-2 mt-1">
                  {["Log bench press", "Show my progress", "What's my PR?"].map(
                    (chip) => (
                      <button
                        key={chip}
                        onClick={() => onSendMessage(chip)}
                        className="px-3 py-1.5 rounded-full text-xs cursor-pointer transition-all"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          color: "rgba(255,255,255,0.45)",
                          fontFamily: "var(--font-sans)",
                          fontSize: "12px",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor =
                            "rgba(255,45,45,0.3)";
                          e.currentTarget.style.color = "#ff2d2d";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor =
                            "rgba(255,255,255,0.08)";
                          e.currentTarget.style.color = "rgba(255,255,255,0.45)";
                        }}
                      >
                        {chip}
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg._id}
                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className="max-w-[85%] px-4 py-3"
                  style={{
                    background:
                      msg.role === "user"
                        ? "rgba(255,45,45,0.08)"
                        : "rgba(255,255,255,0.04)",
                    border:
                      msg.role === "user"
                        ? "1px solid rgba(255,45,45,0.15)"
                        : "1px solid rgba(255,255,255,0.06)",
                    borderRadius:
                      msg.role === "user"
                        ? "1rem 1rem 0.375rem 1rem"
                        : "1rem 1rem 1rem 0.375rem",
                  }}
                >
                  {/* User message images */}
                  {msg.role === "user" && msg.images && msg.images.length > 0 && (
                    <div className="flex flex-wrap gap-1.5" style={{ marginBottom: msg.content ? "8px" : 0 }}>
                      {msg.images.map((img, idx) => (
                        <img
                          key={idx}
                          src={img}
                          alt={`Image ${idx + 1}`}
                          style={{
                            width: "80px",
                            height: "80px",
                            objectFit: "cover",
                            borderRadius: "6px",
                            border: "1px solid rgba(255,255,255,0.1)",
                          }}
                        />
                      ))}
                    </div>
                  )}
                  {msg.role === "assistant" ? (
                    <div
                      className="text-sm leading-relaxed"
                      style={{
                        color: "rgba(255,255,255,0.8)",
                        fontFamily: "var(--font-sans)",
                        fontSize: "14px",
                      }}
                      dangerouslySetInnerHTML={{
                        __html: renderMarkdown(msg.content),
                      }}
                    />
                  ) : msg.content ? (
                    <p
                      className="text-sm leading-relaxed whitespace-pre-wrap"
                      style={{
                        color: "#ebebeb",
                        fontFamily: "var(--font-sans)",
                        fontSize: "14px",
                      }}
                    >
                      {msg.content}
                    </p>
                  ) : null}
                </div>

                {/* Meta line: model badge + timestamp */}
                <div
                  className={`flex items-center gap-2 mt-1 px-1 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  {msg.role === "assistant" && msg.model && (
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "10px",
                        color: "rgba(255,255,255,0.3)",
                      }}
                    >
                      {getModelLabel(msg.model)}
                    </span>
                  )}
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "10px",
                      color: "rgba(255,255,255,0.2)",
                    }}
                  >
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
              </div>
            ))}

            {/* Streaming message — shows tokens as they arrive */}
            {isStreaming && streamingContent && (
              <div className="flex flex-col items-start">
                <div
                  className="max-w-[85%] px-4 py-3"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: "1rem 1rem 1rem 0.375rem",
                  }}
                >
                  <div
                    className="text-sm leading-relaxed"
                    style={{
                      color: "rgba(255,255,255,0.8)",
                      fontFamily: "var(--font-sans)",
                      fontSize: "14px",
                    }}
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdown(streamingContent),
                    }}
                  />
                </div>
              </div>
            )}

            {/* Thinking/loading indicator — when waiting or processing tools */}
            {isStreaming && !streamingContent && (
              <div className="flex items-start">
                <div
                  className="px-4 py-3 flex items-center gap-1.5"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: "1rem 1rem 1rem 0.375rem",
                  }}
                >
                  <span className="chat-dot" style={{ animationDelay: "0ms" }} />
                  <span className="chat-dot" style={{ animationDelay: "150ms" }} />
                  <span className="chat-dot" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input area */}
        <div
          className="shrink-0 px-4 py-3 relative z-20"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          {/* Image preview row */}
          {attachedImages.length > 0 && (
            <div style={{ marginBottom: "8px" }}>
              <div className="flex flex-wrap gap-2">
                {attachedImages.map((img, idx) => (
                  <div
                    key={idx}
                    style={{
                      position: "relative",
                      width: "48px",
                      height: "48px",
                      borderRadius: "8px",
                      overflow: "hidden",
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(255,255,255,0.04)",
                    }}
                  >
                    <img
                      src={img}
                      alt={`Attached ${idx + 1}`}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                    <button
                      onClick={() => setAttachedImages((prev) => prev.filter((_, i) => i !== idx))}
                      style={{
                        position: "absolute",
                        top: "-1px",
                        right: "-1px",
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        background: "rgba(0,0,0,0.7)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        color: "rgba(255,255,255,0.8)",
                        fontSize: "11px",
                        lineHeight: "1",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
              {/* Vision model warning */}
              {NON_VISION_MODELS.includes(selectedModel) && (
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    color: "rgba(255,180,50,0.8)",
                    marginTop: "4px",
                  }}
                >
                  &#9888; This model may not support images
                </div>
              )}
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            style={{ display: "none" }}
          />

          <div className="flex items-end gap-2">
            {/* Attachment button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.4)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,45,45,0.3)";
                e.currentTarget.style.color = "#ff2d2d";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                e.currentTarget.style.color = "rgba(255,255,255,0.4)";
              }}
              title="Attach image"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
            </button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Log a workout or ask a question..."
              disabled={isLoading}
              rows={1}
              className="flex-1 rounded-xl px-4 py-3 text-sm outline-none transition-all resize-none disabled:opacity-50"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#ebebeb",
                fontFamily: "var(--font-sans)",
                fontSize: "16px",
                maxHeight: "120px",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,45,45,0.4)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
              }}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || (!input.trim() && attachedImages.length === 0)}
              className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: "#ff2d2d",
                boxShadow:
                  (input.trim() || attachedImages.length > 0) && !isLoading
                    ? "0 0 16px rgba(255,45,45,0.25)"
                    : "none",
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#000"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
