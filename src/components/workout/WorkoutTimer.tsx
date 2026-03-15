// src/components/workout/WorkoutTimer.tsx
"use client";

import { useSyncExternalStore } from "react";
import { useAnimationTimer } from "@/hooks/useAnimationTimer";
import { useWorkout } from "@/contexts/WorkoutContext";

type TimerMode = "elapsed" | "rest" | "set";

interface WorkoutTimerProps {
  mode: TimerMode;
}

export default function WorkoutTimer({ mode }: WorkoutTimerProps) {
  const { timingState } = useWorkout();

  const primaryStart =
    mode === "rest"
      ? timingState?.activeRestStartedAt
      : mode === "set"
        ? timingState?.activeSet?.startedAt
        : timingState?.firstSetStartedAt;

  // Session timer shown as secondary when in set or rest mode
  const sessionStart =
    mode !== "elapsed" ? timingState?.firstSetStartedAt : null;

  const { displayRef: primaryRef, subscribe: primarySub } = useAnimationTimer(primaryStart ?? null);
  const { displayRef: sessionRef, subscribe: sessionSub } = useAnimationTimer(sessionStart ?? null);

  const primaryDisplay = useSyncExternalStore(primarySub, () => primaryRef.current, () => "00:00");
  const sessionDisplay = useSyncExternalStore(sessionSub, () => sessionRef.current, () => "00:00");

  const isRest = mode === "rest";
  const isSet = mode === "set";

  return (
    <div className="text-center">
      {/* Label */}
      {(isRest || isSet) && (
        <div
          className="text-[10px] uppercase tracking-[0.2em] mb-2"
          style={{
            fontFamily: "var(--font-mono)",
            color: isRest ? "#ff2d2d" : "rgba(255,255,255,0.5)",
            textShadow: isRest ? "0 0 20px rgba(255,45,45,0.4)" : "none",
          }}
        >
          {isRest ? "Resting" : "Set Time"}
        </div>
      )}

      {/* Primary timer */}
      <div
        className={`font-bold tabular-nums tracking-tighter ${isRest ? "text-6xl" : isSet ? "text-6xl" : "text-5xl"}`}
        style={{
          fontFamily: "var(--font-display)",
          color: isRest ? "#ff2d2d" : isSet ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.9)",
          textShadow: isRest ? "0 0 40px rgba(255,45,45,0.3)" : "none",
        }}
      >
        {primaryDisplay}
      </div>

      {/* Secondary session timer */}
      {(isRest || isSet) && sessionStart && (
        <div
          className="mt-2 text-[11px] tabular-nums tracking-wide"
          style={{
            fontFamily: "var(--font-mono)",
            color: "rgba(255,255,255,0.25)",
          }}
        >
          Session {sessionDisplay}
        </div>
      )}
    </div>
  );
}
