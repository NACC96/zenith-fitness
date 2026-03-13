"use client";

import React, { Suspense, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { WorkoutProvider } from "@/contexts/WorkoutContext";
import TabBar from "@/components/workout/TabBar";

export const dynamic = "force-dynamic";

const TrackTab = React.lazy(() => import("@/components/workout/TrackTab"));
const ChatTab = React.lazy(() => import("@/components/workout/ChatTab"));

// ---------------------------------------------------------------------------
// StartWorkoutScreen – pick a workout type or go back to dashboard
// ---------------------------------------------------------------------------
function StartWorkoutScreen({
  onStart,
}: {
  onStart: (args: { workoutTypeId?: Id<"workoutTypes">; type?: string }) => void;
}) {
  const workoutTypes = useQuery(api.workoutTypes.list);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-black px-6">
      <h1
        className="mb-8 text-2xl font-bold tracking-tight text-white"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Start a Workout
      </h1>

      {workoutTypes === undefined ? (
        <p className="text-sm text-zinc-500">Loading workout types…</p>
      ) : workoutTypes.length === 0 ? (
        <button
          onClick={() => onStart({ type: "General" })}
          className="w-full max-w-xs rounded-2xl bg-white px-6 py-4 text-center text-sm font-semibold text-black transition-transform active:scale-95"
        >
          General Workout
        </button>
      ) : (
        <div className="flex w-full max-w-xs flex-col gap-3">
          {workoutTypes.map((wt) => (
            <button
              key={wt._id}
              onClick={() => onStart({ workoutTypeId: wt._id, type: wt.name })}
              className="w-full rounded-2xl bg-zinc-900 px-6 py-4 text-center text-sm font-semibold text-white border border-zinc-800 transition-transform active:scale-95"
            >
              {wt.name}
            </button>
          ))}
        </div>
      )}

      <a
        href="/dashboard"
        className="mt-10 text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-300 transition-colors"
      >
        Back to Dashboard
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActiveWorkoutShell – tab container with Finish / Exit controls
// ---------------------------------------------------------------------------
function ActiveWorkoutShell({ sessionId }: { sessionId: Id<"workoutSessions"> }) {
  const router = useRouter();
  const finishActive = useMutation(api.workoutSessions.finishActive);
  const removeSession = useMutation(api.workoutSessions.remove);

  const [activeTab, setActiveTab] = useState<"track" | "chat">("track");
  const [isFinishing, setIsFinishing] = useState(false);

  const handleFinish = useCallback(async () => {
    if (isFinishing) return;
    if (!confirm("Finish this workout?")) return;
    setIsFinishing(true);
    try {
      await finishActive({ sessionId });
      router.push("/dashboard");
    } catch (err) {
      console.error("Failed to finish workout:", err);
      setIsFinishing(false);
    }
  }, [finishActive, isFinishing, router, sessionId]);

  const handleExit = useCallback(async () => {
    if (!confirm("Exit and delete this workout session?")) return;
    try {
      await removeSession({ sessionId });
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
    router.push("/dashboard");
  }, [removeSession, router, sessionId]);

  return (
    <WorkoutProvider sessionId={sessionId}>
      <div className="flex h-[100dvh] flex-col overflow-hidden bg-black">
        {/* Top bar: Exit + Finish */}
        <div
          className="flex shrink-0 items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <button
            onClick={() => void handleExit()}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-white"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            Exit
          </button>

          <button
            onClick={() => void handleFinish()}
            disabled={isFinishing}
            className="rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: "rgba(255,45,45,0.12)",
              border: "1px solid rgba(255,45,45,0.3)",
              color: "#ff2d2d",
              fontFamily: "var(--font-display)",
            }}
          >
            {isFinishing ? "Finishing…" : "Finish Workout"}
          </button>
        </div>

        {/* Tab content – both tabs stay mounted */}
        <div className="relative flex-1 min-h-0 overflow-hidden">
          <div style={{ display: activeTab === "track" ? "block" : "none" }} className="h-full overflow-y-auto">
            <Suspense fallback={<TabFallback />}>
              <TrackTab />
            </Suspense>
          </div>

          <div
            className="h-full overflow-y-auto"
            style={{
              visibility: activeTab === "chat" ? "visible" : "hidden",
              position: activeTab === "chat" ? "relative" : "absolute",
              top: 0,
              left: 0,
              right: 0,
            }}
          >
            <Suspense fallback={<TabFallback />}>
              <ChatTab isVisible={activeTab === "chat"} />
            </Suspense>
          </div>
        </div>

        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </WorkoutProvider>
  );
}

function TabFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-sm text-zinc-600">Loading…</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page (default export) – session lifecycle router
// ---------------------------------------------------------------------------
export default function WorkoutPage() {
  const activeSession = useQuery(api.workoutSessions.getActive);
  const createActive = useMutation(api.workoutSessions.createActive);
  const [isCreating, setIsCreating] = useState(false);

  const handleStart = useCallback(
    async (args: { workoutTypeId?: Id<"workoutTypes">; type?: string }) => {
      if (isCreating) return;
      setIsCreating(true);
      try {
        await createActive(args);
      } catch (err) {
        console.error("Failed to create session:", err);
        setIsCreating(false);
      }
    },
    [createActive, isCreating],
  );

  // Still loading from Convex
  if (activeSession === undefined) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-black">
        <p className="text-sm text-zinc-500">Loading…</p>
      </div>
    );
  }

  // No active session → pick a workout type
  if (activeSession === null) {
    return <StartWorkoutScreen onStart={(args) => void handleStart(args)} />;
  }

  // Active session → render workout shell
  return <ActiveWorkoutShell sessionId={activeSession._id} />;
}
