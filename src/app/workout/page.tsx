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

type StreamHistoryMessage = { role: "user" | "assistant"; content: string };
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
  const [selectedModel, setSelectedModel] = useState("google/gemini-3.1-pro-preview");
  const [exerciseName, setExerciseName] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [isStartingSet, setIsStartingSet] = useState(false);
  const [isCompletingSet, setIsCompletingSet] = useState(false);
  const [isFinishingWorkout, setIsFinishingWorkout] = useState(false);
  const [shouldAutoCreateSession, setShouldAutoCreateSession] = useState(true);
  const [requestingSession, setRequestingSession] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeSession = useQuery(api.workoutSessions.getActive);
  const createActiveSession = useMutation(api.workoutSessions.createActive);
  const finishActiveSession = useMutation(api.workoutSessions.finishActive);
  const createChatSession = useMutation(api.chatSessions.create);
  const sendChatMessage = useMutation(api.chatMessages.send);
  const startSet = useMutation(api.exercises.startSet);
  const completeSet = useMutation(api.exercises.completeSet);
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
    if (!exerciseName && liveTiming?.activeSet?.exerciseName) {
      setExerciseName(liveTiming.activeSet.exerciseName);
    }
  }, [exerciseName, liveTiming?.activeSet?.exerciseName]);

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
    if (!trimmed || isStreaming || !activeChatSessionId) return;
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      await sendChatMessage({
        sessionId: activeChatSessionId,
        content: trimmed,
        model: selectedModel,
      });

      const messageHistory: StreamHistoryMessage[] = chatMessages.slice(-20).map((message) => ({
        role: message.role,
        content: message.content,
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

  const parsedWeight = Number(weight);
  const parsedReps = Number(reps);
  const targetExerciseName = (
    liveTiming?.activeSet?.exerciseName ?? exerciseName
  ).trim();

  const canStartSet =
    Boolean(activeSession) &&
    exerciseName.trim().length > 0 &&
    !isStartingSet &&
    !isCompletingSet;
  const canCompleteSet =
    Boolean(activeSession) &&
    targetExerciseName.length > 0 &&
    Number.isFinite(parsedWeight) &&
    Number.isFinite(parsedReps) &&
    parsedWeight > 0 &&
    parsedReps > 0 &&
    !isCompletingSet &&
    !isStartingSet;

  const handleStartSet = async () => {
    if (!activeSession || !canStartSet) return;
    setIsStartingSet(true);
    try {
      await startSet({
        sessionId: activeSession._id,
        exerciseName: exerciseName.trim(),
      });
    } catch (error) {
      console.error("Failed to start set:", error);
    } finally {
      setIsStartingSet(false);
    }
  };

  const handleCompleteSet = async () => {
    if (!activeSession || !canCompleteSet) return;
    setIsCompletingSet(true);
    try {
      await completeSet({
        sessionId: activeSession._id,
        exerciseName: targetExerciseName,
        weight: parsedWeight,
        reps: parsedReps,
      });
      setWeight("");
      setReps("");
    } catch (error) {
      console.error("Failed to complete set:", error);
    } finally {
      setIsCompletingSet(false);
    }
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
        <div
          className="shrink-0 px-4 py-3 border-b border-white/[0.06] space-y-2"
          style={{ background: "rgba(255,255,255,0.01)" }}
        >
          <div className="grid grid-cols-12 gap-2">
            <input
              value={exerciseName}
              onChange={(e) => setExerciseName(e.target.value)}
              placeholder="Exercise name"
              className="col-span-12 sm:col-span-5 rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#ebebeb",
                fontFamily: "var(--font-sans)",
              }}
            />
            <input
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              type="number"
              inputMode="decimal"
              min="0"
              placeholder="Weight"
              className="col-span-6 sm:col-span-2 rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#ebebeb",
                fontFamily: "var(--font-sans)",
              }}
            />
            <input
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="Reps"
              className="col-span-6 sm:col-span-2 rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#ebebeb",
                fontFamily: "var(--font-sans)",
              }}
            />
            <button
              onClick={handleStartSet}
              disabled={!canStartSet}
              className="col-span-6 sm:col-span-1 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "rgba(255,45,45,0.16)",
                border: "1px solid rgba(255,45,45,0.3)",
                color: "#ff2d2d",
                fontFamily: "var(--font-display)",
              }}
            >
              {isStartingSet ? "..." : "Start"}
            </button>
            <button
              onClick={handleCompleteSet}
              disabled={!canCompleteSet}
              className="col-span-6 sm:col-span-2 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.85)",
                fontFamily: "var(--font-display)",
              }}
            >
              {isCompletingSet ? "Logging..." : "Complete Set"}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-white/45">
              {activeSession ? `Session ${activeSession._id.slice(-6)}` : "Preparing session..."}
            </span>
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
          </div>
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
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
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
              onClick={() => {
                void handleSend();
              }}
              disabled={isStreaming || !input.trim() || !activeChatSessionId}
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
