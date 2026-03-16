"use client";

import { memo, useMemo } from "react";
import GlassCard from "@/components/GlassCard";
import type { WorkoutSession } from "@/lib/types";
import {
  calcWorkoutVolume,
  formatNum,
  getSessionDurationMs,
} from "@/lib/utils";

interface PeriodComparisonProps {
  workouts: WorkoutSession[];
}

interface PeriodData {
  volume: number;
  sessions: number;
  avgIntensity: number;
  avgDurationMin: number;
}

function computePeriod(workouts: WorkoutSession[]): PeriodData {
  let volume = 0;
  let totalWeight = 0;
  let totalReps = 0;
  let durationSum = 0;
  let durationCount = 0;

  for (const w of workouts) {
    volume += calcWorkoutVolume(w);
    for (const ex of w.exercises) {
      for (const s of ex.sets) {
        totalWeight += s.weight;
        totalReps += s.reps;
      }
    }
    const dur = getSessionDurationMs(w);
    if (dur !== null) {
      durationSum += dur;
      durationCount++;
    }
  }

  return {
    volume,
    sessions: workouts.length,
    avgIntensity: totalReps > 0 ? totalWeight / totalReps : 0,
    avgDurationMin:
      durationCount > 0 ? durationSum / durationCount / 60000 : 0,
  };
}

function deltaStr(recent: number, previous: number): string {
  if (previous === 0 && recent > 0) return "+\u221E";
  if (previous === 0 && recent === 0) return "\u2014";
  const pct = ((recent - previous) / previous) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}%`;
}

function deltaColor(recent: number, previous: number): string {
  if (previous === 0 && recent === 0) return "rgba(255,255,255,0.3)";
  return recent >= previous ? "#10b981" : "#ff2d2d";
}

function deltaArrow(recent: number, previous: number): string {
  if (previous === 0 && recent === 0) return "";
  return recent >= previous ? "\u2191" : "\u2193";
}

function PeriodComparison({ workouts }: PeriodComparisonProps) {
  const { recent, previous, hasData } = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const today = new Date(todayStr + "T00:00:00");
    const d28 = new Date(today.getTime() - 28 * 86400000);
    const d56 = new Date(today.getTime() - 56 * 86400000);

    const recentWorkouts: WorkoutSession[] = [];
    const prevWorkouts: WorkoutSession[] = [];

    for (const w of workouts) {
      const d = new Date(w.date + "T00:00:00");
      if (d >= d28 && d <= today) {
        recentWorkouts.push(w);
      } else if (d >= d56 && d < d28) {
        prevWorkouts.push(w);
      }
    }

    const hasAny = recentWorkouts.length > 0 || prevWorkouts.length > 0;

    return {
      recent: computePeriod(recentWorkouts),
      previous: computePeriod(prevWorkouts),
      hasData: hasAny,
    };
  }, [workouts]);

  const rows = useMemo(
    () => [
      {
        label: "Volume",
        recentVal: formatNum(recent.volume),
        prevVal: formatNum(previous.volume),
        recentRaw: recent.volume,
        prevRaw: previous.volume,
      },
      {
        label: "Sessions",
        recentVal: String(recent.sessions),
        prevVal: String(previous.sessions),
        recentRaw: recent.sessions,
        prevRaw: previous.sessions,
      },
      {
        label: "Avg Intensity",
        recentVal: formatNum(recent.avgIntensity, 1) + " lbs",
        prevVal: formatNum(previous.avgIntensity, 1) + " lbs",
        recentRaw: recent.avgIntensity,
        prevRaw: previous.avgIntensity,
      },
      {
        label: "Avg Duration",
        recentVal: recent.avgDurationMin > 0 ? `${formatNum(recent.avgDurationMin, 0)} min` : "\u2014",
        prevVal: previous.avgDurationMin > 0 ? `${formatNum(previous.avgDurationMin, 0)} min` : "\u2014",
        recentRaw: recent.avgDurationMin,
        prevRaw: previous.avgDurationMin,
      },
    ],
    [recent, previous]
  );

  if (!hasData) {
    return (
      <GlassCard className="p-5">
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            color: "rgba(255,255,255,0.3)",
          }}
        >
          4-Week Comparison
        </p>
        <p
          style={{
            color: "rgba(255,255,255,0.3)",
            fontSize: 13,
            textAlign: "center",
            marginTop: 24,
          }}
        >
          Need 4+ weeks of data
        </p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-5">
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: "0.2em",
          color: "rgba(255,255,255,0.3)",
          marginBottom: 12,
        }}
      >
        4-Week Comparison
      </p>

      {/* Header row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 70px",
          gap: 4,
          marginBottom: 6,
        }}
      >
        <span />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 8,
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            color: "rgba(255,255,255,0.2)",
          }}
        >
          Recent
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 8,
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            color: "rgba(255,255,255,0.2)",
          }}
        >
          Previous
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 8,
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            color: "rgba(255,255,255,0.2)",
          }}
        >
          Delta
        </span>
      </div>

      {/* Data rows */}
      {rows.map((row) => (
        <div
          key={row.label}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 70px",
            gap: 4,
            paddingTop: 6,
            paddingBottom: 6,
            borderTop: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "rgba(255,255,255,0.5)",
            }}
          >
            {row.label}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "rgba(255,255,255,0.85)",
              fontWeight: 600,
            }}
          >
            {row.recentVal}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "rgba(255,255,255,0.4)",
            }}
          >
            {row.prevVal}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: deltaColor(row.recentRaw, row.prevRaw),
            }}
          >
            {deltaArrow(row.recentRaw, row.prevRaw)}{" "}
            {deltaStr(row.recentRaw, row.prevRaw)}
          </span>
        </div>
      ))}
    </GlassCard>
  );
}

export default memo(PeriodComparison);
