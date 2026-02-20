"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import type { WorkoutSession } from "@/lib/types";
import {
  calcVolume,
  calcWorkoutVolume,
  getMaxWeight,
  formatNum,
} from "@/lib/utils";
import GlassCard from "@/components/GlassCard";
import ExerciseRow from "@/components/ExerciseRow";

const SessionVolumeChart = dynamic(
  () => import("@/components/SessionVolumeChart"),
  { ssr: false }
);

interface SessionDetailProps {
  workout: WorkoutSession | null;
  allWorkouts: WorkoutSession[];
}

export default function SessionDetail({
  workout,
  allWorkouts,
}: SessionDetailProps) {
  // PR detection: for each exercise in current workout, check if max weight
  // exceeds all previous sessions of same type
  const prExercises = useMemo(() => {
    if (!workout) return new Set<string>();
    const prs = new Set<string>();
    const previousSessions = allWorkouts.filter(
      (w) =>
        w.type === workout.type &&
        w.id !== workout.id &&
        new Date(w.date) < new Date(workout.date)
    );

    for (const ex of workout.exercises) {
      const currentMax = getMaxWeight(ex.sets);
      let prevMax = 0;
      for (const session of previousSessions) {
        const matchingEx = session.exercises.find((e) => e.name === ex.name);
        if (matchingEx) {
          prevMax = Math.max(prevMax, getMaxWeight(matchingEx.sets));
        }
      }
      // PR if there are previous sessions with this exercise and current exceeds them
      if (previousSessions.some((s) => s.exercises.some((e) => e.name === ex.name)) && currentMax > prevMax) {
        prs.add(ex.name);
      }
    }

    return prs;
  }, [workout, allWorkouts]);

  if (!workout) {
    return (
      <div className="flex-1 min-w-0">
        <GlassCard className="flex items-center justify-center h-full min-h-[400px]">
          <span className="text-sm text-white/30">
            Select a session to view details
          </span>
        </GlassCard>
      </div>
    );
  }

  const totalVolume = calcWorkoutVolume(workout);
  const chartData = workout.exercises.map((ex) => ({
    name: ex.name,
    volume: calcVolume(ex.sets),
  }));

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-4">
      {/* Header */}
      <GlassCard className="p-4 md:p-6">
        <div className="flex flex-wrap gap-2 items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* System tag with pulsing dot */}
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: "#ff2d2d" }}
              />
              <span className="font-mono text-[9px] uppercase tracking-wider text-white/40">
                Session Detail
              </span>
            </div>
          </div>
          <div
            className="px-3 py-1.5 rounded-lg font-mono text-xs"
            style={{
              background: "rgba(255,45,45,0.1)",
              border: "1px solid rgba(255,45,45,0.25)",
              color: "#ff2d2d",
            }}
          >
            {formatNum(totalVolume)} lb total
          </div>
        </div>

        <h2
          className="text-lg md:text-2xl font-bold"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {new Date(workout.date + "T00:00:00").toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </h2>
      </GlassCard>

      {/* Exercise volume bar chart */}
      <GlassCard className="p-4 md:p-6">
        <span className="font-mono text-[9px] uppercase tracking-wider text-white/40 block mb-3">
          Volume by Exercise
        </span>
        <div style={{ width: "100%", height: 120 }}>
          <SessionVolumeChart data={chartData} />
        </div>
      </GlassCard>

      {/* Exercise breakdown table */}
      <GlassCard className="p-4 md:p-6">
        <span className="font-mono text-[9px] uppercase tracking-wider text-white/40 block mb-3">
          Exercise Breakdown
        </span>

        {/* Table header */}
        <div className="flex items-center py-2 mb-1">
          <div className="flex-2 font-mono text-[8px] uppercase tracking-wider text-white/30">
            Exercise
          </div>
          <div className="flex-1 text-center font-mono text-[8px] uppercase tracking-wider text-white/30">
            Sets
          </div>
          <div className="flex-1 text-center font-mono text-[8px] uppercase tracking-wider text-white/30">
            Max
          </div>
          <div className="hidden md:block flex-1 text-right font-mono text-[8px] uppercase tracking-wider text-white/30">
            Est 1RM
          </div>
          <div className="flex-1 text-right font-mono text-[8px] uppercase tracking-wider text-white/30">
            Volume
          </div>
        </div>

        {workout.exercises.map((ex) => (
          <ExerciseRow
            key={ex.name}
            exercise={ex}
            isPR={prExercises.has(ex.name)}
          />
        ))}
      </GlassCard>

      {/* Set-by-set breakdown */}
      <GlassCard className="p-4 md:p-6">
        <span className="font-mono text-[9px] uppercase tracking-wider text-white/40 block mb-4">
          Set-by-set breakdown
        </span>

        <div className="flex flex-col gap-4">
          {workout.exercises.map((ex) => {
            const maxWeight = getMaxWeight(ex.sets);
            return (
              <div key={ex.name}>
                <span className="text-xs text-white/60 mb-2 block">
                  {ex.name}
                </span>
                <div className="flex flex-wrap gap-2">
                  {ex.sets.map((set, i) => {
                    const isMax = set.weight === maxWeight;
                    return (
                      <div
                        key={i}
                        className="font-mono text-xs px-2.5 py-1.5"
                        style={{
                          borderRadius: "10px",
                          background: isMax
                            ? "rgba(255,45,45,0.12)"
                            : "rgba(255,255,255,0.04)",
                          border: isMax
                            ? "1px solid rgba(255,45,45,0.3)"
                            : "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        <span
                          style={{
                            color: isMax ? "#ff2d2d" : "rgba(255,255,255,0.7)",
                          }}
                        >
                          {set.weight}
                        </span>
                        <span className="text-white/30"> × </span>
                        <span className="text-white/60">{set.reps}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}
