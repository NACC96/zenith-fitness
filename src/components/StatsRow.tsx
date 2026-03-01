"use client";

import { memo, useMemo } from "react";
import type { WorkoutSession } from "@/lib/types";
import { calcWorkoutVolume, getMaxWeight, formatNum } from "@/lib/utils";
import StatCard from "./StatCard";

interface StatsRowProps {
  workouts: WorkoutSession[];
  activeFilter: string;
}

export default memo(function StatsRow({ workouts, activeFilter }: StatsRowProps) {
  const filtered = useMemo(
    () =>
      activeFilter === "All"
        ? workouts
        : workouts.filter((w) => w.type === activeFilter),
    [workouts, activeFilter],
  );

  const { totalVolume, sessionCount, totalSets, totalReps, heaviestLift } = useMemo(() => {
    let volume = 0;
    let sets = 0;
    let reps = 0;
    let heaviest = 0;

    for (const w of filtered) {
      volume += calcWorkoutVolume(w);
      for (const ex of w.exercises) {
        sets += ex.sets.length;
        for (const set of ex.sets) {
          reps += set.reps;
        }
        const maxW = getMaxWeight(ex.sets);
        if (maxW > heaviest) heaviest = maxW;
      }
    }

    return {
      totalVolume: volume,
      sessionCount: filtered.length,
      totalSets: sets,
      totalReps: reps,
      heaviestLift: heaviest,
    };
  }, [filtered]);

  const sessionLabel = sessionCount === 1 ? "session" : "sessions";

  return (
    <div>
      <p
        className="uppercase tracking-[0.25em]"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "9px",
          color: "rgba(255,255,255,0.3)",
          marginBottom: "12px",
        }}
      >
        {activeFilter} Stats // {sessionCount} {sessionLabel} logged
      </p>

      <div className="grid grid-cols-2 gap-3 md:flex md:flex-wrap">
        <StatCard
          label="Total Volume"
          value={formatNum(totalVolume)}
          unit="lb"
          accent
        />
        <StatCard label="Sessions" value={sessionCount} />
        <StatCard label="Total Sets" value={totalSets} />
        <StatCard label="Total Reps" value={formatNum(totalReps)} />
        <StatCard
          label="Heaviest Lift"
          value={heaviestLift}
          unit="lb"
          accent
          sub="All time within filter"
        />
      </div>
    </div>
  );
});
