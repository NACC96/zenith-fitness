"use client";

import { memo, useState, useEffect, useMemo } from "react";
import type { WorkoutSession } from "@/lib/types";
import { calcVolume, exerciseToMuscleGroup } from "@/lib/utils";
import GlassCard from "./GlassCard";

interface MuscleGroupBalanceProps {
  workouts: WorkoutSession[];
}

export default memo(function MuscleGroupBalance({ workouts }: MuscleGroupBalanceProps) {
  const [mounted, setMounted] = useState(false);
  const [Recharts, setRecharts] = useState<typeof import("recharts") | null>(
    null,
  );

  useEffect(() => {
    setMounted(true);
    import("recharts").then(setRecharts);
  }, []);

  const data = useMemo(() => {
    const volumeByGroup = new Map<string, number>();

    for (const w of workouts) {
      for (const ex of w.exercises) {
        let group = exerciseToMuscleGroup(ex.name);
        if (group === "Other") group = w.type || "Other";
        const vol = calcVolume(ex.sets);
        volumeByGroup.set(group, (volumeByGroup.get(group) || 0) + vol);
      }
    }

    return [...volumeByGroup.entries()].map(([group, volume]) => ({
      group,
      volume,
    }));
  }, [workouts]);

  return (
    <GlassCard className="flex-2 p-4 md:p-6">
      <p
        className="uppercase tracking-[0.2em]"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "9px",
          color: "rgba(255,255,255,0.3)",
          marginBottom: "16px",
        }}
      >
        Muscle Group Balance
      </p>

      {data.length === 0 ? (
        <div
          className="flex items-center justify-center"
          style={{ height: "250px", color: "rgba(255,255,255,0.2)", fontSize: "13px" }}
        >
          Log different exercises to see balance
        </div>
      ) : !mounted || !Recharts ? (
        <div style={{ height: "250px" }} />
      ) : (
        <Recharts.ResponsiveContainer width="100%" height={250}>
          <Recharts.RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
            <Recharts.PolarGrid stroke="rgba(255,255,255,0.06)" />
            <Recharts.PolarAngleAxis
              dataKey="group"
              tick={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                fill: "rgba(255,255,255,0.5)",
              }}
            />
            <Recharts.PolarRadiusAxis
              tick={false}
              axisLine={false}
            />
            <Recharts.Radar
              dataKey="volume"
              stroke="#ff2d2d"
              strokeWidth={2}
              fill="rgba(255,45,45,0.3)"
              fillOpacity={1}
            />
          </Recharts.RadarChart>
        </Recharts.ResponsiveContainer>
      )}
    </GlassCard>
  );
});
