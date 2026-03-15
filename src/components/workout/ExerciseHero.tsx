// src/components/workout/ExerciseHero.tsx
"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useWorkout } from "@/contexts/WorkoutContext";
import ConfirmSetModal from "./ConfirmSetModal";

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
  const [showConfirm, setShowConfirm] = useState(false);

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
    <div className="px-5">
      {/* Exercise name */}
      <div className="text-center mb-5">
        <h2
          className="text-xl font-bold text-white"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {exerciseName}
        </h2>
        <p
          className="text-[11px] mt-1 uppercase tracking-[0.1em]"
          style={{ fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.35)" }}
        >
          Set {setNumber}
          {lastWeight != null && ` · Last: ${lastWeight}×${lastReps}`}
        </p>
      </div>

      {/* Steppers — glass card */}
      <div
        className="rounded-[1.5rem] backdrop-blur-[16px] p-5 mb-5"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex justify-center items-center gap-6">
          {/* Weight stepper */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setWeight((w) => Math.max(0, w - weightStep))}
              className="w-11 h-11 rounded-full flex items-center justify-center text-xl text-white transition-all active:scale-90"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              −
            </button>
            <div className="text-center w-16">
              <div
                className="text-2xl font-bold text-white tabular-nums"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {weight}
              </div>
              <div
                className="text-[9px] uppercase tracking-[0.15em]"
                style={{ fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.3)" }}
              >
                lbs
              </div>
            </div>
            <button
              type="button"
              onClick={() => setWeight((w) => w + weightStep)}
              className="w-11 h-11 rounded-full flex items-center justify-center text-xl text-white transition-all active:scale-90"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              +
            </button>
          </div>

          <span
            className="text-xl"
            style={{ color: "rgba(255,255,255,0.15)" }}
          >
            ×
          </span>

          {/* Reps stepper */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setReps((r) => Math.max(1, r - 1))}
              className="w-11 h-11 rounded-full flex items-center justify-center text-xl text-white transition-all active:scale-90"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              −
            </button>
            <div className="text-center w-10">
              <div
                className="text-2xl font-bold text-white tabular-nums"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {reps}
              </div>
              <div
                className="text-[9px] uppercase tracking-[0.15em]"
                style={{ fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.3)" }}
              >
                reps
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReps((r) => r + 1)}
              className="w-11 h-11 rounded-full flex items-center justify-center text-xl text-white transition-all active:scale-90"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Log button — red accent */}
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
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
          Log {weight} × {reps}
        </div>
      </button>

      <ConfirmSetModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirm}
        weight={weight}
        reps={reps}
      />
    </div>
  );
}
