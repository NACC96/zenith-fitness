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
        <div className="text-sm text-amber-400 mb-1">RESTING</div>
      )}
      <div
        className={`font-bold tabular-nums tracking-tighter ${
          isRest ? "text-6xl text-amber-400" : "text-5xl text-white"
        }`}
      >
        {display}
      </div>
    </div>
  );
}
