"use client";

import { memo, useState, useEffect, useMemo } from "react";
import type { WorkoutSession } from "@/lib/types";
import { getSessionDurationMs } from "@/lib/utils";
import GlassCard from "./GlassCard";
import CustomTooltip from "./CustomTooltip";

interface DurationTrendChartProps {
  workouts: WorkoutSession[];
}

export default memo(function DurationTrendChart({ workouts }: DurationTrendChartProps) {
  const [mounted, setMounted] = useState(false);
  const [Recharts, setRecharts] = useState<typeof import("recharts") | null>(
    null,
  );

  useEffect(() => {
    setMounted(true);
    import("recharts").then(setRecharts);
  }, []);

  const data = useMemo(() => {
    const sorted = [...workouts].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    return sorted
      .map((w) => {
        const ms = getSessionDurationMs(w);
        if (ms == null) return null;
        return {
          date: new Date(w.date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          duration: Math.round(ms / 60000),
        };
      })
      .filter((d): d is { date: string; duration: number } => d !== null);
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
        Duration Over Time
      </p>

      {data.length === 0 ? (
        <div
          className="flex items-center justify-center"
          style={{ height: "180px", color: "rgba(255,255,255,0.2)", fontSize: "13px" }}
        >
          No timing data available
        </div>
      ) : !mounted || !Recharts ? (
        <div style={{ height: "180px" }} />
      ) : (
        <Recharts.ResponsiveContainer width="100%" height={180}>
          <Recharts.AreaChart data={data}>
            <defs>
              <linearGradient id="durationGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(16,185,129,0.3)" />
                <stop offset="100%" stopColor="rgba(16,185,129,0)" />
              </linearGradient>
            </defs>
            <Recharts.XAxis
              dataKey="date"
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
              width={45}
            />
            <Recharts.Tooltip content={<CustomTooltip unit="min" />} />
            <Recharts.Area
              type="monotone"
              dataKey="duration"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#durationGradient)"
              dot={{
                r: 4,
                fill: "#10b981",
                stroke: "#0c0c0c",
                strokeWidth: 2,
              }}
            />
          </Recharts.AreaChart>
        </Recharts.ResponsiveContainer>
      )}
    </GlassCard>
  );
});
