"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { LatestCompletedSet } from "@/components/workout/types";
import { formatDuration, formatNum } from "@/lib/utils";

/**
 * Server-computed phase from getLiveTimingState. This is the single source of
 * truth — the client never derives focus state from separate flags.
 */
export type WorkoutPhase = "idle" | "active" | "resting";

export interface WorkoutFocusPanelProps {
  /** Server-computed workout phase — no client-side derivation needed. */
  phase: WorkoutPhase;
  /** True when the session has zero completed sets. */
  isEmpty: boolean;
  activeExerciseName: string | null;
  /** Timestamp (ms) when the active set started. Client computes elapsed. */
  activeSetStartedAt: number | null;
  /** Timestamp (ms) when rest started. Client computes elapsed. */
  activeRestStartedAt: number | null;
  /** Duration of the last completed rest period. */
  lastRestMs: number | null;
  latestCompletedSet: LatestCompletedSet | null;
  exerciseCount: number;
  totalSetCount: number;
  totalVolume: number;
  onOpenHistory: () => void;
  /** Weight to pre-fill the input (from activeSet or last completed set). */
  activeSetWeight: number | null;
  onCompleteSet: (weight: number, reps: number) => void;
  /** Incremented each time a set is successfully logged (for flash feedback). */
  loggedSetSeq: number;
}

