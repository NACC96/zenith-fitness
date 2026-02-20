"use client";

import type { WorkoutSession } from "@/lib/types";
import { calcWorkoutVolume, getMaxWeight, formatNum } from "@/lib/utils";
import StatCard from "./StatCard";

interface StatsRowProps {
  workouts: WorkoutSession[];
  activeFilter: string;
}

export default function StatsRow({ workouts, activeFilter }: StatsRowProps) {
  const filtered =
    activeFilter === "All"
      ? workouts
      : workouts.filter((w) => w.type === activeFilter);

  const totalVolume = filtered.reduce((sum, w) => sum + calcWorkoutVolume(w), 0);
  const sessionCount = filtered.length;
  const totalSets = filtered.reduce(
    (sum, w) => sum + w.exercises.reduce((s, ex) => s + ex.sets.length, 0),
    0,
  );
  const totalReps = filtered.reduce(
    (sum, w) =>
      sum +
      w.exercises.reduce(
        (s, ex) => s + ex.sets.reduce((r, set) => r + set.reps, 0),
        0,
      ),
    0,
  );
  const heaviestLift = filtered.reduce(
    (max, w) =>
      Math.max(
        max,
        ...w.exercises.map((ex) => getMaxWeight(ex.sets)),
      ),
    0,
  );

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
}
