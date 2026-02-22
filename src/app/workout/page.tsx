"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

const MODELS = [
  { label: "Gemini 3.1 Pro", value: "google/gemini-3.1-pro-preview" },
  { label: "Claude Sonnet 4.6", value: "anthropic/claude-sonnet-4.6" },
  { label: "MiniMax M2.5", value: "minimax/minimax-m2.5" },
  { label: "GLM-5", value: "z-ai/glm-5" },
  { label: "Kimi K2.5", value: "moonshotai/kimi-k2.5" },
  { label: "DeepSeek V3.2", value: "deepseek/deepseek-v3.2" },
];

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function WorkoutPage() {
  const router = useRouter();
  const [elapsed, setElapsed] = useState(0);
  const [messages] = useState<{ id: string; role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming] = useState(false);
  const [streamingContent] = useState("");
  const [selectedModel, setSelectedModel] = useState("google/gemini-3.1-pro-preview");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Timer counting up from mount
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    // Placeholder — actual send wiring in Wave 2
    setInput("");
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
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  return (
    <div className="flex flex-col min-h-screen h-[100dvh]" style={{ background: "#0a0a0a" }}>
      {/* ── Top Bar ──────────────────────────────────────── */}
      <div
        className="shrink-0 flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* Timer */}
        <div className="flex items-center gap-3">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: "#ff2d2d",
              animation: "chatPulse 2s ease-in-out infinite",
            }}
          />
          <span
            className="text-lg tracking-widest"
            style={{
              fontFamily: "var(--font-mono)",
              color: "#ebebeb",
            }}
          >
            {formatTimer(elapsed)}
          </span>
          <span
            className="text-[10px] uppercase tracking-widest"
            style={{
              fontFamily: "var(--font-mono)",
              color: "rgba(255,255,255,0.3)",
            }}
          >
            Workout Active
          </span>
        </div>

        {/* Finish Workout */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => router.push("/dashboard")}
          aria-label="Finish workout and return to dashboard"
          className="px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer"
          style={{
            background: "rgba(255,45,45,0.12)",
            border: "1px solid rgba(255,45,45,0.3)",
            color: "#ff2d2d",
            fontFamily: "var(--font-display)",
          }}
        >
          Finish Workout
        </motion.button>
      </div>

      {/* ── Exercise Feed (top ~60%) ─────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-6 min-h-0">
        <div className="flex flex-col items-center justify-center h-full gap-4">
          {/* Dumbbell icon */}
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6.5 6.5h11v11h-11z" opacity="0" />
            <rect x="2" y="9" width="3" height="6" rx="1" />
            <rect x="19" y="9" width="3" height="6" rx="1" />
            <rect x="5" y="7" width="3" height="10" rx="1" />
            <rect x="16" y="7" width="3" height="10" rx="1" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          <p
            className="text-center leading-relaxed"
            style={{
              color: "rgba(255,255,255,0.25)",
              fontFamily: "var(--font-sans)",
              fontSize: "14px",
              maxWidth: "260px",
            }}
          >
            Your exercises will appear here as you log them
          </p>
          <span
            className="text-[10px] uppercase tracking-widest"
            style={{
              fontFamily: "var(--font-mono)",
              color: "rgba(255,255,255,0.15)",
            }}
          >
            Chat below to get started
          </span>
        </div>
      </div>

      {/* ── Chat Area (bottom ~40vh) ─────────────────────── */}
      <div
        className="shrink-0 flex flex-col h-[40vh]"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(10,10,10,0.95)",
          backdropFilter: "blur(24px)",
        }}
      >
        {/* Chat header */}
        <div
          className="shrink-0 flex items-center justify-between px-4 py-2.5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: "#ff2d2d",
                animation: "chatPulse 2s ease-in-out infinite",
              }}
            />
            <span
              className="font-semibold"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                color: "#ebebeb",
              }}
            >
              Zenith AI
            </span>
          </div>

          {/* Model selector */}
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            aria-label="Select AI model"
            className="rounded-lg px-2 py-1 outline-none cursor-pointer"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.5)",
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
            }}
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <p
                className="text-center"
                style={{
                  color: "rgba(255,255,255,0.25)",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                }}
              >
                Tell me what you&apos;re working on today...
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-1">
                {["Log bench press 3×10", "Suggest a push day", "Track my squats"].map(
                  (chip) => (
                    <button
                      key={chip}
                      onClick={() => setInput(chip)}
                      className="px-3 py-1.5 rounded-full text-xs cursor-pointer transition-all"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: "rgba(255,255,255,0.4)",
                        fontFamily: "var(--font-sans)",
                        fontSize: "11px",
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
              key={msg.id}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className="max-w-[85%] px-3 py-2.5"
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
                      ? "0.875rem 0.875rem 0.25rem 0.875rem"
                      : "0.875rem 0.875rem 0.875rem 0.25rem",
                }}
              >
                <p
                  className="text-sm leading-relaxed whitespace-pre-wrap"
                  style={{
                    color: msg.role === "user" ? "#ebebeb" : "rgba(255,255,255,0.8)",
                    fontFamily: "var(--font-sans)",
                    fontSize: "13px",
                  }}
                >
                  {msg.content}
                </p>
              </div>
            </div>
          ))}

          {/* Streaming indicator placeholder */}
          {isStreaming && !streamingContent && (
            <div className="flex items-start">
              <div
                className="px-3 py-2.5 flex items-center gap-1.5"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "0.875rem 0.875rem 0.875rem 0.25rem",
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

        {/* Input bar */}
        <div
          className="shrink-0 px-4 py-2.5"
          style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
        >
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              aria-label="Workout chat input"
              placeholder="Log a set or ask for help..."
              disabled={isStreaming}
              rows={1}
              className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none resize-none disabled:opacity-50"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#ebebeb",
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
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
              disabled={isStreaming || !input.trim()}
              aria-label="Send workout message"
              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: "#ff2d2d",
                boxShadow:
                  input.trim() && !isStreaming
                    ? "0 0 12px rgba(255,45,45,0.25)"
                    : "none",
              }}
            >
              <svg
                width="16"
                height="16"
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
    </div>
  );
}
