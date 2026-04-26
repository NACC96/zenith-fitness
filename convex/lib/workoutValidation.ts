export type BasicWorkoutSet = {
  weight: number;
  reps: number;
};

export const MAX_LABEL_LENGTH = 120;
export const MAX_WEIGHT = 2_000;
export const MAX_REPS = 1_000;

const ASCII_CONTROL_CHARACTER_PATTERN = /[\x00-\x1F\x7F]/;

export function validateWeight(weight: number): number {
  if (!Number.isFinite(weight) || weight < 0 || weight > MAX_WEIGHT) {
    throw new Error(`weight must be a non-negative finite number no greater than ${MAX_WEIGHT}`);
  }
  return weight;
}

export function validateWorkoutSet<T extends BasicWorkoutSet>(set: T): T {
  validateWeight(set.weight);
  if (!Number.isInteger(set.reps) || set.reps < 1 || set.reps > MAX_REPS) {
    throw new Error(`reps must be a positive integer no greater than ${MAX_REPS}`);
  }
  return set;
}

export function validateLoggedSets<T extends BasicWorkoutSet>(sets: T[]): T[] {
  if (!Array.isArray(sets) || sets.length === 0) {
    throw new Error("At least one set is required");
  }
  return sets.map(validateWorkoutSet);
}

export function normalizeRequiredLabel(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${fieldName} is required`);
  }
  if (ASCII_CONTROL_CHARACTER_PATTERN.test(trimmed)) {
    throw new Error(`${fieldName} contains invalid control characters`);
  }
  if (trimmed.length > MAX_LABEL_LENGTH) {
    throw new Error(`${fieldName} is too long`);
  }
  return trimmed;
}

export function normalizeIsoDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("date must use YYYY-MM-DD format");
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  if (!isRealDate) {
    throw new Error("date must be a real calendar date");
  }

  return value;
}
