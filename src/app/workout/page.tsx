"use client";

import React, { Suspense, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { WorkoutProvider } from "@/contexts/WorkoutContext";
import TabBar, { useTabSwipe } from "@/components/workout/TabBar";
import ConfirmModal from "@/components/ConfirmModal";

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
    <div
      className="flex min-h-[100dvh] flex-col items-center justify-center px-6"
      style={{ background: "var(--color-obsidian)" }}
    >
      {/* Decorative glow */}
      <div
        className="fixed top-[-100px] right-[-100px] w-[300px] h-[300px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(255,45,45,0.08) 0%, transparent 70%)",
          animation: "pulse-glow 4s ease-in-out infinite",
        }}
      />

      <div
        className="text-[9px] uppercase tracking-[0.25em] mb-4"
        style={{ fontFamily: "var(--font-mono)", color: "#ff2d2d" }}
      >
        Zenith
      </div>
      <h1
        className="mb-10 text-2xl font-bold tracking-tight text-white"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Start a Workout
      </h1>

      {workoutTypes === undefined ? (
        <p
          className="text-sm"
          style={{ fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.3)" }}
        >
          Loading…
        </p>
      ) : workoutTypes.length === 0 ? (
        <button
          type="button"
          onClick={() => onStart({ type: "General" })}
          className="w-full max-w-xs rounded-xl px-6 py-4 text-center text-sm font-semibold transition-all active:scale-95"
          style={{
            background: "rgba(255,45,45,0.15)",
            border: "1px solid rgba(255,45,45,0.3)",
            color: "#ff2d2d",
            fontFamily: "var(--font-display)",
          }}
        >
          General Workout
        </button>
      ) : (
        <div className="flex w-full max-w-xs flex-col gap-3">
          {workoutTypes.map((wt) => (
            <button
              type="button"
              key={wt._id}
              onClick={() => onStart({ workoutTypeId: wt._id, type: wt.name })}
              className="w-full rounded-xl px-6 py-4 text-center text-sm font-semibold text-white transition-all active:scale-[0.97]"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                backdropFilter: "blur(16px)",
                fontFamily: "var(--font-display)",
              }}
            >
              {wt.name}
            </button>
          ))}
        </div>
      )}

      <a
        href="/dashboard"
        className="mt-10 text-sm underline underline-offset-4 transition-colors hover:text-white/60"
        style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-mono)" }}
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
  const [showExitMenu, setShowExitMenu] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ type: "finish" | "discard" } | null>(null);
  const swipeHandlers = useTabSwipe(activeTab, setActiveTab);

  const handleFinish = useCallback(async () => {
    if (isFinishing) return;
    setConfirmModal({ type: "finish" });
  }, [isFinishing]);

  const doFinish = useCallback(async () => {
    setIsFinishing(true);
    try {
      await finishActive({ sessionId });
      router.push("/dashboard");
    } catch (err) {
      console.error("Failed to finish workout:", err);
      setIsFinishing(false);
    }
  }, [finishActive, router, sessionId]);

  const handleSaveExit = useCallback(() => {
    router.push("/dashboard");
  }, [router]);

  const handleDiscard = useCallback(async () => {
    try {
      await removeSession({ sessionId });
      router.push("/dashboard");
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  }, [removeSession, router, sessionId]);

  return (
    <WorkoutProvider sessionId={sessionId}>
      <div
        className="flex h-[100dvh] flex-col overflow-hidden"
        style={{ background: "var(--color-obsidian)" }}
      >
        {/* Top bar: Exit + Finish */}
        <div
          className="flex shrink-0 items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowExitMenu((v) => !v)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                fontFamily: "var(--font-mono)",
                color: "rgba(255,255,255,0.4)",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              Exit
            </button>

            {showExitMenu && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-[70] cursor-default"
                  onClick={() => setShowExitMenu(false)}
                  aria-label="Close menu"
                />
                <div
                  className="absolute left-0 top-full mt-2 z-[71] rounded-xl overflow-hidden min-w-[180px]"
                  style={{
                    background: "rgba(20,20,20,0.98)",
                    backdropFilter: "blur(24px)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
                  }}
                >
                  <button
                    type="button"
                    onClick={handleSaveExit}
                    className="w-full text-left px-4 py-3 text-sm transition-colors active:bg-white/5"
                    style={{ fontFamily: "var(--font-display)", color: "rgba(255,255,255,0.8)" }}
                  >
                    Save & Exit
                  </button>
                  <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />
                  <button
                    type="button"
                    onClick={() => {
                      setShowExitMenu(false);
                      setConfirmModal({ type: "discard" });
                    }}
                    className="w-full text-left px-4 py-3 text-sm transition-colors active:bg-white/5"
                    style={{ fontFamily: "var(--font-display)", color: "#ff2d2d" }}
                  >
                    Discard Workout
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-2">
            <div
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: "#ff2d2d", boxShadow: "0 0 8px rgba(255,45,45,0.6)" }}
            />
            <span
              className="text-[9px] uppercase tracking-[0.15em]"
              style={{ fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.35)" }}
            >
              Live
            </span>
          </div>

          <button
            type="button"
            onClick={() => void handleFinish()}
            disabled={isFinishing}
            className="rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-all active:scale-95"
            style={{
              background: "rgba(255,45,45,0.12)",
              border: "1px solid rgba(255,45,45,0.3)",
              color: "#ff2d2d",
              fontFamily: "var(--font-display)",
            }}
          >
            {isFinishing ? "Finishing…" : "Finish"}
          </button>
        </div>

        {/* Tab content – both tabs stay mounted */}
        <div className="relative flex-1 min-h-0 overflow-hidden" {...swipeHandlers}>
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

      <ConfirmModal
        isOpen={confirmModal !== null}
        onClose={() => setConfirmModal(null)}
        onConfirm={() => {
          if (confirmModal?.type === "finish") {
            void doFinish();
          } else if (confirmModal?.type === "discard") {
            void handleDiscard();
          }
        }}
        title={confirmModal?.type === "finish" ? "Finish Workout" : "Discard Workout"}
        description={
          confirmModal?.type === "finish"
            ? "Finish this workout?"
            : "Discard this workout and all logged sets?"
        }
        confirmLabel={confirmModal?.type === "finish" ? "Finish" : "Discard"}
        isDestructive={confirmModal?.type === "discard"}
      />
    </WorkoutProvider>
  );
}

function TabFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <p
        className="text-sm"
        style={{ fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.25)" }}
      >
        Loading…
      </p>
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
      <div
        className="flex min-h-[100dvh] items-center justify-center"
        style={{ background: "var(--color-obsidian)" }}
      >
        <p
          className="text-sm"
          style={{ fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.25)" }}
        >
          Loading…
        </p>
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
