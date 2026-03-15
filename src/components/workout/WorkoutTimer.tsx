// src/components/workout/WorkoutTimer.tsx
"use client";

import { useSyncExternalStore } from "react";
import { useAnimationTimer } from "@/hooks/useAnimationTimer";
import { useWorkout } from "@/contexts/WorkoutContext";

type TimerMode = "elapsed" | "rest";

interface WorkoutTimerProps {
  mode: TimerMode;
}

export default function WorkoutTimer({ mode }: WorkoutTimerProps) {
  const { timingState } = useWorkout();

  const startTime =
    mode === "rest"
      ? timingState?.activeRestStartedAt
      : timingState?.firstSetStartedAt;

  const { displayRef, subscribe } = useAnimationTimer(startTime ?? null);

  // useSyncExternalStore subscribes to the rAF updates
  const display = useSyncExternalStore(
    subscribe,
    () => displayRef.current,
    () => "00:00" // server snapshot
  );

  const isRest = mode === "rest";

  return (
    <div className="text-center">
      {isRest && (
        <div
          className="text-[10px] uppercase tracking-[0.2em] mb-2"
          style={{
            fontFamily: "var(--font-mono)",
            color: "#ff2d2d",
            textShadow: "0 0 20px rgba(255,45,45,0.4)",
          }}
        >
          Resting
        </div>
      )}
      <div
        className={`font-bold tabular-nums tracking-tighter ${isRest ? "text-6xl" : "text-5xl"}`}
        style={{
          fontFamily: "var(--font-display)",
          color: isRest ? "#ff2d2d" : "rgba(255,255,255,0.9)",
          textShadow: isRest ? "0 0 40px rgba(255,45,45,0.3)" : "none",
        }}
      >
        {display}
      </div>
    </div>
  );
}
