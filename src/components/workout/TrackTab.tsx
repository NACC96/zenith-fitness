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
import Portal from "@/components/Portal";
import { formatNum } from "@/lib/utils";

export default function TrackTab() {
  const { session, exercises, startSet, sessionId } = useWorkout();

  const activeSet = session?.activeSet ?? null;
  const isResting = session?.activeRestStartedAt != null;

  const metrics = useQuery(
    api.workoutMetrics.getSessionMetrics,
    sessionId ? { sessionId } : "skip"
  );

  // The exercise the user was just doing (for "Next Set" button)
  const lastExercise = useMemo(() => {
    if (!exercises || exercises.length === 0) return null;
    const last = exercises[exercises.length - 1];
    if (last.sets.length === 0) return null;
    const lastSet = last.sets[last.sets.length - 1];
    return { name: last.name, lastWeight: lastSet.weight, lastReps: lastSet.reps, setNumber: last.sets.length + 1 };
  }, [exercises]);

  const shouldSuggest = sessionId && !activeSet;

  const allSuggestions = useQuery(
    api.exerciseSuggestions.suggestAll,
    shouldSuggest ? { sessionId } : "skip"
  );

  const [showAll, setShowAll] = useState(false);
  const [showSwitchModal, setShowSwitchModal] = useState(false);

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
        {activeSet ? (
          <WorkoutTimer mode="set" />
        ) : isResting ? (
          <WorkoutTimer mode="rest" />
        ) : (
          <WorkoutTimer mode="elapsed" />
        )}
      </div>

      {/* Exercise hero, next set button, or suggestion */}
      {currentExercise ? (
        <ExerciseHero
          exerciseName={currentExercise.name}
          lastWeight={currentExercise.lastWeight}
          lastReps={currentExercise.lastReps}
          setNumber={currentExercise.setNumber}
        />
      ) : lastExercise ? (
        <>
          <div className="px-5 mb-6">
            <div className="text-center mb-5">
              <h2
                className="text-xl font-bold text-white"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {lastExercise.name}
              </h2>
              <p
                className="text-[11px] mt-1 uppercase tracking-[0.1em]"
                style={{ fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.35)" }}
              >
                Set {lastExercise.setNumber} · Last: {lastExercise.lastWeight}×{lastExercise.lastReps}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleAcceptSuggestion(lastExercise.name)}
              className="w-full rounded-xl py-4 text-center transition-all active:scale-[0.97]"
              style={{
                background: "rgba(255,45,45,0.15)",
                border: "1px solid rgba(255,45,45,0.3)",
                boxShadow: "0 0 30px rgba(255,45,45,0.1)",
              }}
            >
              <div
                className="font-bold text-lg"
                style={{ fontFamily: "var(--font-display)", color: "#ff2d2d" }}
              >
                Start Set {lastExercise.setNumber}
              </div>
            </button>

            {/* Switch exercise button */}
            {allSuggestions && allSuggestions.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSwitchModal(true)}
                className="w-full mt-3 rounded-xl py-3 text-center transition-all active:scale-[0.97]"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <span
                  className="text-sm"
                  style={{ fontFamily: "var(--font-display)", color: "rgba(255,255,255,0.5)" }}
                >
                  Switch Exercise
                </span>
              </button>
            )}
          </div>

          {/* Switch exercise modal */}
          {showSwitchModal && (
            <Portal>
              <div className="fixed inset-0 z-[60] flex items-end justify-center">
                <button
                  type="button"
                  aria-label="Close"
                  className="absolute inset-0 cursor-pointer"
                  style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)" }}
                  onClick={() => setShowSwitchModal(false)}
                />
                <div
                  className="relative w-full max-w-md rounded-t-3xl overflow-hidden"
                  style={{
                    background: "rgba(14,14,14,0.98)",
                    backdropFilter: "blur(24px)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderBottom: "none",
                    boxShadow: "0 -10px 60px rgba(0,0,0,0.5)",
                    maxHeight: "70dvh",
                  }}
                >
                  <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
                  </div>
                  <div className="px-5 pt-2 pb-6 overflow-y-auto" style={{ maxHeight: "calc(70dvh - 20px)" }}>
                    <div
                      className="text-[9px] uppercase tracking-[0.2em] mb-3"
                      style={{ fontFamily: "var(--font-mono)", color: "#ff2d2d" }}
                    >
                      Pick an Exercise
                    </div>
                    <div
                      className="rounded-[1.5rem] backdrop-blur-[16px] overflow-hidden"
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      {(allSuggestions ?? []).map((name, i) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => {
                            setShowSwitchModal(false);
                            handleAcceptSuggestion(name);
                          }}
                          className="w-full flex items-center justify-between px-5 py-3.5 text-left transition-all active:bg-white/5"
                          style={{
                            borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none",
                          }}
                        >
                          <span
                            className="text-sm text-white font-medium"
                            style={{ fontFamily: "var(--font-display)" }}
                          >
                            {name}
                          </span>
                          <span
                            className="text-[10px] uppercase tracking-wider"
                            style={{ fontFamily: "var(--font-mono)", color: "#ff2d2d" }}
                          >
                            Start
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Portal>
          )}
        </>
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
