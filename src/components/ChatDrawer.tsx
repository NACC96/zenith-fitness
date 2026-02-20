"use client";

import { useState, useRef, useEffect } from "react";

interface ChatMessage {
  _id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  timestamp: number;
}

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  isLoading: boolean;
  selectedModel: string;
  onModelChange: (model: string) => void;
  onClearChat: () => void;
}

const MODELS = [
  { label: "Gemini 3.1 Pro", value: "google/gemini-3.1-pro-preview" },
  { label: "Claude Sonnet 4.6", value: "anthropic/claude-sonnet-4.6" },
  { label: "MiniMax M2.5", value: "minimax/minimax-m2.5" },
  { label: "GLM-5", value: "z-ai/glm-5" },
  { label: "Kimi K2.5", value: "moonshotai/kimi-k2.5" },
  { label: "DeepSeek V3.2", value: "deepseek/deepseek-v3.2" },
];

function getModelLabel(value: string): string {
  return MODELS.find((m) => m.value === value)?.label ?? value;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
}: ChatDrawerProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Focus input when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSendMessage(trimmed);
    setInput("");
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
          className="flex items-center gap-3 px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
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
              IronLog AI
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

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
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
                ) : (
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
                )}
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

          {/* Loading indicator */}
          {isLoading && (
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

        {/* Input area */}
        <div
          className="shrink-0 px-4 py-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              placeholder="Log a workout or ask a question..."
              disabled={isLoading}
              rows={1}
              className="flex-1 rounded-xl px-4 py-3 text-sm outline-none transition-all resize-none disabled:opacity-50"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#ebebeb",
                fontFamily: "var(--font-sans)",
                fontSize: "14px",
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
              disabled={isLoading || !input.trim()}
              className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: "#ff2d2d",
                boxShadow:
                  input.trim() && !isLoading
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
