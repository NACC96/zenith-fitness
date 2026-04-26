import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_REPS,
  MAX_WEIGHT,
  normalizeIsoDate,
  normalizeRequiredLabel,
  validateLoggedSets,
  validateWeight,
  validateWorkoutSet,
} from "../convex/lib/workoutValidation";

describe("workout validation helpers", () => {
  it("accepts valid integer workout sets and rejects non-integers", () => {
    assert.deepEqual(validateWorkoutSet({ weight: 135, reps: 8 }), { weight: 135, reps: 8 });
    assert.deepEqual(validateWorkoutSet({ weight: 0, reps: 1 }), { weight: 0, reps: 1 });
    assert.throws(() => validateWorkoutSet({ weight: 135, reps: 8.5 }), /reps must be a positive integer/);
  });

  it("validates standalone weights", () => {
    assert.equal(validateWeight(135), 135);
    assert.equal(validateWeight(0), 0);
    assert.throws(() => validateWeight(-1), /weight must be a non-negative finite number/);
    assert.throws(() => validateWeight(Number.POSITIVE_INFINITY), /weight must be a non-negative finite number/);
    assert.throws(() => validateWeight(MAX_WEIGHT + 1), /weight must be a non-negative finite number/);
  });

  it("rejects invalid weights and reps", () => {
    assert.throws(() => validateWorkoutSet({ weight: -1, reps: 8 }), /weight must be a non-negative finite number/);
    assert.throws(() => validateWorkoutSet({ weight: Number.POSITIVE_INFINITY, reps: 8 }), /weight must be a non-negative finite number/);
    assert.throws(() => validateWorkoutSet({ weight: MAX_WEIGHT + 1, reps: 8 }), /weight must be a non-negative finite number/);
    assert.throws(() => validateWorkoutSet({ weight: 135, reps: 0 }), /reps must be a positive integer/);
    assert.throws(() => validateWorkoutSet({ weight: 135, reps: 8.5 }), /reps must be a positive integer/);
    assert.throws(() => validateWorkoutSet({ weight: 135, reps: MAX_REPS + 1 }), /reps must be a positive integer/);
  });

  it("validates non-empty logged set arrays", () => {
    assert.deepEqual(validateLoggedSets([{ weight: 95, reps: 12 }]), [{ weight: 95, reps: 12 }]);
    assert.throws(() => validateLoggedSets([]), /At least one set is required/);
  });

  it("trims labels and rejects empty, oversized, or control-character names", () => {
    assert.equal(normalizeRequiredLabel("  Bench Press  ", "exerciseName"), "Bench Press");
    assert.throws(() => normalizeRequiredLabel("   ", "exerciseName"), /exerciseName is required/);
    assert.throws(() => normalizeRequiredLabel("x".repeat(121), "exerciseName"), /exerciseName is too long/);
    assert.throws(
      () => normalizeRequiredLabel("Bench\nPress", "exerciseName"),
      /exerciseName contains invalid control characters/,
    );
  });

  it("validates ISO workout dates", () => {
    assert.equal(normalizeIsoDate("2026-04-26"), "2026-04-26");
    assert.throws(() => normalizeIsoDate("04/26/2026"), /date must use YYYY-MM-DD/);
    assert.throws(() => normalizeIsoDate("2026-02-31"), /date must be a real calendar date/);
  });
});
