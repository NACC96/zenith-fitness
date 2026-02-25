"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import ActiveExerciseFeed from "@/components/ActiveExerciseFeed";

const MODELS = [
  { label: "Gemini 3.1 Pro", value: "google/gemini-3.1-pro-preview" },
  { label: "Claude Sonnet 4.6", value: "anthropic/claude-sonnet-4.6" },
  { label: "MiniMax M2.5", value: "minimax/minimax-m2.5" },
  { label: "GLM-5", value: "z-ai/glm-5" },
  { label: "Kimi K2.5", value: "moonshotai/kimi-k2.5" },
  { label: "DeepSeek V3.2", value: "deepseek/deepseek-v3.2" },
];

type StreamHistoryMessage = { role: "user" | "assistant"; content: string; images?: string[] };
type TimedSet = {
  weight: number;
  reps: number;
  startedAt?: number;
  endedAt?: number;
  restStartedAt?: number;
  restEndedAt?: number;
};

type ExerciseDoc = {
  _id: Id<"exercises">;
  name: string;
  sets: TimedSet[];
};

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDuration(ms: number): string {
  const clamped = Math.max(0, ms);
  return formatTimer(Math.floor(clamped / 1000));
}

function getLastRestDurationMs(exercises: ExerciseDoc[]): number | null {
  let latestRestStartedAt = -1;
  let latestRestDuration: number | null = null;

  for (const exercise of exercises) {
    for (const set of exercise.sets) {
      if (set.restStartedAt === undefined || set.restEndedAt === undefined) continue;
      if (set.restStartedAt > latestRestStartedAt) {
        latestRestStartedAt = set.restStartedAt;
        latestRestDuration = Math.max(0, set.restEndedAt - set.restStartedAt);
      }
    }
  }

  return latestRestDuration;
}

function mapFeedExercises(exercises: ExerciseDoc[]) {
  return exercises.map((exercise) => ({
    name: exercise.name,
    sets: exercise.sets.map((set, index) => ({
      setNumber: index + 1,
      ...set,
    })),
  }));
}