function WorkoutFocusPanelImpl({
  phase,
  isEmpty,
  activeExerciseName,
  activeSetStartedAt,
  activeRestStartedAt,
  lastRestMs,
  latestCompletedSet,
  exerciseCount,
  totalSetCount,
  totalVolume,
  onOpenHistory,
  activeSetWeight,
  onCompleteSet,
  loggedSetSeq,
}: WorkoutFocusPanelProps) {
  const [weightValue, setWeightValue] = useState("");
  const [repsValue, setRepsValue] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());
  const [showLoggedFlash, setShowLoggedFlash] = useState(false);
  const repsInputRef = useRef<HTMLInputElement>(null);
  const prevPhaseRef = useRef<WorkoutPhase>(phase);
  const prevLoggedSeqRef = useRef(loggedSetSeq);

  // Tick the timer every second for elapsed calculations.
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync on tab focus / visibility change so timers catch up.
  useEffect(() => {
    const sync = () => setNowMs(Date.now());
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  // When we enter the "active" phase, reset reps and pre-fill weight.
  // Using the phase transition as a signal (not the weight value itself)
  // fixes the bug where identical weight values didn't trigger a re-sync.
  useEffect(() => {
    if (phase === "active" && prevPhaseRef.current !== "active") {
      setRepsValue("");
      if (activeSetWeight !== null) {
        setWeightValue(String(activeSetWeight));
      }
      // Focus the reps input after a tick so the DOM has rendered.
      requestAnimationFrame(() => repsInputRef.current?.focus());
    }
    prevPhaseRef.current = phase;
  }, [phase, activeSetWeight]);

  // Also update weight if it changes while already active (e.g. AI updates it).
  useEffect(() => {
    if (phase === "active" && activeSetWeight !== null) {
      setWeightValue(String(activeSetWeight));
    }
  }, [activeSetWeight, phase]);

  // Show a brief "Logged!" flash when a set is successfully recorded.
  useEffect(() => {
    if (loggedSetSeq > prevLoggedSeqRef.current) {
      prevLoggedSeqRef.current = loggedSetSeq;
      setShowLoggedFlash(true);
      const timer = setTimeout(() => setShowLoggedFlash(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [loggedSetSeq]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const w = parseFloat(weightValue);
      const r = parseInt(repsValue, 10);
      if (!isNaN(w) && w > 0 && !isNaN(r) && r > 0) {
        onCompleteSet(w, r);
        setRepsValue("");
      }
    },
    [weightValue, repsValue, onCompleteSet],
  );

  // Compute elapsed times client-side from server-provided timestamps.
  const activeSetElapsedMs =
    phase === "active" && activeSetStartedAt !== null
      ? Math.max(0, nowMs - activeSetStartedAt)
      : null;

  const activeRestElapsedMs =
    phase === "resting" && activeRestStartedAt !== null
      ? Math.max(0, nowMs - activeRestStartedAt)
      : null;

  const canOpenHistory = exerciseCount > 0;

  // Phase label and indicator color.
  const phaseLabel =
    phase === "active"
      ? "In Set"
      : phase === "resting"
        ? "Resting"
        : isEmpty
          ? "No Sets Yet"
          : "Ready";

  const dotColor = phase === "active" ? "#ff2d2d" : "rgba(255,255,255,0.45)";
  const dotAnimate = phase === "active" || phase === "resting";
  const labelColor = phase === "active" ? "#ff2d2d" : "rgba(255,255,255,0.6)";

  return (
    <div className="flex-1 min-h-0 p-4">
      <div
        className="h-full rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden flex flex-col"
        style={{ backdropFilter: "blur(12px)" }}
      >
        {/* Header bar */}
        <div
          className="shrink-0 px-4 py-3 flex items-center justify-between gap-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: dotColor,
                animation: dotAnimate ? "chatPulse 2s ease-in-out infinite" : "none",
              }}
            />
            <span
              className="font-mono text-[11px] uppercase tracking-widest"
              style={{ color: labelColor }}
            >
              {phaseLabel}
            </span>

            {/* Flash confirmation */}
            {showLoggedFlash && (
              <span
                className="font-mono text-[11px] uppercase tracking-widest ml-2 animate-pulse"
                style={{ color: "#34d399" }}
              >
                Set logged
              </span>
            )}
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

        {/* Main content area */}
        <div className="flex-1 min-h-0 px-4 py-5 flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-3">
            {/* Timer display */}
            {phase === "active" && activeSetElapsedMs !== null ? (
              <div
                className="font-mono text-5xl leading-none tracking-wider"
                style={{ color: "#ebebeb" }}
              >
                {formatDuration(activeSetElapsedMs)}
              </div>
            ) : phase === "resting" && activeRestElapsedMs !== null ? (
              <div
                className="font-mono text-5xl leading-none tracking-wider"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                {formatDuration(activeRestElapsedMs)}
              </div>
            ) : (
              <div
                className="font-mono text-sm uppercase tracking-widest"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                Awaiting next set
              </div>
            )}

            {/* Weight × Reps form — only during active set */}
            {phase === "active" && (
              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={weightValue}
                    onChange={(e) => setWeightValue(e.target.value)}
                    className="w-16 rounded-lg px-2 py-2 font-mono text-sm text-center outline-none"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "rgba(255,255,255,0.8)",
                    }}
                    placeholder="lbs"
                  />
                  <span className="font-mono text-[10px] uppercase tracking-widest text-white/35">
                    lbs
                  </span>
                </div>
                <span className="text-white/20 font-mono">&times;</span>
                <div className="flex items-center gap-1.5">
                  <input
                    ref={repsInputRef}
                    type="number"
                    inputMode="numeric"
                    value={repsValue}
                    onChange={(e) => setRepsValue(e.target.value)}
                    className="w-16 rounded-lg px-2 py-2 font-mono text-sm text-center outline-none"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "rgba(255,255,255,0.8)",
                    }}
                    placeholder="reps"
                    autoFocus
                  />
                  <span className="font-mono text-[10px] uppercase tracking-widest text-white/35">
                    reps
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={!weightValue || !repsValue}
                  className="px-3 py-2 rounded-lg font-mono text-xs uppercase tracking-wider cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{
                    background: "rgba(255,45,45,0.12)",
                    border: "1px solid rgba(255,45,45,0.3)",
                    color: "#ff2d2d",
                  }}
                >
                  Log
                </button>
              </form>
            )}

            {/* Exercise name */}
            {activeExerciseName && (
              <div className="flex flex-col gap-1">
                <span
                  className="font-mono text-[10px] uppercase tracking-widest"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                >
                  {phase === "active" ? "Current exercise" : "Exercise"}
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

            {/* Last set info */}
            {latestCompletedSet && (
              <span className="font-mono text-xs text-white/50">
                Last set #{latestCompletedSet.setNumber}: {latestCompletedSet.weight}
                &times;
                {latestCompletedSet.reps}
                {phase === "idle" && !isEmpty ? " \u2022 complete" : ""}
              </span>
            )}

            {/* Empty state prompt */}
            {!latestCompletedSet && isEmpty && (
              <span className="font-mono text-xs text-white/40">
                Tell me what you&apos;re lifting to start your workout.
              </span>
            )}

            {/* Last rest duration (when idle and has sets) */}
            {phase === "idle" && !isEmpty && lastRestMs !== null && (
              <span className="font-mono text-xs text-white/45">
                Last rest: {formatDuration(lastRestMs)}
              </span>
            )}
          </div>

          {/* Stats bar */}
          <div
            className="rounded-xl p-3 grid grid-cols-3 gap-2"
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[9px] uppercase tracking-widest text-white/35">
                Exercises
              </span>
              <span className="font-mono text-sm text-white/80">{exerciseCount}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[9px] uppercase tracking-widest text-white/35">
                Sets
              </span>
              <span className="font-mono text-sm text-white/80">{totalSetCount}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[9px] uppercase tracking-widest text-white/35">
                Volume
              </span>
              <span className="font-mono text-sm text-white/80">
                {formatNum(totalVolume)} lbs
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const WorkoutFocusPanel = memo(WorkoutFocusPanelImpl);
WorkoutFocusPanel.displayName = "WorkoutFocusPanel";
export default WorkoutFocusPanel;
