"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { formatNum } from "@/lib/utils";
import WorkoutExerciseCard from "./WorkoutExerciseCard";

interface ActiveExerciseFeedProps {
  exercises: Array<{
    name: string;
    sets: Array<{ weight: number; reps: number; setNumber: number }>;
  }>;
}

export default function ActiveExerciseFeed({
  exercises,
}: ActiveExerciseFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const totalSetCount = exercises.reduce((sum, ex) => sum + ex.sets.length, 0);

  // Keep latest activity visible when exercises or sets are appended.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [exercises.length, totalSetCount]);

  const totalVolume = exercises.reduce((sum, ex) => {
    return sum + ex.sets.reduce((s, set) => s + set.weight * set.reps, 0);
  }, 0);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Summary bar */}
      {exercises.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06]">
          <span className="font-mono text-[10px] uppercase tracking-wider text-white/40">
            {exercises.length} {exercises.length === 1 ? "exercise" : "exercises"}{" "}
            &middot; {totalSetCount} {totalSetCount === 1 ? "set" : "sets"}
          </span>
          <span className="font-mono text-[10px] text-white/40">
            {formatNum(totalVolume)} lbs total
          </span>
        </div>
      )}

      {/* Scrollable feed */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3"
      >
        {exercises.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-sm text-white/30 italic">
              Your exercises will appear here
            </span>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {exercises.map((exercise, i) => {
              const totalVolume = exercise.sets.reduce(
                (sum, set) => sum + set.weight * set.reps,
                0
              );
              return (
                <WorkoutExerciseCard
                  key={exercise.name}
                  exerciseName={exercise.name}
                  sets={exercise.sets}
                  totalVolume={totalVolume}
                  index={i}
                />
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
