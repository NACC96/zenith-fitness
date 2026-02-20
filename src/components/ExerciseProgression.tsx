"use client";

import type { WorkoutSession } from "@/lib/types";
import { getMaxWeight, formatNum } from "@/lib/utils";
import GlassCard from "./GlassCard";

interface ExerciseProgressionProps {
  workouts: WorkoutSession[];
}

interface ProgressionEntry {
  name: string;
  firstMax: number;
  lastMax: number;
  change: number;
  pct: number;
}

export default function ExerciseProgression({
  workouts,
}: ExerciseProgressionProps) {
  const sorted = [...workouts].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  // Build progression data for each unique exercise
  const exerciseMap = new Map<string, { first: number; last: number; count: number }>();

  for (const w of sorted) {
    for (const ex of w.exercises) {
      const maxW = getMaxWeight(ex.sets);
      const existing = exerciseMap.get(ex.name);
      if (!existing) {
        exerciseMap.set(ex.name, { first: maxW, last: maxW, count: 1 });
      } else {
        existing.last = maxW;
        existing.count++;
      }
    }
  }

  // Filter to exercises with 2+ data points, compute progression
  const progressions: ProgressionEntry[] = [];
  for (const [name, data] of exerciseMap) {
    if (data.count < 2) continue;
    const change = data.last - data.first;
    const pct = data.first > 0 ? (change / data.first) * 100 : 0;
    progressions.push({
      name,
      firstMax: data.first,
      lastMax: data.last,
      change,
      pct,
    });
  }

  // Sort by absolute change descending, take top 5
  const top = progressions
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 5);

  // For progress bar width: scale relative to max change
  const maxAbsChange = top.length > 0 ? Math.max(...top.map((p) => Math.abs(p.change))) : 1;

  return (
    <GlassCard className="flex-1 p-4 md:p-6">
      <p
        className="uppercase tracking-[0.2em]"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "9px",
          color: "rgba(255,255,255,0.3)",
          marginBottom: "16px",
        }}
      >
        Max Weight Progression
      </p>

      {top.length === 0 ? (
        <div
          className="flex items-center justify-center"
          style={{ height: "140px", color: "rgba(255,255,255,0.2)", fontSize: "13px" }}
        >
          Need 2+ sessions to show progression
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {top.map((entry) => {
            const isPositive = entry.change > 0;
            const barPct =
              maxAbsChange > 0
                ? (Math.abs(entry.change) / maxAbsChange) * 100
                : 0;

            return (
              <div key={entry.name}>
                {/* Name + change */}
                <div className="flex items-center justify-between" style={{ marginBottom: "6px" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.7)",
                    }}
                  >
                    {entry.name}
                  </span>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "11px",
                      color: isPositive ? "#ff2d2d" : "rgba(255,255,255,0.4)",
                    }}
                  >
                    {isPositive ? "+" : ""}
                    {formatNum(entry.change)} lb
                    {entry.pct !== 0 && (
                      <> ({isPositive ? "+" : ""}{formatNum(entry.pct)}%)</>
                    )}
                  </span>
                </div>

                {/* Progress bar */}
                <div
                  style={{
                    height: "4px",
                    borderRadius: "2px",
                    background: "rgba(255,255,255,0.06)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.max(barPct, 2)}%`,
                      borderRadius: "2px",
                      background: isPositive
                        ? "linear-gradient(90deg, #ff2d2d, #cc2424)"
                        : "rgba(255,255,255,0.15)",
                      transition: "width 0.5s ease",
                    }}
                  />
                </div>

                {/* First / last weights */}
                <div
                  className="flex justify-between"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "9px",
                    color: "rgba(255,255,255,0.25)",
                    marginTop: "4px",
                  }}
                >
                  <span>{formatNum(entry.firstMax)} lb</span>
                  <span>{formatNum(entry.lastMax)} lb</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
