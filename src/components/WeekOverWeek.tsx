"use client";

import { memo, useMemo } from "react";
import GlassCard from "@/components/GlassCard";
import type { WorkoutSession } from "@/lib/types";
import { calcWorkoutVolume, formatNum } from "@/lib/utils";

interface WeekOverWeekProps {
  workouts: WorkoutSession[];
}

interface PeriodStats {
  volume: number;
  sessions: number;
  sets: number;
}

function computeStats(workouts: WorkoutSession[]): PeriodStats {
  let volume = 0;
  let sets = 0;
  for (const w of workouts) {
    volume += calcWorkoutVolume(w);
    for (const ex of w.exercises) {
      sets += ex.sets.length;
    }
  }
  return { volume, sessions: workouts.length, sets };
}

function deltaLabel(thisVal: number, lastVal: number): string {
  if (lastVal === 0 && thisVal > 0) return "+\u221E";
  if (lastVal === 0 && thisVal === 0) return "\u2014";
  const pct = ((thisVal - lastVal) / lastVal) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}%`;
}

function deltaColor(thisVal: number, lastVal: number): string {
  if (lastVal === 0 && thisVal === 0) return "rgba(255,255,255,0.3)";
  return thisVal >= lastVal ? "#10b981" : "#ff2d2d";
}

function deltaArrow(thisVal: number, lastVal: number): string {
  if (lastVal === 0 && thisVal === 0) return "";
  return thisVal >= lastVal ? "\u2191" : "\u2193";
}

function WeekOverWeek({ workouts }: WeekOverWeekProps) {
  const { thisWeekStats, lastWeekStats } = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const today = new Date(todayStr + "T00:00:00");
    const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000);
    const fourteenDaysAgo = new Date(today.getTime() - 14 * 86400000);

    const thisWeek: WorkoutSession[] = [];
    const lastWeek: WorkoutSession[] = [];

    for (const w of workouts) {
      const d = new Date(w.date + "T00:00:00");
      if (d >= sevenDaysAgo && d <= today) {
        thisWeek.push(w);
      } else if (d >= fourteenDaysAgo && d < sevenDaysAgo) {
        lastWeek.push(w);
      }
    }

    return {
      thisWeekStats: computeStats(thisWeek),
      lastWeekStats: computeStats(lastWeek),
    };
  }, [workouts]);

  const metrics = useMemo(
    () => [
      {
        label: "Volume",
        thisVal: thisWeekStats.volume,
        lastVal: lastWeekStats.volume,
        format: (v: number) => formatNum(v),
      },
      {
        label: "Sessions",
        thisVal: thisWeekStats.sessions,
        lastVal: lastWeekStats.sessions,
        format: (v: number) => String(v),
      },
      {
        label: "Sets",
        thisVal: thisWeekStats.sets,
        lastVal: lastWeekStats.sets,
        format: (v: number) => String(v),
      },
    ],
    [thisWeekStats, lastWeekStats]
  );

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
        Week Over Week
      </p>

      <div style={{ display: "flex", gap: 16 }}>
        {metrics.map((m) => (
          <div key={m.label} style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                color: "rgba(255,255,255,0.3)",
                marginBottom: 4,
              }}
            >
              {m.label}
            </p>

            <p
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 18,
                color: "rgba(255,255,255,0.9)",
                lineHeight: 1.2,
              }}
            >
              {m.format(m.thisVal)}
            </p>

            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: deltaColor(m.thisVal, m.lastVal),
                marginTop: 2,
              }}
            >
              {deltaArrow(m.thisVal, m.lastVal)}{" "}
              {deltaLabel(m.thisVal, m.lastVal)}
            </p>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

export default memo(WeekOverWeek);
