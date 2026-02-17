import type {
  WorkoutIngestionRequest,
  WorkoutParseOutput,
} from "./ingestion-contract";
import type {
  OpenRouterModelResponseLog,
  WorkoutParseGatewayResult,
  WorkoutParsingGateway,
} from "./openrouter-client";

export interface MockExerciseSetFixture {
  reps: number;
  weightLbs: number;
}

export interface MockExerciseFixture {
  exerciseKey: string;
  exerciseName: string;
  sets: MockExerciseSetFixture[];
}

export interface MockSessionFixture {
  request: WorkoutIngestionRequest;
  sessionId: string;
  workoutTypeId: string;
  occurredAt: string;
  timezone?: string;
  exercises: MockExerciseFixture[];
  overallConfidence?: number;
  warnings?: WorkoutParseOutput["warnings"];
}

const createFixtureModelLog = (): OpenRouterModelResponseLog => {
  const now = new Date().toISOString();
  return {
    loggedAt: now,
    requestStartedAt: now,
    requestCompletedAt: now,
    durationMs: 0,
    attempt: 1,
    model: "mock-fixture-parser",
    requestPayload: {
      fixture: true,
    },
  };
};

const toParseOutput = (fixture: MockSessionFixture): WorkoutParseOutput => {
  return {
    session: {
      session: {
        id: fixture.sessionId,
        rawLogId: "mock-raw-log-placeholder",
        workoutTypeId: fixture.workoutTypeId,
        occurredAt: fixture.occurredAt,
        timezone: fixture.timezone ?? "UTC",
        parseVersion: 1,
      },
      exercisePerformances: fixture.exercises.map((exercise, exerciseIndex) => ({
        id: `${fixture.sessionId}-${exercise.exerciseKey}`,
        exerciseKey: exercise.exerciseKey,
        exerciseName: exercise.exerciseName,
        exerciseOrder: exerciseIndex + 1,
        setEntries: exercise.sets.map((set, setIndex) => ({
          id: `${fixture.sessionId}-${exercise.exerciseKey}-set-${setIndex + 1}`,
          setIndex: setIndex + 1,
          reps: set.reps,
          weightLbs: set.weightLbs,
        })),
        // Ingestion service recomputes these deterministically before persistence.
        totalSets: 1,
        totalReps: 1,
        totalVolumeLbs: 1,
        previousSessionVolumeDeltaLbs: 0,
      })),
      metrics: {
        // Ingestion service recomputes these deterministically before persistence.
        totalLbsLifted: 1,
        totalSets: 1,
        totalReps: 1,
        previousSessionTotalLbsDelta: 0,
        perExerciseProgression: fixture.exercises.map((exercise) => ({
          exerciseKey: exercise.exerciseKey,
          volumeDeltaLbs: 0,
          repDelta: 0,
        })),
      },
    },
    overallConfidence: fixture.overallConfidence ?? 0.98,
    fieldConfidence: [
      {
        fieldPath: "session.occurredAt",
        confidence: 0.95,
      },
      {
        fieldPath: "exercisePerformances[0].setEntries",
        confidence: 0.96,
      },
    ],
    errors: [],
    warnings: fixture.warnings ?? [],
  };
};

export class MockWorkoutFixtureParser implements WorkoutParsingGateway {
  private readonly responsesByRawText = new Map<string, WorkoutParseOutput>();

  constructor(fixtures: MockSessionFixture[]) {
    for (const fixture of fixtures) {
      this.responsesByRawText.set(fixture.request.rawText, toParseOutput(fixture));
    }
  }

  async parseWorkout(
    request: WorkoutIngestionRequest
  ): Promise<WorkoutParseGatewayResult> {
    const parse = this.responsesByRawText.get(request.rawText);
    if (!parse) {
      throw new Error(`Missing mock fixture parse output for rawText: ${request.rawText}`);
    }

    return {
      parse: structuredClone(parse),
      modelLog: createFixtureModelLog(),
    };
  }
}

