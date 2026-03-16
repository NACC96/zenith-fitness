"use client";

import { memo, useMemo } from "react";
import GlassCard from "@/components/GlassCard";
import type { WorkoutSession } from "@/lib/types";

interface TrainingStreakProps {
  workouts: WorkoutSession[];
}

/** Get ISO week number for a given date. */
function getISOWeekNumber(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Encode year+week into a single sortable number. */
function weekKey(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  return d.getUTCFullYear() * 100 + getISOWeekNumber(date);
}

/** Decrement a year-week key by 1 week. */
function prevWeekKey(key: number): number {
  const year = Math.floor(key / 100);
  const week = key % 100;
  if (week <= 1) {
    // last week of previous year – approximate with 52
    // (ISO years can have 52 or 53 weeks; 52 is safe for streak counting)
    return (year - 1) * 100 + 52;
  }
  return year * 100 + (week - 1);
}

function TrainingStreak({ workouts }: TrainingStreakProps) {
  const { currentStreak, longestStreak } = useMemo(() => {
    if (workouts.length === 0) return { currentStreak: 0, longestStreak: 0 };

    const weekSet = new Set<number>();
    for (const w of workouts) {
      const d = new Date(w.date + "T00:00:00");
      weekSet.add(weekKey(d));
    }

    // Current streak: walk backward from this week
    const now = new Date();
    let cursor = weekKey(now);
    let current = 0;

    while (weekSet.has(cursor)) {
      current++;
      cursor = prevWeekKey(cursor);
    }

    // Longest streak: sort all unique weeks and scan
    const sortedWeeks = Array.from(weekSet).sort((a, b) => a - b);
    let longest = 0;
    let run = 1;

    for (let i = 1; i < sortedWeeks.length; i++) {
      // Check if this week directly follows the previous
      const expected = sortedWeeks[i - 1];
      let next = expected;
      // Walk forward one week
      const ey = Math.floor(expected / 100);
      const ew = expected % 100;
      if (ew >= 52) {
        // Could be last week of year; try both 53 and next year week 1
        const candidate53 = ey * 100 + 53;
        const candidateNext = (ey + 1) * 100 + 1;
        if (sortedWeeks[i] === expected + 1 && ew < 53) {
          next = sortedWeeks[i];
        } else if (sortedWeeks[i] === candidate53) {
          next = sortedWeeks[i];
        } else if (sortedWeeks[i] === candidateNext) {
          next = sortedWeeks[i];
        }
      } else {
        next = expected + 1;
      }

      if (sortedWeeks[i] === next) {
        run++;
      } else {
        longest = Math.max(longest, run);
        run = 1;
      }
    }
    longest = Math.max(longest, run, current);

    return { currentStreak: current, longestStreak: longest };
  }, [workouts]);

  if (workouts.length === 0) {
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
          Training Streak
        </p>
        <p
          style={{
            color: "rgba(255,255,255,0.3)",
            fontSize: 13,
            textAlign: "center",
            marginTop: 24,
          }}
        >
          No sessions logged yet
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
        Training Streak
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 28,
            color: currentStreak >= 3 ? "#ff2d2d" : "rgba(255,255,255,0.9)",
            lineHeight: 1,
          }}
        >
          {currentStreak}
        </span>

        {currentStreak > 0 && (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            style={{ flexShrink: 0 }}
          >
            <path
              d="M12 2C12 2 4 8.5 4 14.5C4 18.09 6.91 21 10.5 21C10.5 21 8 18 8 15.5C8 13 10 11 10 11C10 11 10.5 14 12 15.5C13.5 17 14 19 14 19C14 19 20 16 20 11C20 8 17 5 17 5C17 5 17 8 15 9.5C13 11 12 2 12 2Z"
              fill={currentStreak >= 3 ? "#ff2d2d" : "rgba(255,255,255,0.4)"}
            />
          </svg>
        )}
      </div>

      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: "0.2em",
          color: "rgba(255,255,255,0.3)",
          marginTop: 4,
        }}
      >
        week streak
      </p>

      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "rgba(255,255,255,0.25)",
          marginTop: 8,
        }}
      >
        Longest: {longestStreak} week{longestStreak !== 1 ? "s" : ""}
      </p>
    </GlassCard>
  );
}

export default memo(TrainingStreak);
