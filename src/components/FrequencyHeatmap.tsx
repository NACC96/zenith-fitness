"use client";

import { memo, useMemo } from "react";
import GlassCard from "@/components/GlassCard";
import type { WorkoutSession } from "@/lib/types";
import { calcWorkoutVolume } from "@/lib/utils";

interface FrequencyHeatmapProps {
  workouts: WorkoutSession[];
}

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;
const WEEKS = 12;
const CELL_SIZE = 14;
const CELL_GAP = 2;

function FrequencyHeatmap({ workouts }: FrequencyHeatmapProps) {
  const { grid, maxVolume } = useMemo(() => {
    // Build a map of date -> total volume for that day
    const volumeByDate: Record<string, number> = {};
    for (const w of workouts) {
      const vol = calcWorkoutVolume(w);
      volumeByDate[w.date] = (volumeByDate[w.date] || 0) + vol;
    }

    // Find the Monday 12 weeks ago
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const today = new Date(todayStr + "T00:00:00");
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ...
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const thisMonday = new Date(today.getTime() - mondayOffset * 86400000);
    const startMonday = new Date(
      thisMonday.getTime() - (WEEKS - 1) * 7 * 86400000
    );

    // Build grid: grid[row=dayOfWeek][col=weekIndex]
    const cells: { date: string; volume: number }[][] = [];
    let peak = 0;

    for (let day = 0; day < 7; day++) {
      cells[day] = [];
      for (let week = 0; week < WEEKS; week++) {
        const cellDate = new Date(
          startMonday.getTime() + (week * 7 + day) * 86400000
        );
        const dateStr = cellDate.toISOString().slice(0, 10);
        const vol = volumeByDate[dateStr] || 0;
        if (vol > peak) peak = vol;
        cells[day].push({ date: dateStr, volume: vol });
      }
    }

    return { grid: cells, maxVolume: peak };
  }, [workouts]);

  const labelWidth = 16;

  return (
    <GlassCard className="p-5">
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: "0.2em",
          color: "rgba(255,255,255,0.3)",
          marginBottom: 14,
        }}
      >
        Training Frequency // Last 12 Weeks
      </p>

      <div style={{ display: "flex", gap: 0 }}>
        {/* Day labels column */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: CELL_GAP,
            width: labelWidth,
            flexShrink: 0,
          }}
        >
          {DAY_LABELS.map((label, i) => (
            <div
              key={i}
              style={{
                height: CELL_SIZE,
                display: "flex",
                alignItems: "center",
                fontFamily: "var(--font-mono)",
                fontSize: 8,
                color: "rgba(255,255,255,0.2)",
                lineHeight: 1,
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Heatmap grid */}
        <div
          style={{
            display: "grid",
            gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`,
            gridTemplateColumns: `repeat(${WEEKS}, ${CELL_SIZE}px)`,
            gap: CELL_GAP,
          }}
        >
          {grid.flatMap((row, dayIndex) =>
            row.map((cell, weekIndex) => {
              const intensity =
                cell.volume > 0 && maxVolume > 0
                  ? cell.volume / maxVolume
                  : 0;

              const bg =
                cell.volume === 0
                  ? "rgba(255,255,255,0.04)"
                  : `rgba(255,45,45,${(0.15 + intensity * 0.65).toFixed(2)})`;

              return (
                <div
                  key={`${dayIndex}-${weekIndex}`}
                  title={`${cell.date}: ${cell.volume > 0 ? cell.volume.toLocaleString() + " lbs" : "Rest"}`}
                  style={{
                    gridRow: dayIndex + 1,
                    gridColumn: weekIndex + 1,
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    borderRadius: 2,
                    background: bg,
                  }}
                />
              );
            })
          )}
        </div>
      </div>
    </GlassCard>
  );
}

export default memo(FrequencyHeatmap);