export const DEFAULT_BUILTIN_WORKOUT_FIXTURES: MockSessionFixture[] = [
  {
    request: {
      rawText: "mock chest session 1",
      submittedAt: "2026-01-05T16:00:00Z",
      ingestionMode: "auto_save",
      workoutTypeHintSlug: "chest",
      timezone: "America/New_York",
    },
    sessionId: "mock-session-chest-1",
    workoutTypeId: "workout-type-chest",
    occurredAt: "2026-01-05T16:00:00Z",
    timezone: "America/New_York",
    exercises: [
      {
        exerciseKey: "barbell-bench-press",
        exerciseName: "Barbell Bench Press",
        sets: [
          { reps: 10, weightLbs: 100 },
          { reps: 8, weightLbs: 110 },
          { reps: 6, weightLbs: 120 },
        ],
      },
    ],
  },
  {
    request: {
      rawText: "mock back session 1",
      submittedAt: "2026-01-07T16:00:00Z",
      ingestionMode: "auto_save",
      workoutTypeHintSlug: "back",
      timezone: "America/New_York",
    },
    sessionId: "mock-session-back-1",
    workoutTypeId: "workout-type-back",
    occurredAt: "2026-01-07T16:00:00Z",
    timezone: "America/New_York",
    exercises: [
      {
        exerciseKey: "barbell-row",
        exerciseName: "Barbell Row",
        sets: [
          { reps: 10, weightLbs: 115 },
          { reps: 8, weightLbs: 125 },
          { reps: 6, weightLbs: 135 },
        ],
      },
    ],
  },
  {
    request: {
      rawText: "mock legs session 1",
      submittedAt: "2026-01-09T16:00:00Z",
      ingestionMode: "auto_save",
      workoutTypeHintSlug: "legs",
      timezone: "America/New_York",
    },
    sessionId: "mock-session-legs-1",
    workoutTypeId: "workout-type-legs",
    occurredAt: "2026-01-09T16:00:00Z",
    timezone: "America/New_York",
    exercises: [
      {
        exerciseKey: "barbell-squat",
        exerciseName: "Barbell Squat",
        sets: [
          { reps: 8, weightLbs: 185 },
          { reps: 6, weightLbs: 205 },
          { reps: 5, weightLbs: 225 },
        ],
      },
    ],
  },
  {
    request: {
      rawText: "mock chest session 2",
      submittedAt: "2026-01-12T16:00:00Z",
      ingestionMode: "auto_save",
      workoutTypeHintSlug: "chest",
      timezone: "America/New_York",
    },
    sessionId: "mock-session-chest-2",
    workoutTypeId: "workout-type-chest",
    occurredAt: "2026-01-12T16:00:00Z",
    timezone: "America/New_York",
    exercises: [
      {
        exerciseKey: "barbell-bench-press",
        exerciseName: "Barbell Bench Press",
        sets: [
          { reps: 10, weightLbs: 105 },
          { reps: 8, weightLbs: 115 },
          { reps: 6, weightLbs: 125 },
        ],
      },
    ],
  },
  {
    request: {
      rawText: "mock back session 2",
      submittedAt: "2026-01-14T16:00:00Z",
      ingestionMode: "auto_save",
      workoutTypeHintSlug: "back",
      timezone: "America/New_York",
    },
    sessionId: "mock-session-back-2",
    workoutTypeId: "workout-type-back",
    occurredAt: "2026-01-14T16:00:00Z",
    timezone: "America/New_York",
    exercises: [
      {
        exerciseKey: "barbell-row",
        exerciseName: "Barbell Row",
        sets: [
          { reps: 10, weightLbs: 120 },
          { reps: 8, weightLbs: 130 },
          { reps: 6, weightLbs: 140 },
        ],
      },
    ],
  },
  {
    request: {
      rawText: "mock legs session 2",
      submittedAt: "2026-01-16T16:00:00Z",
      ingestionMode: "auto_save",
      workoutTypeHintSlug: "legs",
      timezone: "America/New_York",
    },
    sessionId: "mock-session-legs-2",
    workoutTypeId: "workout-type-legs",
    occurredAt: "2026-01-16T16:00:00Z",
    timezone: "America/New_York",
    exercises: [
      {
        exerciseKey: "barbell-squat",
        exerciseName: "Barbell Squat",
        sets: [
          { reps: 8, weightLbs: 195 },
          { reps: 6, weightLbs: 215 },
          { reps: 5, weightLbs: 235 },
        ],
      },
    ],
  },
];
