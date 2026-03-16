"use client";

import { memo, useState, useEffect, useMemo } from "react";
import type { WorkoutSession } from "@/lib/types";
import GlassCard from "./GlassCard";

interface FatigueCurveProps {
  workouts: WorkoutSession[];
}

const BAR_COLORS = ["#ff2d2d", "#10b981", "#3b82f6", "#f59e0b"];

export default memo(function FatigueCurve({ workouts }: FatigueCurveProps) {
  const [mounted, setMounted] = useState(false);
  const [Recharts, setRecharts] = useState<typeof import("recharts") | null>(
    null,
  );

  useEffect(() => {
    setMounted(true);
    import("recharts").then(setRecharts);
  }, []);

  const { data, exercises } = useMemo(() => {
    // Build per-exercise, per-session normalized sets
    // exerciseName → Array of session instances, each being set volumes normalized to set 1
    const exerciseInstances = new Map<string, number[][]>();

    for (const w of workouts) {
      for (const ex of w.exercises) {
        if (ex.sets.length < 3) continue;
        const volumes = ex.sets.map((s) => s.weight * s.reps);
        const firstSetVol = volumes[0];
        if (firstSetVol <= 0) continue;
        const normalized = volumes.map((v) => (v / firstSetVol) * 100);
        if (!exerciseInstances.has(ex.name)) exerciseInstances.set(ex.name, []);
        exerciseInstances.get(ex.name)!.push(normalized);
      }
    }

    // Filter to exercises with 2+ session instances
    const qualifying = [...exerciseInstances.entries()]
      .filter(([, instances]) => instances.length >= 2);

    if (qualifying.length === 0) return { data: [], exercises: [] };

    // Select top 4 by frequency (number of instances)
    const topExercises = qualifying
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 4)
      .map(([name]) => name);

    // Determine max set positions (up to 6)
    let maxSets = 0;
    for (const name of topExercises) {
      for (const instance of exerciseInstances.get(name)!) {
        if (instance.length > maxSets) maxSets = instance.length;
      }
    }
    maxSets = Math.min(maxSets, 6);

    // Average normalized % per set position across sessions
    const averages = new Map<string, number[]>();
    for (const name of topExercises) {
      const instances = exerciseInstances.get(name)!;
      const setAvgs: number[] = [];
      for (let s = 0; s < maxSets; s++) {
        const values = instances
          .filter((inst) => inst.length > s)
          .map((inst) => inst[s]);
        const avg = values.length > 0
          ? values.reduce((a, b) => a + b, 0) / values.length
          : 0;
        setAvgs.push(Math.round(avg));
      }
      averages.set(name, setAvgs);
    }

    // Build chart data: one row per set position
    const chartData: Record<string, string | number>[] = [];
    for (let s = 0; s < maxSets; s++) {
      const row: Record<string, string | number> = { set: `Set ${s + 1}` };
      for (const name of topExercises) {
        row[name] = averages.get(name)![s];
      }
      chartData.push(row);
    }

    return { data: chartData, exercises: topExercises };
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
        Fatigue Curve
      </p>

      {data.length === 0 ? (
        <div
          className="flex items-center justify-center"
          style={{ height: "200px", color: "rgba(255,255,255,0.2)", fontSize: "13px" }}
        >
          Need exercises with 3+ sets across multiple sessions
        </div>
      ) : !mounted || !Recharts ? (
        <div style={{ height: "200px" }} />
      ) : (
        <>
          <Recharts.ResponsiveContainer width="100%" height={200}>
            <Recharts.BarChart data={data}>
              <Recharts.XAxis
                dataKey="set"
                tick={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  fill: "rgba(255,255,255,0.3)",
                }}
                axisLine={false}
                tickLine={false}
              />
              <Recharts.YAxis
                tick={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  fill: "rgba(255,255,255,0.3)",
                }}
                axisLine={false}
                tickLine={false}
                width={40}
                domain={[0, (max: number) => Math.max(max, 100)]}
                unit="%"
              />
              <Recharts.Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div
                      style={{
                        background: "rgba(12,12,12,0.95)",
                        backdropFilter: "blur(16px)",
                        border: "1px solid rgba(255,45,45,0.2)",
                        borderRadius: "12px",
                        padding: "10px 14px",
                      }}
                    >
                      <p
                        style={{
                          color: "#ff2d2d",
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: "11px",
                          margin: 0,
                          marginBottom: "4px",
                        }}
                      >
                        {label}
                      </p>
                      {payload
                        .filter((entry) => entry.value != null)
                        .map((entry, i) => (
                          <p
                            key={i}
                            style={{
                              color: entry.color as string,
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: "11px",
                              margin: 0,
                            }}
                          >
                            {entry.name}: {entry.value}%
                          </p>
                        ))}
                    </div>
                  );
                }}
              />
              {exercises.map((name, i) => (
                <Recharts.Bar
                  key={name}
                  dataKey={name}
                  fill={BAR_COLORS[i]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </Recharts.BarChart>
          </Recharts.ResponsiveContainer>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              marginTop: "12px",
              justifyContent: "center",
            }}
          >
            {exercises.map((name, i) => (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "2px",
                    backgroundColor: BAR_COLORS[i],
                  }}
                />
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "9px",
                    color: "rgba(255,255,255,0.4)",
                  }}
                >
                  {name}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </GlassCard>
  );
});
