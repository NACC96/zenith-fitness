// src/components/workout/ExerciseHero.tsx
"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useWorkout } from "@/contexts/WorkoutContext";
import SwipeConfirm from "./SwipeConfirm";

interface ExerciseHeroProps {
  exerciseName: string;
  lastWeight: number | null;
  lastReps: number | null;
  setNumber: number;
}

export default function ExerciseHero({
  exerciseName,
  lastWeight,
  lastReps,
  setNumber,
}: ExerciseHeroProps) {
  const { completeSet, sessionId } = useWorkout();

  const [weight, setWeight] = useState(lastWeight ?? 135);
  const [reps, setReps] = useState(lastReps ?? 8);

  // Sync defaults when exercise changes
  useEffect(() => {
    setWeight(lastWeight ?? 135);
    setReps(lastReps ?? 8);
  }, [exerciseName, lastWeight, lastReps]);

  const handleConfirm = useCallback(async () => {
    if (!sessionId) return;
    await completeSet({
      sessionId,
      exerciseName,
      weight,
      reps,
    });
  }, [sessionId, exerciseName, weight, reps, completeSet]);

  const weightStep = useMemo(() => (weight < 50 ? 2.5 : 5), [weight]);

  return (
    <div className="px-4">
      {/* Exercise name */}
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold text-white">{exerciseName}</h2>
        <p className="text-sm text-zinc-500">
          Set {setNumber}
          {lastWeight != null && ` · Last: ${lastWeight}×${lastReps}`}
        </p>
      </div>

      {/* Steppers */}
      <div className="flex justify-center items-center gap-6 mb-6">
        {/* Weight stepper */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setWeight((w) => Math.max(0, w - weightStep))}
            className="w-10 h-10 rounded-full bg-zinc-800 text-white text-xl flex items-center justify-center active:bg-zinc-700"
          >
            −
          </button>
          <div className="text-center w-16">
            <div className="text-2xl font-bold text-white tabular-nums">
              {weight}
            </div>
            <div className="text-xs text-zinc-500">lbs</div>
          </div>
          <button
            type="button"
            onClick={() => setWeight((w) => w + weightStep)}
            className="w-10 h-10 rounded-full bg-zinc-800 text-white text-xl flex items-center justify-center active:bg-zinc-700"
          >
            +
          </button>
        </div>

        <span className="text-zinc-600 text-xl">×</span>

        {/* Reps stepper */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setReps((r) => Math.max(1, r - 1))}
            className="w-10 h-10 rounded-full bg-zinc-800 text-white text-xl flex items-center justify-center active:bg-zinc-700"
          >
            −
          </button>
          <div className="text-center w-8">
            <div className="text-2xl font-bold text-white tabular-nums">
              {reps}
            </div>
            <div className="text-xs text-zinc-500">reps</div>
          </div>
          <button
            type="button"
            onClick={() => setReps((r) => r + 1)}
            className="w-10 h-10 rounded-full bg-zinc-800 text-white text-xl flex items-center justify-center active:bg-zinc-700"
          >
            +
          </button>
        </div>
      </div>

      {/* Swipe to confirm */}
      <SwipeConfirm onConfirm={handleConfirm}>
        <div className="bg-blue-600 rounded-xl py-5 text-center">
          <div className="font-bold text-lg text-white">
            Log {weight} × {reps}
          </div>
          <div className="text-xs text-blue-300 mt-1">
            Swipe right to confirm
          </div>
        </div>
      </SwipeConfirm>
    </div>
  );
}
