"use client";

import { useMemo } from "react";
import type { WorkoutSession } from "@/lib/types";
import {
  calcWorkoutVolume,
  getMaxWeight,
  getRestDurationMs,
  formatDuration,
} from "@/lib/utils";

export interface SectionPreviews {
  periodInsights: string;
  strength: string;
  deepAnalysis: string;
  activityHistory: string;
}

export function useSectionPreviews(
  allWorkouts: WorkoutSession[],
  filteredSessions: WorkoutSession[],
): SectionPreviews {
  const periodInsights = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const today = new Date(todayStr + "T00:00:00");
    const d28 = new Date(today.getTime() - 28 * 86400000);
    const d56 = new Date(today.getTime() - 56 * 86400000);

    let recentVol = 0;
    let prevVol = 0;

    for (const w of allWorkouts) {
      const d = new Date(w.date + "T00:00:00");
      const vol = calcWorkoutVolume(w);
      if (d >= d28 && d <= today) recentVol += vol;
      else if (d >= d56 && d < d28) prevVol += vol;
    }

    if (prevVol === 0 && recentVol === 0) return "No data yet";
    if (prevVol === 0) return "New data this period";

    const pct = ((recentVol - prevVol) / prevVol) * 100;
    const sign = pct >= 0 ? "\u2191" : "\u2193";
    return `${sign} ${Math.abs(pct).toFixed(0)}% vol vs prior 28d`;
  }, [allWorkouts]);

  const strength = useMemo(() => {
    const sorted = [...filteredSessions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    const exerciseMap = new Map<
      string,
      { first: number; last: number; count: number }
    >();

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

    let bestName = "";
    let bestChange = 0;

    for (const [name, data] of exerciseMap) {
      if (data.count < 2) continue;
      const change = data.last - data.first;
      if (Math.abs(change) > Math.abs(bestChange)) {
        bestChange = change;
        bestName = name;
      }
    }

    if (!bestName) return "Need 2+ sessions";
    const sign = bestChange >= 0 ? "+" : "";
    return `${bestName} ${sign}${bestChange} lb`;
  }, [filteredSessions]);

  const deepAnalysis = useMemo(() => {
    const allRestMs: number[] = [];

    for (const w of filteredSessions) {
      for (const ex of w.exercises) {
        for (const set of ex.sets) {
          const rest = getRestDurationMs(set);
          if (rest != null) allRestMs.push(rest);
        }
      }
    }

    if (allRestMs.length === 0) return "No rest data";

    const avg = allRestMs.reduce((a, b) => a + b, 0) / allRestMs.length;
    return `Avg rest ${formatDuration(avg)}`;
  }, [filteredSessions]);

  const activityHistory = useMemo(() => {
    // Count recent PRs (weight PRs from last 30 days)
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const today = new Date(todayStr + "T00:00:00");
    const cutoff = new Date(today.getTime() - 30 * 86400000);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const exerciseMaxWeight: Record<string, { value: number; date: string }> =
      {};

    for (const w of allWorkouts) {
      for (const ex of w.exercises) {
        for (const s of ex.sets) {
          if (
            !exerciseMaxWeight[ex.name] ||
            s.weight > exerciseMaxWeight[ex.name].value
          ) {
            exerciseMaxWeight[ex.name] = { value: s.weight, date: w.date };
          }
        }
      }
    }

    let prCount = 0;
    for (const record of Object.values(exerciseMaxWeight)) {
      if (record.date >= cutoffStr) prCount++;
    }

    const sessionCount = allWorkouts.length;
    return `${prCount} PR${prCount !== 1 ? "s" : ""} // ${sessionCount} session${sessionCount !== 1 ? "s" : ""}`;
  }, [allWorkouts]);

  return { periodInsights, strength, deepAnalysis, activityHistory };
}
