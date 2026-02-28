"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import WorkoutFocusPanel, { type WorkoutFocusState } from "@/components/WorkoutFocusPanel";
import WorkoutExerciseHistorySheet from "@/components/WorkoutExerciseHistorySheet";
import WorkoutChatOverlay, { type WorkoutChatMessage } from "@/components/WorkoutChatOverlay";
import type { FeedExercise, LatestCompletedSet } from "@/components/workout/types";
import { formatDuration } from "@/lib/utils";

export const dynamic = "force-dynamic";

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

function mapFeedExercises(exercises: ExerciseDoc[]): FeedExercise[] {
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
  const isSendingRef = useRef(false);
  const [activeChatSessionId, setActiveChatSessionId] = useState<Id<"chatSessions"> | null>(null);
  const [creatingChatSession, setCreatingChatSession] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [selectedModel, setSelectedModel] = useState("anthropic/claude-sonnet-4.6");
  const [isFinishingWorkout, setIsFinishingWorkout] = useState(false);
  const [shouldAutoCreateSession, setShouldAutoCreateSession] = useState(true);
  const [requestingSession, setRequestingSession] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

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
  const chatMessagesRaw = useQuery(
    api.chatMessages.list,
    activeChatSessionId ? { sessionId: activeChatSessionId } : "skip",
  );
  const chatMessages = useMemo(() => (chatMessagesRaw ?? []) as WorkoutChatMessage[], [chatMessagesRaw]);
  const exercises = useMemo(() => (exercisesRaw ?? []) as ExerciseDoc[], [exercisesRaw]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const syncNow = () => {
      setNowMs(Date.now());
    };

    document.addEventListener("visibilitychange", syncNow);
    window.addEventListener("focus", syncNow);

    return () => {
      document.removeEventListener("visibilitychange", syncNow);
      window.removeEventListener("focus", syncNow);
    };
  }, []);

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

  const handleSend = async (content: string, images?: string[]) => {
    const trimmed = content.trim();
    if (
      (!trimmed && (!images || images.length === 0)) ||
      isStreaming ||
      isSendingRef.current ||
      !activeChatSessionId
    ) {
      return;
    }
    const imagesToSend = images && images.length > 0 ? images : undefined;
    isSendingRef.current = true;
    setIsStreaming(true);
    setStreamingContent("");

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
      let shouldStop = false;

      while (!shouldStop) {
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
              shouldStop = true;
              break;
            }
          } catch {
            // Ignore malformed chunks.
          }
        }
      }

      if (shouldStop) {
        await reader.cancel().catch(() => {});
      }
    } catch (error) {
      console.error("Workout chat streaming failed:", error);
    } finally {
      isSendingRef.current = false;
      setIsStreaming(false);
      setStreamingContent("");
    }
  };

  const hasFirstSetTiming =
    liveTiming?.firstSetStartedAt !== null &&
    liveTiming?.firstSetStartedAt !== undefined;

  const workoutStartMs = liveTiming?.firstSetStartedAt ?? activeSession?.startTime ?? null;
  const workoutElapsedMs = useMemo(() => {
    if (workoutStartMs === null) return 0;
    const isCompleted = liveTiming?.status === "completed";
    const endMs = isCompleted ? (liveTiming?.lastSetEndedAt ?? nowMs) : nowMs;
    return Math.max(0, endMs - workoutStartMs);
  }, [liveTiming?.lastSetEndedAt, liveTiming?.status, nowMs, workoutStartMs]);

  const activeSetElapsedMs = liveTiming?.activeSet
    ? Math.max(0, nowMs - liveTiming.activeSet.startedAt)
    : null;
  const activeRestElapsedMs = liveTiming?.activeRest
    ? Math.max(0, nowMs - liveTiming.activeRest.startedAt)
    : null;
  const lastRestMs = useMemo(() => getLastRestDurationMs(exercises), [exercises]);
  const feedExercises = useMemo(() => mapFeedExercises(exercises), [exercises]);
  const totalSetCount = useMemo(
    () => feedExercises.reduce((sum, exercise) => sum + exercise.sets.length, 0),
    [feedExercises],
  );
  const totalVolume = useMemo(
    () =>
      feedExercises.reduce(
        (sum, exercise) =>
          sum +
          exercise.sets.reduce((exerciseSum, set) => exerciseSum + set.weight * set.reps, 0),
        0,
      ),
    [feedExercises],
  );
  const latestCompletedSet = useMemo<LatestCompletedSet | null>(() => {
    let latest: LatestCompletedSet | null = null;
    for (const exercise of feedExercises) {
      for (const set of exercise.sets) {
        if (set.endedAt === undefined) continue;
        if (!latest || (latest.endedAt ?? -1) < set.endedAt) {
          latest = {
            exerciseName: exercise.name,
            setNumber: set.setNumber,
            weight: set.weight,
            reps: set.reps,
            endedAt: set.endedAt,
          };
        }
      }
    }

    if (latest) return latest;

    if (feedExercises.length === 0) return null;
    const fallbackExercise = feedExercises[feedExercises.length - 1];
    const fallbackSet = fallbackExercise.sets[fallbackExercise.sets.length - 1];
    if (!fallbackSet) return null;

    return {
      exerciseName: fallbackExercise.name,
      setNumber: fallbackSet.setNumber,
      weight: fallbackSet.weight,
      reps: fallbackSet.reps,
      endedAt: fallbackSet.endedAt ?? null,
    };
  }, [feedExercises]);
  const focusState: WorkoutFocusState = useMemo(() => {
    if (liveTiming?.activeSet) return "activeSet";
    if (activeRestElapsedMs !== null) return "rest";
    if (totalSetCount > 0) return "ready";
    return "empty";
  }, [liveTiming?.activeSet, activeRestElapsedMs, totalSetCount]);
  const activeExerciseName =
    liveTiming?.activeSet?.exerciseName ?? latestCompletedSet?.exerciseName ?? null;

  const handleExitWorkout = async () => {
    if (!activeSession) return;
    if (!confirm("Exit and delete this workout session?")) return;
    setShouldAutoCreateSession(false);
    setIsHistoryOpen(false);
    setIsChatOpen(false);
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
    setIsHistoryOpen(false);
    setIsChatOpen(false);
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

  const openChat = useCallback(() => {
    setIsChatOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsChatOpen(false);
  }, []);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden" style={{ background: "#0a0a0a" }}>
      <div
        className="shrink-0 flex items-center justify-between gap-3 px-4 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="min-w-0 flex items-center gap-2.5 overflow-hidden">
          <button
            onClick={handleExitWorkout}
            className="shrink-0 flex items-center justify-center rounded-lg cursor-pointer"
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
            <svg
              aria-hidden="true"
              focusable="false"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <div
            className="shrink-0 w-2 h-2 rounded-full"
            style={{
              background: "#ff2d2d",
              animation: "chatPulse 2s ease-in-out infinite",
            }}
          />

          <span
            className="text-xs uppercase tracking-widest px-2 py-0.5 rounded-md min-w-0 max-w-[110px] truncate"
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
            className="shrink-0 text-lg tracking-widest"
            style={{
              fontFamily: "var(--font-mono)",
              color: "#ebebeb",
            }}
          >
            {formatDuration(workoutElapsedMs)}
          </span>

          <span
            className="text-[10px] uppercase tracking-widest min-w-0 truncate"
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
          className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
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

      <div className="flex-1 min-h-0 overflow-hidden">
        <WorkoutFocusPanel
          focusState={focusState}
          activeExerciseName={activeExerciseName}
          activeSetElapsedMs={activeSetElapsedMs}
          activeRestMs={activeRestElapsedMs}
          lastRestMs={lastRestMs}
          latestCompletedSet={latestCompletedSet}
          exerciseCount={feedExercises.length}
          totalSetCount={totalSetCount}
          totalVolume={totalVolume}
          onOpenHistory={() => {
            setIsChatOpen(false);
            setIsHistoryOpen(true);
          }}
        />
      </div>

      <WorkoutChatOverlay
        isOpen={isChatOpen}
        onOpen={openChat}
        onClose={closeChat}
        messages={chatMessages}
        isStreaming={isStreaming}
        streamingContent={streamingContent}
        selectedModel={selectedModel}
        models={MODELS}
        onModelChange={setSelectedModel}
        onSendMessage={handleSend}
        isInputDisabled={isStreaming || !activeChatSessionId || creatingChatSession}
      />

      <WorkoutExerciseHistorySheet
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        exercises={feedExercises}
        activeExerciseName={activeExerciseName}
        totalSetCount={totalSetCount}
        totalVolume={totalVolume}
      />
    </div>
  );
}
