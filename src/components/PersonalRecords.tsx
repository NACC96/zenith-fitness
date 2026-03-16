"use client";

import { memo, useMemo } from "react";
import GlassCard from "@/components/GlassCard";
import type { WorkoutSession } from "@/lib/types";
import { formatNum } from "@/lib/utils";

interface PersonalRecordsProps {
  workouts: WorkoutSession[];
}

interface PREntry {
  exerciseName: string;
  type: "Weight PR" | "Volume PR";
  value: number;
  unit: string;
  date: string;
}

function PersonalRecords({ workouts }: PersonalRecordsProps) {
  const recentPRs = useMemo(() => {
    if (workouts.length === 0) return [];

    // Track per exercise: best weight and best single-set volume, with dates
    const exerciseMaxWeight: Record<
      string,
      { value: number; date: string }
    > = {};
    const exerciseMaxVolume: Record<
      string,
      { value: number; date: string }
    > = {};

    for (const w of workouts) {
      for (const ex of w.exercises) {
        const name = ex.name;
        for (const s of ex.sets) {
          // Weight PR
          if (
            !exerciseMaxWeight[name] ||
            s.weight > exerciseMaxWeight[name].value ||
            (s.weight === exerciseMaxWeight[name].value &&
              w.date > exerciseMaxWeight[name].date)
          ) {
            if (
              !exerciseMaxWeight[name] ||
              s.weight >= exerciseMaxWeight[name].value
            ) {
              exerciseMaxWeight[name] = { value: s.weight, date: w.date };
            }
          }

          // Volume PR (single set)
          const setVol = s.weight * s.reps;
          if (
            !exerciseMaxVolume[name] ||
            setVol > exerciseMaxVolume[name].value ||
            (setVol === exerciseMaxVolume[name].value &&
              w.date > exerciseMaxVolume[name].date)
          ) {
            if (
              !exerciseMaxVolume[name] ||
              setVol >= exerciseMaxVolume[name].value
            ) {
              exerciseMaxVolume[name] = { value: setVol, date: w.date };
            }
          }
        }
      }
    }

    // Filter to PRs from last 30 days
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const today = new Date(todayStr + "T00:00:00");
    const cutoff = new Date(today.getTime() - 30 * 86400000);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const prs: PREntry[] = [];

    for (const [name, record] of Object.entries(exerciseMaxWeight)) {
      if (record.date >= cutoffStr && record.value > 0) {
        prs.push({
          exerciseName: name,
          type: "Weight PR",
          value: record.value,
          unit: "lbs",
          date: record.date,
        });
      }
    }

    for (const [name, record] of Object.entries(exerciseMaxVolume)) {
      if (record.date >= cutoffStr && record.value > 0) {
        // Avoid duplicate if same exercise already has a weight PR on same date
        const existing = prs.find(
          (p) =>
            p.exerciseName === name &&
            p.date === record.date &&
            p.type === "Weight PR"
        );
        if (!existing) {
          prs.push({
            exerciseName: name,
            type: "Volume PR",
            value: record.value,
            unit: "lbs",
            date: record.date,
          });
        }
      }
    }

    // Sort by date desc, limit 8
    prs.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
    return prs.slice(0, 8);
  }, [workouts]);

  if (recentPRs.length === 0) {
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
          Recent Personal Records
        </p>
        <p
          style={{
            color: "rgba(255,255,255,0.3)",
            fontSize: 13,
            textAlign: "center",
            marginTop: 24,
          }}
        >
          Log more sessions to see PRs
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
        Recent Personal Records
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {recentPRs.map((pr, i) => (
          <div
            key={`${pr.exerciseName}-${pr.type}-${i}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              paddingBottom: 8,
              borderBottom:
                i < recentPRs.length - 1
                  ? "1px solid rgba(255,255,255,0.05)"
                  : "none",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.7)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  lineHeight: 1.3,
                }}
              >
                {pr.exerciseName}
              </p>
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "rgba(255,255,255,0.25)",
                  marginTop: 1,
                }}
              >
                {pr.date}
              </p>
            </div>

            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 8,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "#ff2d2d",
                border: "1px solid rgba(255,45,45,0.3)",
                borderRadius: 4,
                padding: "2px 6px",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {pr.type}
            </span>

            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "rgba(255,255,255,0.85)",
                fontWeight: 600,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {formatNum(pr.value)} {pr.unit}
            </span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

export default memo(PersonalRecords);
