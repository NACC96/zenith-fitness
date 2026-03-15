// src/components/workout/CompletedSets.tsx
"use client";

import { useWorkout } from "@/contexts/WorkoutContext";
import { formatNum } from "@/lib/utils";

export default function CompletedSets() {
  const { exercises } = useWorkout();

  if (!exercises || exercises.length === 0) return null;

  // Filter to exercises with at least one completed set
  const completed = exercises.filter((ex) => ex.sets.length > 0);

  if (completed.length === 0) return null;

  return (
    <div className="px-5 mt-8">
      <div
        className="text-[9px] uppercase tracking-[0.2em] mb-3"
        style={{ fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.35)" }}
      >
        Completed
      </div>
      <div
        className="rounded-[1.5rem] backdrop-blur-[16px] overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {completed.map((ex, i) => (
          <div
            key={ex._id}
            className="flex justify-between items-center px-5 py-3.5"
            style={{
              borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none",
            }}
          >
            <span
              className="text-sm text-white font-medium"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {ex.name}
            </span>
            <span
              className="text-[11px] tabular-nums"
              style={{ fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.4)" }}
            >
              {ex.sets.length} × {formatNum(ex.sets[ex.sets.length - 1]?.weight ?? 0)}×
              {ex.sets[ex.sets.length - 1]?.reps ?? 0}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
