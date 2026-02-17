import type { ExercisePerformance, ParsedWorkoutSession, SetEntry } from "./model";

export interface WorkoutSessionFilter {
  workoutTypeId?: string;
  startOccurredAt?: string;
  endOccurredAt?: string;
}

interface ExerciseTotals {
  totalSets: number;
  totalReps: number;
  totalVolumeLbs: number;
}

const roundToHundredths = (value: number): number => Math.round(value * 100) / 100;

const toFiniteNumber = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const toPositiveIntegerOrZero = (value: unknown): number => {
  const numeric = toFiniteNumber(value);
  if (!Number.isInteger(numeric) || numeric < 1) {
    return 0;
  }

  return numeric;
};

const toNonNegativeNumber = (value: unknown): number => {
  const numeric = toFiniteNumber(value);
  if (numeric <= 0) {
    return 0;
  }

  return numeric;
};

const toTimestamp = (value: string): number | null => {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
};

export const calculateExerciseTotals = (
  setEntries: SetEntry[] | null | undefined
): ExerciseTotals => {
  const safeEntries = Array.isArray(setEntries) ? setEntries : [];

  // v1 formula contract:
  // totalSets = number of set entries
  // totalReps = sum(reps)
  // totalVolumeLbs = sum(reps * weightLbs)
  const totalSets = safeEntries.length;
  const totalReps = safeEntries.reduce(
    (sum, entry) => sum + toPositiveIntegerOrZero(entry?.reps),
    0
  );
  const totalVolumeLbs = roundToHundredths(
    safeEntries.reduce((sum, entry) => {
      const reps = toPositiveIntegerOrZero(entry?.reps);
      const weight = toNonNegativeNumber(entry?.weightLbs);
      return sum + reps * weight;
    }, 0)
  );

  return {
    totalSets,
    totalReps,
    totalVolumeLbs,
  };
};

const totalsByExerciseKey = (
  session: ParsedWorkoutSession | null | undefined
): Map<string, ExerciseTotals> => {
  const output = new Map<string, ExerciseTotals>();
  if (!session) {
    return output;
  }

  for (const exercise of session.exercisePerformances) {
    output.set(exercise.exerciseKey, calculateExerciseTotals(exercise.setEntries));
  }

  return output;
};

const totalLbsFromSession = (session: ParsedWorkoutSession | null | undefined): number => {
  if (!session) {
    return 0;
  }

  return roundToHundredths(
    session.exercisePerformances.reduce(
      (sum, exercise) => sum + calculateExerciseTotals(exercise.setEntries).totalVolumeLbs,
      0
    )
  );
};

export const recomputeParsedSessionMetrics = (
  currentSession: ParsedWorkoutSession,
  previousSession: ParsedWorkoutSession | null | undefined
): ParsedWorkoutSession => {
  const previousExerciseTotals = totalsByExerciseKey(previousSession);
  const previousSessionTotalLbs = totalLbsFromSession(previousSession);

  const recomputedExercises: ExercisePerformance[] = currentSession.exercisePerformances.map(
    (exercise) => {
      const totals = calculateExerciseTotals(exercise.setEntries);
      const previousTotals = previousExerciseTotals.get(exercise.exerciseKey);

      return {
        ...exercise,
        totalSets: totals.totalSets,
        totalReps: totals.totalReps,
        totalVolumeLbs: totals.totalVolumeLbs,
        previousSessionVolumeDeltaLbs: previousTotals
          ? roundToHundredths(totals.totalVolumeLbs - previousTotals.totalVolumeLbs)
          : null,
      };
    }
  );

  const totalSets = recomputedExercises.reduce((sum, exercise) => sum + exercise.totalSets, 0);
  const totalReps = recomputedExercises.reduce((sum, exercise) => sum + exercise.totalReps, 0);
  const totalLbsLifted = roundToHundredths(
    recomputedExercises.reduce((sum, exercise) => sum + exercise.totalVolumeLbs, 0)
  );

  return {
    ...currentSession,
    exercisePerformances: recomputedExercises,
    metrics: {
      totalLbsLifted,
      totalSets,
      totalReps,
      previousSessionTotalLbsDelta: previousSession
        ? roundToHundredths(totalLbsLifted - previousSessionTotalLbs)
        : null,
      perExerciseProgression: recomputedExercises.map((exercise) => {
        const previousTotals = previousExerciseTotals.get(exercise.exerciseKey);
        return {
          exerciseKey: exercise.exerciseKey,
          volumeDeltaLbs: previousTotals
            ? roundToHundredths(exercise.totalVolumeLbs - previousTotals.totalVolumeLbs)
            : 0,
          repDelta: previousTotals ? exercise.totalReps - previousTotals.totalReps : 0,
        };
      }),
    },
  };
};

const matchesFilter = (
  session: ParsedWorkoutSession,
  filter: WorkoutSessionFilter
): boolean => {
  if (
    filter.workoutTypeId &&
    session.session.workoutTypeId !== filter.workoutTypeId
  ) {
    return false;
  }

  const sessionTimestamp = toTimestamp(session.session.occurredAt);
  if (sessionTimestamp == null) {
    return false;
  }

  if (filter.startOccurredAt) {
    const startTimestamp = toTimestamp(filter.startOccurredAt);
    if (startTimestamp != null && sessionTimestamp < startTimestamp) {
      return false;
    }
  }

  if (filter.endOccurredAt) {
    const endTimestamp = toTimestamp(filter.endOccurredAt);
    if (endTimestamp != null && sessionTimestamp > endTimestamp) {
      return false;
    }
  }

  return true;
};

export const filterParsedSessions = (
  sessions: ParsedWorkoutSession[],
  filter: WorkoutSessionFilter = {}
): ParsedWorkoutSession[] => {
  return sessions
    .filter((session) => matchesFilter(session, filter))
    .sort((left, right) => {
      const leftTimestamp = toTimestamp(left.session.occurredAt) ?? 0;
      const rightTimestamp = toTimestamp(right.session.occurredAt) ?? 0;
      if (leftTimestamp === rightTimestamp) {
        return left.session.id.localeCompare(right.session.id);
      }
      return leftTimestamp - rightTimestamp;
    });
};

export const findMostRecentSessionBefore = (
  sessions: ParsedWorkoutSession[],
  input: {
    workoutTypeId: string;
    occurredAt: string;
  }
): ParsedWorkoutSession | null => {
  const targetTimestamp = toTimestamp(input.occurredAt);
  if (targetTimestamp == null) {
    return null;
  }

  const previousSessions = sessions
    .filter(
      (session) =>
        session.session.workoutTypeId === input.workoutTypeId &&
        (toTimestamp(session.session.occurredAt) ?? Number.POSITIVE_INFINITY) <
          targetTimestamp
    )
    .sort((left, right) => {
      const leftTimestamp = toTimestamp(left.session.occurredAt) ?? 0;
      const rightTimestamp = toTimestamp(right.session.occurredAt) ?? 0;
      if (leftTimestamp === rightTimestamp) {
        return right.session.id.localeCompare(left.session.id);
      }
      return rightTimestamp - leftTimestamp;
    });

  return previousSessions[0] ?? null;
};
