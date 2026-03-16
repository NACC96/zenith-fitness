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

/** Rest duration in ms for a set, or null if timing data is missing */
export function getRestDurationMs(set: WorkoutSet): number | null {
  if (set.restStartedAt == null || set.restEndedAt == null) return null;
  return Math.max(0, set.restEndedAt - set.restStartedAt);
}

/** Session duration in ms, or null if timing data is missing */
export function getSessionDurationMs(w: WorkoutSession): number | null {
  if (w.firstSetStartedAt == null || w.lastSetEndedAt == null) return null;
  return Math.max(0, w.lastSetEndedAt - w.firstSetStartedAt);
}

const MUSCLE_KEYWORDS: [string, string[]][] = [
  ["Legs", ["squat", "leg", "lunge", "calf", "hamstring", "quad", "glute", "rdl"]],
  ["Back", ["row", "pull-up", "pullup", "lat", "deadlift", "back"]],
  ["Chest", ["bench", "fly", "chest", "push-up", "pushup", "pec"]],
  ["Shoulders", ["shoulder", "delt", "lateral raise", "ohp", "military"]],
  ["Arms", ["curl", "tricep", "bicep", "arm", "hammer", "extension"]],
  ["Core", ["plank", "crunch", "ab", "core", "sit-up"]],
];

/** Best-effort mapping of exercise name to muscle group */
export function exerciseToMuscleGroup(name: string): string {
  const lower = name.toLowerCase();
  for (const [group, keywords] of MUSCLE_KEYWORDS) {
    if (keywords.some((k) => lower.includes(k))) return group;
  }
  return "Other";
}
