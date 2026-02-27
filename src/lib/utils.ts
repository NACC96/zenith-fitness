import type { WorkoutSet, WorkoutSession } from "./types";

/** Total volume for a list of sets: sum of weight × reps */
export function calcVolume(sets: WorkoutSet[]): number {
  return sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
}

/** Total volume across all exercises in a workout session */
export function calcWorkoutVolume(workout: WorkoutSession): number {
  return workout.exercises.reduce((sum, ex) => sum + calcVolume(ex.sets), 0);
}

/** Heaviest weight used in a list of sets */
export function getMaxWeight(sets: WorkoutSet[]): number {
  return Math.max(...sets.map((s) => s.weight));
}

/** Epley estimated 1-rep max: weight × (1 + reps / 30) */
export function est1RM(weight: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/** Format a number with locale-aware separators, rounding to given decimals */
export function formatNum(n: number, decimals = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a duration in milliseconds as zero-padded mm:ss.
 * Minutes are intentionally unbounded (for example, 90 minutes -> "90:00").
 */
export function formatDuration(ms: number): string {
  const safeMs = Math.max(0, ms);
  const minutes = Math.floor(safeMs / 60000);
  const seconds = Math.floor((safeMs % 60000) / 1000);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
