"use client";

import { formatDuration, formatNum } from "@/lib/utils";

export type WorkoutFocusState = "activeSet" | "rest" | "ready" | "empty";

type LatestCompletedSet = {
  exerciseName: string;
  setNumber: number;
  weight: number;
  reps: number;
  endedAt: number | null;
};

export interface WorkoutFocusPanelProps {
  focusState: WorkoutFocusState;
  activeExerciseName: string | null;
  activeSetElapsedMs: number | null;
  activeRestMs: number | null;
  lastRestMs: number | null;
  latestCompletedSet: LatestCompletedSet | null;
  exerciseCount: number;
  totalSetCount: number;
  totalVolume: number;
  onOpenHistory: () => void;
}

function getStateLabel(state: WorkoutFocusState): string {
  if (state === "activeSet") return "In Set";
  if (state === "rest") return "Resting";
  if (state === "ready") return "Ready";
  return "No Sets Yet";
}

export default function WorkoutFocusPanel({
  focusState,
  activeExerciseName,
  activeSetElapsedMs,
  activeRestMs,
  lastRestMs,
  latestCompletedSet,
  exerciseCount,
  totalSetCount,
  totalVolume,
  onOpenHistory,
}: WorkoutFocusPanelProps) {
  const timerMs =
    focusState === "activeSet"
      ? activeSetElapsedMs
      : focusState === "rest"
        ? activeRestMs
        : null;

  const canOpenHistory = exerciseCount > 0;

  return (
    <div className="flex-1 min-h-0 p-4">
      <div
        className="h-full rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden flex flex-col"
        style={{ backdropFilter: "blur(12px)" }}
      >
        <div
          className="shrink-0 px-4 py-3 flex items-center justify-between gap-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: focusState === "activeSet" ? "#ff2d2d" : "rgba(255,255,255,0.45)",
                animation:
                  focusState === "activeSet" || focusState === "rest"
                    ? "chatPulse 2s ease-in-out infinite"
                    : "none",
              }}
            />
            <span
              className="font-mono text-[11px] uppercase tracking-widest"
              style={{ color: focusState === "activeSet" ? "#ff2d2d" : "rgba(255,255,255,0.6)" }}
            >
              {getStateLabel(focusState)}
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenHistory}
            disabled={!canOpenHistory}
            className="px-3 py-1.5 rounded-lg text-[11px] font-mono uppercase tracking-wider transition-all disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.65)",
            }}
          >
            View all exercises
          </button>
        </div>

        <div className="flex-1 min-h-0 px-4 py-5 flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-3">
            {timerMs !== null ? (
              <div
                className="font-mono text-5xl leading-none tracking-wider"
                style={{ color: "#ebebeb" }}
              >
                {formatDuration(timerMs)}
              </div>
            ) : (
              <div
                className="font-mono text-sm uppercase tracking-widest"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                Awaiting next set
              </div>
            )}

            {activeExerciseName && (
              <div className="flex flex-col gap-1">
                <span
                  className="font-mono text-[10px] uppercase tracking-widest"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                >
                  {focusState === "activeSet" ? "Current exercise" : "Exercise"}
                </span>
                <span
                  className="text-2xl leading-tight uppercase"
                  style={{
                    color: "#ebebeb",
                    fontFamily: "var(--font-display)",
                    letterSpacing: "0.04em",
                  }}
                >
                  {activeExerciseName}
                </span>
              </div>
            )}

            {latestCompletedSet && (
              <span className="font-mono text-xs text-white/50">
                Last set #{latestCompletedSet.setNumber}: {latestCompletedSet.weight}
                &times;
                {latestCompletedSet.reps}
                {focusState === "ready" ? " • complete" : ""}
              </span>
            )}

            {!latestCompletedSet && focusState === "empty" && (
              <span className="font-mono text-xs text-white/40">
                Tell me what you&apos;re lifting to start your workout.
              </span>
            )}

            {focusState === "ready" && lastRestMs !== null && (
              <span className="font-mono text-xs text-white/45">
                Last rest: {formatDuration(lastRestMs)}
              </span>
            )}
          </div>

          <div
            className="rounded-xl p-3 grid grid-cols-3 gap-2"
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[9px] uppercase tracking-widest text-white/35">Exercises</span>
              <span className="font-mono text-sm text-white/80">{exerciseCount}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[9px] uppercase tracking-widest text-white/35">Sets</span>
              <span className="font-mono text-sm text-white/80">{totalSetCount}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[9px] uppercase tracking-widest text-white/35">Volume</span>
              <span className="font-mono text-sm text-white/80">{formatNum(totalVolume)} lbs</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
