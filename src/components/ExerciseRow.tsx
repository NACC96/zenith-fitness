"use client";

import type { Exercise } from "@/lib/types";
import { calcVolume, getMaxWeight, est1RM, formatNum } from "@/lib/utils";

interface ExerciseRowProps {
  exercise: Exercise;
  isPR: boolean;
}

export default function ExerciseRow({ exercise, isPR }: ExerciseRowProps) {
  const volume = calcVolume(exercise.sets);
  const maxWeight = getMaxWeight(exercise.sets);
  const topSet = exercise.sets.reduce((best, s) =>
    s.weight > best.weight ? s : best
  );
  const estimated1RM = est1RM(topSet.weight, topSet.reps);

  return (
    <div
      className="flex items-center py-3"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
    >
      {/* Exercise name */}
      <div className="flex-2 min-w-0 flex items-center gap-2">
        <span className="text-sm text-white/90 truncate">{exercise.name}</span>
        {isPR && (
          <span
            className="font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
            style={{
              background: "#ff2d2d",
              color: "#000",
              fontWeight: 700,
            }}
          >
            PR
          </span>
        )}
      </div>

      {/* Sets count */}
      <div className="flex-1 text-center text-sm text-white/60">
        {exercise.sets.length}
      </div>

      {/* Max weight */}
      <div
        className="flex-1 text-center text-sm font-semibold"
        style={{ color: "#ff2d2d" }}
      >
        {formatNum(maxWeight)} lb
      </div>

      {/* Est 1RM */}
      <div className="hidden md:block flex-1 text-right text-sm text-white/60">
        {formatNum(Math.round(estimated1RM))} lb
      </div>

      {/* Volume */}
      <div className="flex-1 text-right text-sm text-white/60">
        {formatNum(volume)} lb
      </div>
    </div>
  );
}
