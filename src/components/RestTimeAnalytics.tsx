"use client";

import { memo, useState, useEffect, useMemo } from "react";
import type { WorkoutSession } from "@/lib/types";
import { getRestDurationMs, formatDuration } from "@/lib/utils";
import GlassCard from "./GlassCard";

interface RestTimeAnalyticsProps {
  workouts: WorkoutSession[];
}

export default memo(function RestTimeAnalytics({ workouts }: RestTimeAnalyticsProps) {
  const [mounted, setMounted] = useState(false);
  const [Recharts, setRecharts] = useState<typeof import("recharts") | null>(
    null,
  );

  useEffect(() => {
    setMounted(true);
    import("recharts").then(setRecharts);
  }, []);

  const { overallAvgMs, exerciseData } = useMemo(() => {
    const allRestMs: number[] = [];
    const exerciseRestMap = new Map<string, number[]>();

    for (const w of workouts) {
      for (const ex of w.exercises) {
        for (const set of ex.sets) {
          const rest = getRestDurationMs(set);
          if (rest != null) {
            allRestMs.push(rest);
            if (!exerciseRestMap.has(ex.name)) exerciseRestMap.set(ex.name, []);
            exerciseRestMap.get(ex.name)!.push(rest);
          }
        }
      }
    }

    if (allRestMs.length === 0) {
      return { overallAvgMs: 0, exerciseData: [] };
    }

    const overallAvg = allRestMs.reduce((a, b) => a + b, 0) / allRestMs.length;

    const perExercise = [...exerciseRestMap.entries()]
      .map(([name, rests]) => ({
        name,
        avgRest: Math.round(rests.reduce((a, b) => a + b, 0) / rests.length / 1000),
      }))
      .sort((a, b) => b.avgRest - a.avgRest)
      .slice(0, 8);

    return { overallAvgMs: overallAvg, exerciseData: perExercise };
  }, [workouts]);

  const chartHeight = useMemo(
    () => Math.max(180, exerciseData.length * 36),
    [exerciseData],
  );

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
        Rest Time Analytics
      </p>

      {exerciseData.length === 0 ? (
        <div
          className="flex items-center justify-center"
          style={{ height: "180px", color: "rgba(255,255,255,0.2)", fontSize: "13px" }}
        >
          Insufficient rest data
        </div>
      ) : !mounted || !Recharts ? (
        <div style={{ height: `${chartHeight + 60}px` }} />
      ) : (
        <>
          <div style={{ textAlign: "center", marginBottom: "16px" }}>
            <p
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "9px",
                color: "rgba(255,255,255,0.3)",
                margin: 0,
                marginBottom: "4px",
                textTransform: "uppercase",
                letterSpacing: "0.2em",
              }}
            >
              Avg Rest
            </p>
            <p
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "24px",
                color: "#ebebeb",
                margin: 0,
                fontWeight: 600,
              }}
            >
              {formatDuration(overallAvgMs)}
            </p>
          </div>

          <Recharts.ResponsiveContainer width="100%" height={chartHeight}>
            <Recharts.BarChart data={exerciseData} layout="vertical">
              <Recharts.XAxis
                type="number"
                tick={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  fill: "rgba(255,255,255,0.3)",
                }}
                axisLine={false}
                tickLine={false}
                unit="s"
              />
              <Recharts.YAxis
                type="category"
                dataKey="name"
                tick={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  fill: "rgba(255,255,255,0.3)",
                }}
                axisLine={false}
                tickLine={false}
                width={120}
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
                      <p
                        style={{
                          color: "#ebebeb",
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: "11px",
                          margin: 0,
                        }}
                      >
                        {payload[0].value}s avg rest
                      </p>
                    </div>
                  );
                }}
              />
              <Recharts.Bar
                dataKey="avgRest"
                fill="rgba(255,45,45,0.6)"
                radius={[0, 4, 4, 0]}
              />
            </Recharts.BarChart>
          </Recharts.ResponsiveContainer>
        </>
      )}
    </GlassCard>
  );
});