export default function WorkoutPage() {
  const router = useRouter();
  const [activeChatSessionId, setActiveChatSessionId] = useState<Id<"chatSessions"> | null>(null);
  const [creatingChatSession, setCreatingChatSession] = useState(false);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [selectedModel, setSelectedModel] = useState("anthropic/claude-sonnet-4.6");
  const [isFinishingWorkout, setIsFinishingWorkout] = useState(false);
  const [shouldAutoCreateSession, setShouldAutoCreateSession] = useState(true);
  const [requestingSession, setRequestingSession] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeSession = useQuery(api.workoutSessions.getActive);
  const createActiveSession = useMutation(api.workoutSessions.createActive);
  const finishActiveSession = useMutation(api.workoutSessions.finishActive);
  const removeSession = useMutation(api.workoutSessions.remove);
  const createChatSession = useMutation(api.chatSessions.create);
  const sendChatMessage = useMutation(api.chatMessages.send);
  const exercisesRaw = useQuery(
    api.exercises.listBySession,
    activeSession ? { sessionId: activeSession._id } : "skip",
  );
  const liveTiming = useQuery(
    api.workoutSessions.getLiveTimingState,
    activeSession ? { sessionId: activeSession._id } : "skip",
  );
  const chatMessages =
    useQuery(
      api.chatMessages.list,
      activeChatSessionId ? { sessionId: activeChatSessionId } : "skip",
    ) ?? [];

  const exercises = (exercisesRaw ?? []) as ExerciseDoc[];

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, streamingContent]);

  useEffect(() => {
    if (!shouldAutoCreateSession || activeSession !== null || requestingSession) return;

    setRequestingSession(true);
    void createActiveSession({ type: "General" })
      .catch((error) => {
        console.error("Failed to create active session:", error);
      })
      .finally(() => {
        setRequestingSession(false);
      });
  }, [activeSession, createActiveSession, requestingSession, shouldAutoCreateSession]);

  useEffect(() => {
    if (!activeSession?._id) {
      setActiveChatSessionId(null);
      return;
    }
    if (activeChatSessionId || creatingChatSession) return;

    const storageKey = `workout-chat-session:${activeSession._id}`;
    const storedSessionId = window.sessionStorage.getItem(storageKey);
    if (storedSessionId) {
      setActiveChatSessionId(storedSessionId as Id<"chatSessions">);
      return;
    }

    setCreatingChatSession(true);
    void createChatSession()
      .then((sessionId) => {
        setActiveChatSessionId(sessionId);
        window.sessionStorage.setItem(storageKey, sessionId);
      })
      .catch((error) => {
        console.error("Failed to create workout chat session:", error);
      })
      .finally(() => {
        setCreatingChatSession(false);
      });
  }, [activeSession?._id, activeChatSessionId, creatingChatSession, createChatSession]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if ((!trimmed && attachedImages.length === 0) || isStreaming || !activeChatSessionId) return;
    const imagesToSend = attachedImages.length > 0 ? attachedImages : undefined;
    setInput("");
    setAttachedImages([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      await sendChatMessage({
        sessionId: activeChatSessionId,
        content: trimmed,
        images: imagesToSend,
        model: selectedModel,
      });

      const messageHistory: StreamHistoryMessage[] = chatMessages.slice(-20).map((message) => ({
        role: message.role,
        content: message.content,
        ...(message.images ? { images: message.images } : {}),
      }));

      setIsStreaming(true);
      setStreamingContent("");

      const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
      const baseUrl =
        siteUrl ||
        (process.env.NEXT_PUBLIC_CONVEX_URL?.replace(".cloud", ".site") ?? "");
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeChatSessionId,
          content: trimmed,
          images: imagesToSend,
          model: selectedModel,
          messageHistory,
          workoutSessionId: activeSession?._id,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (!data) continue;

          try {
            const parsed = JSON.parse(data) as {
              token?: string;
              done?: boolean;
              error?: string;
              thinking?: boolean;
            };

            if (parsed.token) {
              accumulated += parsed.token;
              setStreamingContent(accumulated);
              continue;
            }
            if (parsed.done || parsed.error) {
              break;
            }
          } catch {
            // Ignore malformed chunks.
          }
        }
      }
    } catch (error) {
      console.error("Workout chat streaming failed:", error);
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files).filter(f => f.type.startsWith("image/"));
    if (files.length === 0) return;
    e.preventDefault();
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setAttachedImages(prev => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith("image/"));
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setAttachedImages(prev => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
    if (e.target) e.target.value = "";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const hasFirstSetTiming =
    liveTiming?.firstSetStartedAt !== null &&
    liveTiming?.firstSetStartedAt !== undefined;
  const workoutElapsedMs = useMemo(() => {
    if (hasFirstSetTiming) {
      const start = liveTiming?.firstSetStartedAt ?? nowMs;
      const end = liveTiming?.lastSetEndedAt ?? nowMs;
      return Math.max(0, end - start);
    }

    if (activeSession?.startTime !== undefined) {
      return Math.max(0, nowMs - activeSession.startTime);
    }

    return 0;
  }, [
    activeSession?.startTime,
    hasFirstSetTiming,
    liveTiming?.firstSetStartedAt,
    liveTiming?.lastSetEndedAt,
    nowMs,
  ]);

  const activeSetElapsedMs = liveTiming?.activeSet
    ? Math.max(0, nowMs - liveTiming.activeSet.startedAt)
    : null;
  const activeRestElapsedMs = liveTiming?.activeRest
    ? Math.max(0, nowMs - liveTiming.activeRest.startedAt)
    : null;
  const lastRestMs = useMemo(() => getLastRestDurationMs(exercises), [exercises]);
  const feedExercises = useMemo(() => mapFeedExercises(exercises), [exercises]);

  const handleExitWorkout = async () => {
    if (!activeSession) return;
    if (!confirm("Exit and delete this workout session?")) return;
    setShouldAutoCreateSession(false);
    try {
      await removeSession({ sessionId: activeSession._id });
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
    router.push("/dashboard");
  };

  const handleFinishWorkout = async () => {
    if (isFinishingWorkout) return;
    setIsFinishingWorkout(true);
    setShouldAutoCreateSession(false);
    try {
      if (activeSession) {
        await finishActiveSession({ sessionId: activeSession._id });
      }
      router.push("/dashboard");
    } catch (error) {
      console.error("Failed to finish workout:", error);
      setShouldAutoCreateSession(true);
      setIsFinishingWorkout(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen h-[100dvh]" style={{ background: "#0a0a0a" }}>
      <div
        className="shrink-0 flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={handleExitWorkout}
            className="flex items-center justify-center rounded-lg cursor-pointer"
            style={{
              width: 36,
              height: 36,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.4)",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "rgba(255,255,255,0.7)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(255,255,255,0.4)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
            }}
            aria-label="Exit workout and delete session"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: "#ff2d2d",
              animation: "chatPulse 2s ease-in-out infinite",
            }}
          />
          <span
            className="text-xs uppercase tracking-widest px-2 py-0.5 rounded-md"
            style={{
              fontFamily: "var(--font-mono)",
              color: "rgba(255,45,45,0.8)",
              background: "rgba(255,45,45,0.08)",
              border: "1px solid rgba(255,45,45,0.15)",
            }}
          >
            {activeSession?.type || "General"}
          </span>
          <span
            className="text-lg tracking-widest"
            style={{
              fontFamily: "var(--font-mono)",
              color: "#ebebeb",
            }}
          >
            {formatDuration(workoutElapsedMs)}
          </span>
          <span
            className="text-[10px] uppercase tracking-widest"
            style={{
              fontFamily: "var(--font-mono)",
              color: "rgba(255,255,255,0.3)",
            }}
          >
            {hasFirstSetTiming ? "First-set elapsed" : "Session elapsed"}
          </span>
        </div>

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleFinishWorkout}
          disabled={isFinishingWorkout}
          aria-label="Finish workout and return to dashboard"
          className="px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            background: "rgba(255,45,45,0.12)",
            border: "1px solid rgba(255,45,45,0.3)",
            color: "#ff2d2d",
            fontFamily: "var(--font-display)",
          }}
        >
          {isFinishingWorkout ? "Finishing..." : "Finish Workout"}
        </motion.button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {/* Timer status bar */}
        <div
          className="shrink-0 flex flex-wrap items-center gap-2 px-4 py-2"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          {activeSetElapsedMs !== null && liveTiming?.activeSet && (
            <span className="font-mono text-[10px] text-[#ff2d2d]">
              Active set {formatDuration(activeSetElapsedMs)} · {liveTiming.activeSet.exerciseName}
            </span>
          )}
          {activeRestElapsedMs !== null && (
            <span className="font-mono text-[10px] text-white/60">
              Rest {formatDuration(activeRestElapsedMs)}
            </span>
          )}
          {activeRestElapsedMs === null && lastRestMs !== null && (
            <span className="font-mono text-[10px] text-white/40">
              Last rest {formatDuration(lastRestMs)}
            </span>
          )}
          {!activeSetElapsedMs && !activeRestElapsedMs && !lastRestMs && (
            <span className="font-mono text-[10px] text-white/30">
              Ready — tell me what you&apos;re lifting
            </span>
          )}
        </div>

        <div className="flex-1 min-h-0">
          <ActiveExerciseFeed
            exercises={feedExercises}
            activeSet={
              liveTiming?.activeSet
                ? {
                    exerciseName: liveTiming.activeSet.exerciseName,
                    elapsedMs: activeSetElapsedMs ?? 0,
                  }
                : null
            }
            activeRestMs={activeRestElapsedMs}
            lastRestMs={lastRestMs}
          />
        </div>
      </div>

      <div
        className="shrink-0 flex flex-col h-[40vh]"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(10,10,10,0.95)",
          backdropFilter: "blur(24px)",
        }}
      >
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

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {chatMessages.length === 0 && !isStreaming && (
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

          {chatMessages.map((msg) => (
            <div
              key={msg._id}
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
                {msg.role === "user" && msg.images && msg.images.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap mb-2">
                    {msg.images.map((img: string, i: number) => (
                      <img
                        key={i}
                        src={img}
                        alt={`Image ${i + 1}`}
                        style={{
                          width: 80,
                          height: 80,
                          objectFit: "cover",
                          borderRadius: 8,
                          border: "1px solid rgba(255,255,255,0.1)",
                        }}
                      />
                    ))}
                  </div>
                )}
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

          {isStreaming && (
            <div className="flex items-start">
              <div
                className="px-3 py-2.5 flex items-center gap-1.5"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "0.875rem 0.875rem 0.875rem 0.25rem",
                }}
              >
                {streamingContent ? (
                  <p
                    className="text-sm leading-relaxed whitespace-pre-wrap"
                    style={{
                      color: "rgba(255,255,255,0.8)",
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                    }}
                  >
                    {streamingContent}
                  </p>
                ) : (
                  <>
                    <span className="chat-dot" style={{ animationDelay: "0ms" }} />
                    <span className="chat-dot" style={{ animationDelay: "150ms" }} />
                    <span className="chat-dot" style={{ animationDelay: "300ms" }} />
                  </>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div
          className="shrink-0 px-4 py-2.5"
          style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
        >
          {attachedImages.length > 0 && (
            <div className="flex gap-2 flex-wrap px-1 pb-2">
              {attachedImages.map((img, i) => (
                <div key={i} className="relative group" style={{ width: 48, height: 48 }}>
                  <img
                    src={img}
                    alt={`Attached ${i + 1}`}
                    style={{
                      width: 48,
                      height: 48,
                      objectFit: "cover",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  />
                  <button
                    onClick={() => setAttachedImages(prev => prev.filter((_, idx) => idx !== i))}
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -6,
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "rgba(0,0,0,0.8)",
                      border: "1px solid rgba(255,255,255,0.2)",
                      color: "#fff",
                      fontSize: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming}
              aria-label="Attach image"
              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all disabled:opacity-30"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              aria-label="Workout chat input"
              placeholder="Log a set or ask for help..."
              disabled={isStreaming || !activeChatSessionId}
              rows={1}
              className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none resize-none disabled:opacity-50"
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
              onClick={() => {
                void handleSend();
              }}
              disabled={isStreaming || (!input.trim() && attachedImages.length === 0) || !activeChatSessionId}
              aria-label="Send workout message"
              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: "#ff2d2d",
                boxShadow:
                  (input.trim() || attachedImages.length > 0) && !isStreaming
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
