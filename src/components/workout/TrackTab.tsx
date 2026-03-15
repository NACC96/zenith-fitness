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

  // Only suggest a new exercise after 4+ sets on the last one
  const lastExerciseDone = useMemo(() => {
    if (!exercises || exercises.length === 0) return true;
    const last = exercises[exercises.length - 1];
    return last.sets.length >= 4;
  }, [exercises]);

  const shouldSuggest = sessionId && !activeSet && lastExerciseDone;

  const allSuggestions = useQuery(
    api.exerciseSuggestions.suggestAll,
    shouldSuggest ? { sessionId } : "skip"
  );

  const [showAll, setShowAll] = useState(false);

  // Determine current exercise context
  const currentExercise = useMemo(() => {
    if (activeSet) {
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
      setShowAll(false);
      await startSet({ sessionId, exerciseName });
    },
    [sessionId, startSet]
  );

  const handleSkipTop = useCallback(() => {
    setShowAll(true);
  }, []);

  return (
    <div className="flex flex-col min-h-screen pb-24" style={{ background: "var(--color-obsidian)" }}>
      {/* Header metrics bar */}
      <div
        className="flex justify-between items-center px-5 pt-4 pb-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <span
          className="text-[10px] uppercase tracking-[0.15em]"
          style={{ fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.35)" }}
        >
          {session?.type ?? "Workout"}
        </span>
        <span
          className="text-[10px] uppercase tracking-[0.15em]"
          style={{ fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.35)" }}
        >
          {metrics ? `${metrics.totalSets} sets · ${formatNum(metrics.totalVolume)} lbs` : ""}
        </span>
      </div>

      {/* Timer */}
      <div className="py-8">
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
          topSuggestion={allSuggestions?.[0] ?? null}
          allSuggestions={allSuggestions ?? []}
          showAll={showAll}
          onAccept={handleAcceptSuggestion}
          onSkip={handleSkipTop}
        />
      )}

      {/* Completed exercises */}
      <CompletedSets />
    </div>
  );
}
