"use client";

import { useState, useEffect } from "react";
import type { WorkoutSession } from "@/lib/types";
import { calcWorkoutVolume } from "@/lib/utils";
import GlassCard from "./GlassCard";
import CustomTooltip from "./CustomTooltip";

interface VolumeTrendChartProps {
  workouts: WorkoutSession[];
}

export default function VolumeTrendChart({ workouts }: VolumeTrendChartProps) {
  const [mounted, setMounted] = useState(false);
  const [Recharts, setRecharts] = useState<typeof import("recharts") | null>(
    null,
  );

  useEffect(() => {
    setMounted(true);
    import("recharts").then(setRecharts);
  }, []);

  const sorted = [...workouts].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const data = sorted.map((w) => {
    const d = new Date(w.date);
    return {
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      volume: calcWorkoutVolume(w),
    };
  });

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
        Volume Over Time
      </p>

      {data.length === 0 ? (
        <div
          className="flex items-center justify-center"
          style={{ height: "180px", color: "rgba(255,255,255,0.2)", fontSize: "13px" }}
        >
          No data for this filter
        </div>
      ) : !mounted || !Recharts ? (
        <div style={{ height: "180px" }} />
      ) : (
        <Recharts.ResponsiveContainer width="100%" height={180}>
          <Recharts.AreaChart data={data}>
            <defs>
              <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff2d2d" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#ff2d2d" stopOpacity={0} />
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
            <Recharts.Tooltip content={<CustomTooltip />} />
            <Recharts.Area
              type="monotone"
              dataKey="volume"
              stroke="#ff2d2d"
              strokeWidth={2}
              fill="url(#volumeGradient)"
              dot={{
                r: 4,
                fill: "#ff2d2d",
                stroke: "#0c0c0c",
                strokeWidth: 2,
              }}
            />
          </Recharts.AreaChart>
        </Recharts.ResponsiveContainer>
      )}
    </GlassCard>
  );
}
