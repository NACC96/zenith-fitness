// src/components/workout/TrackTab.tsx
"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useWorkout } from "@/contexts/WorkoutContext";
import WorkoutTimer from "./WorkoutTimer";
import ExerciseHero from "./ExerciseHero";
import ExerciseSuggestion from "./ExerciseSuggestion";
import CompletedSets from "./CompletedSets";
import { formatNum } from "@/lib/utils";

export default function TrackTab() {
  const { session, exercises, startSet, sessionId } = useWorkout();

  const activeSet = session?.activeSet ?? null;
  const isResting = session?.activeRestStartedAt != null;

  const metrics = useQuery(
    api.workoutMetrics.getSessionMetrics,
    sessionId ? { sessionId } : "skip"
  );

  const suggestion = useQuery(
    api.exerciseSuggestions.suggestNext,
    sessionId && !activeSet ? { sessionId } : "skip"
  );

  const [dismissedSuggestion, setDismissedSuggestion] = useState<string | null>(null);
  const activeSuggestion = suggestion && suggestion !== dismissedSuggestion ? suggestion : null;

  // Determine current exercise context
  const currentExercise = useMemo(() => {
    if (activeSet) {
      // Find last set info for this exercise
      const ex = exercises?.find(
        (e) => e.name.toLowerCase() === activeSet.exerciseName.toLowerCase()
      );
      const lastSet = ex?.sets[ex.sets.length - 1];
      return {
        name: activeSet.exerciseName,
        lastWeight: lastSet?.weight ?? activeSet.weight ?? null,
        lastReps: lastSet?.reps ?? null,
        setNumber: (ex?.sets.length ?? 0) + 1,
      };
    }
    return null;
  }, [activeSet, exercises]);

  const handleAcceptSuggestion = useCallback(
    async (exerciseName: string) => {
      if (!sessionId) return;
      await startSet({ sessionId, exerciseName });
    },
    [sessionId, startSet]
  );

  const handleDismissSuggestion = useCallback(() => {
    if (suggestion) setDismissedSuggestion(suggestion);
  }, [suggestion]);

  return (
    <div className="flex flex-col min-h-screen bg-black pb-20">
      {/* Header */}
      <div className="flex justify-between items-center px-4 pt-4 pb-2">
        <span className="text-sm text-zinc-500">
          {session?.type ?? "Workout"}
        </span>
        <span className="text-sm text-zinc-500">
          {metrics ? `${metrics.totalSets} sets · ${formatNum(metrics.totalVolume)} lbs` : ""}
        </span>
      </div>

      {/* Rest timer or elapsed timer */}
      <div className="py-6">
        {isResting ? (
          <WorkoutTimer mode="rest" />
        ) : (
          <WorkoutTimer mode="elapsed" />
        )}
      </div>

      {/* Exercise hero or suggestion */}
      {currentExercise ? (
        <ExerciseHero
          exerciseName={currentExercise.name}
          lastWeight={currentExercise.lastWeight}
          lastReps={currentExercise.lastReps}
          setNumber={currentExercise.setNumber}
        />
      ) : (
        <ExerciseSuggestion
          suggestion={activeSuggestion ?? null}
          onAccept={handleAcceptSuggestion}
          onDismiss={handleDismissSuggestion}
        />
      )}

      {/* Completed exercises */}
      <CompletedSets />
    </div>
  );
}
