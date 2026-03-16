"use client";

import { memo, useState, useEffect, useMemo } from "react";
import type { WorkoutSession } from "@/lib/types";
import { est1RM } from "@/lib/utils";
import GlassCard from "./GlassCard";

interface OneRepMaxChartProps {
  workouts: WorkoutSession[];
}

const LINE_COLORS = ["#ff2d2d", "#10b981", "#3b82f6", "#f59e0b", "#8b5cf6"];

interface E1RMTooltipPayloadItem {
  value: number;
  dataKey: string;
  color: string;
}

interface E1RMTooltipProps {
  active?: boolean;
  payload?: E1RMTooltipPayloadItem[];
  label?: string;
}

function E1RMTooltip({ active, payload, label }: E1RMTooltipProps) {
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
              color: entry.color,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "11px",
              margin: 0,
            }}
          >
            {entry.dataKey}: {Math.round(entry.value)} lb
          </p>
        ))}
    </div>
  );
}

export default memo(function OneRepMaxChart({ workouts }: OneRepMaxChartProps) {
  const [mounted, setMounted] = useState(false);
  const [Recharts, setRecharts] = useState<typeof import("recharts") | null>(
    null,
  );

  useEffect(() => {
    setMounted(true);
    import("recharts").then(setRecharts);
  }, []);

  const { data, exercises } = useMemo(() => {
    if (workouts.length < 2) return { data: [], exercises: [] };

    const sorted = [...workouts].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    // Build map: exerciseName → Array<{ date, e1rm }>
    const exerciseMap = new Map<string, { date: string; e1rm: number }[]>();
    const frequencyMap = new Map<string, number>();

    for (const w of sorted) {
      const dateLabel = new Date(w.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      for (const ex of w.exercises) {
        let maxE1rm = 0;
        for (const set of ex.sets) {
          const e = est1RM(set.weight, set.reps);
          if (e > maxE1rm) maxE1rm = e;
        }
        if (maxE1rm > 0) {
          if (!exerciseMap.has(ex.name)) exerciseMap.set(ex.name, []);
          exerciseMap.get(ex.name)!.push({ date: dateLabel, e1rm: Math.round(maxE1rm) });
          frequencyMap.set(ex.name, (frequencyMap.get(ex.name) || 0) + 1);
        }
      }
    }

    // Select top 5 by frequency
    const topExercises = [...frequencyMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    // Build unified data array keyed by date
    const dateMap = new Map<string, Record<string, number>>();
    for (const name of topExercises) {
      for (const point of exerciseMap.get(name) || []) {
        if (!dateMap.has(point.date)) dateMap.set(point.date, {});
        dateMap.get(point.date)![name] = point.e1rm;
      }
    }

    // Preserve chronological order
    const allDates: string[] = [];
    for (const w of sorted) {
      const dateLabel = new Date(w.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      if (!allDates.includes(dateLabel)) allDates.push(dateLabel);
    }

    const chartData = allDates
      .filter((d) => dateMap.has(d))
      .map((date) => ({ date, ...dateMap.get(date)! }));

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
        Estimated 1RM Progression
      </p>

      {data.length === 0 ? (
        <div
          className="flex items-center justify-center"
          style={{ height: "220px", color: "rgba(255,255,255,0.2)", fontSize: "13px" }}
        >
          Need 2+ sessions for progression
        </div>
      ) : !mounted || !Recharts ? (
        <div style={{ height: "220px" }} />
      ) : (
        <>
          <Recharts.ResponsiveContainer width="100%" height={220}>
            <Recharts.LineChart data={data}>
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
              <Recharts.Tooltip content={<E1RMTooltip />} />
              {exercises.map((name, i) => (
                <Recharts.Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={LINE_COLORS[i]}
                  strokeWidth={2}
                  dot={{ r: 3, fill: LINE_COLORS[i], stroke: "#0c0c0c", strokeWidth: 2 }}
                  connectNulls
                />
              ))}
            </Recharts.LineChart>
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
                    borderRadius: "50%",
                    backgroundColor: LINE_COLORS[i],
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
