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
    <div className="px-4 mt-6">
      <div className="text-xs text-zinc-600 uppercase tracking-wide mb-2">
        Completed
      </div>
      <div className="bg-zinc-900 rounded-xl divide-y divide-zinc-800">
        {completed.map((ex) => (
          <div
            key={ex._id}
            className="flex justify-between items-center px-4 py-3"
          >
            <span className="text-sm text-white">{ex.name}</span>
            <span className="text-sm text-zinc-500">
              {ex.sets.length} × {formatNum(ex.sets[ex.sets.length - 1]?.weight ?? 0)}×
              {ex.sets[ex.sets.length - 1]?.reps ?? 0}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
