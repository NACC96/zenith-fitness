import type {
  WorkoutIngestionRequest,
  WorkoutParseOutput,
} from "../src/workouts/ingestion-contract.ts";
import { buildDashboardAnalyticsView } from "../src/workouts/dashboard-analytics.ts";
import { InMemoryWorkoutIngestionRepository } from "../src/workouts/ingestion-repository.ts";
import { WorkoutIngestionService } from "../src/workouts/ingestion-service.ts";
import type {
  OpenRouterModelResponseLog,
  WorkoutParseGatewayResult,
  WorkoutParsingGateway,
} from "../src/workouts/openrouter-client.ts";

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

interface FixtureExerciseSet {
  reps: number;
  weightLbs: number;
}

interface FixtureExercise {
  exerciseKey: string;
  exerciseName: string;
  sets: FixtureExerciseSet[];
}

interface SessionFixture {
  request: WorkoutIngestionRequest;
  sessionId: string;
  workoutTypeId: string;
  occurredAt: string;
  exercises: FixtureExercise[];
}

const createModelLog = (): OpenRouterModelResponseLog => {
  const now = new Date().toISOString();
  return {
    loggedAt: now,
    requestStartedAt: now,
    requestCompletedAt: now,
    durationMs: 0,
    attempt: 1,
    model: "fixture-parser",
    requestPayload: {},
  };
};

const toParseOutput = (fixture: SessionFixture): WorkoutParseOutput => {
  return {
    session: {
      session: {
        id: fixture.sessionId,
        rawLogId: "placeholder-raw-log",
        workoutTypeId: fixture.workoutTypeId,
        occurredAt: fixture.occurredAt,
        timezone: "UTC",
        parseVersion: 999,
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
        // Intentionally incorrect to ensure deterministic recomputation in ingestion.
        totalSets: 1,
        totalReps: 1,
        totalVolumeLbs: 1,
        previousSessionVolumeDeltaLbs: 0,
      })),
      metrics: {
        // Intentionally incorrect to ensure deterministic recomputation in ingestion.
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
    overallConfidence: 0.98,
    fieldConfidence: [],
    errors: [],
    warnings: [],
  };
};

class FixtureParser implements WorkoutParsingGateway {
  private readonly responsesByRawText = new Map<string, WorkoutParseOutput>();

  constructor(fixtures: SessionFixture[]) {
    for (const fixture of fixtures) {
      this.responsesByRawText.set(fixture.request.rawText, toParseOutput(fixture));
    }
  }

  async parseWorkout(request: WorkoutIngestionRequest): Promise<WorkoutParseGatewayResult> {
    const parse = this.responsesByRawText.get(request.rawText);
    if (!parse) {
      throw new Error(`Missing fixture parse output for rawText: ${request.rawText}`);
    }

    return {
      parse: structuredClone(parse),
      modelLog: createModelLog(),
    };
  }
}

const fixtures: SessionFixture[] = [
  {
    request: {
      rawText: "chest day one",
      submittedAt: "2026-01-05T16:00:00Z",
      ingestionMode: "auto_save",
    },
    sessionId: "session-chest-1",
    workoutTypeId: "workout-type-chest",
    occurredAt: "2026-01-05T16:00:00Z",
    exercises: [
      {
        exerciseKey: "barbell-bench-press",
        exerciseName: "Barbell Bench Press",
        sets: [
          { reps: 10, weightLbs: 100 },
          { reps: 10, weightLbs: 100 },
          { reps: 8, weightLbs: 110 },
        ],
      },
    ],
  },
  {
    request: {
      rawText: "back day one",
      submittedAt: "2026-01-08T16:00:00Z",
      ingestionMode: "auto_save",
    },
    sessionId: "session-back-1",
    workoutTypeId: "workout-type-back",
    occurredAt: "2026-01-08T16:00:00Z",
    exercises: [
      {
        exerciseKey: "barbell-row",
        exerciseName: "Barbell Row",
        sets: [
          { reps: 8, weightLbs: 135 },
          { reps: 8, weightLbs: 145 },
          { reps: 6, weightLbs: 155 },
        ],
      },
    ],
  },
  {
    request: {
      rawText: "legs day one",
      submittedAt: "2026-01-12T16:00:00Z",
      ingestionMode: "auto_save",
    },
    sessionId: "session-legs-1",
    workoutTypeId: "workout-type-legs",
    occurredAt: "2026-01-12T16:00:00Z",
    exercises: [
      {
        exerciseKey: "barbell-squat",
        exerciseName: "Barbell Squat",
        sets: [
          { reps: 8, weightLbs: 185 },
          { reps: 8, weightLbs: 205 },
          { reps: 6, weightLbs: 225 },
        ],
      },
    ],
  },
  {
    request: {
      rawText: "shoulders day one",
      submittedAt: "2026-01-15T16:00:00Z",
      ingestionMode: "auto_save",
    },
    sessionId: "session-shoulders-1",
    workoutTypeId: "workout-type-shoulders-custom",
    occurredAt: "2026-01-15T16:00:00Z",
    exercises: [
      {
        exerciseKey: "dumbbell-overhead-press",
        exerciseName: "Dumbbell Overhead Press",
        sets: [
          { reps: 10, weightLbs: 45 },
          { reps: 8, weightLbs: 50 },
          { reps: 8, weightLbs: 50 },
        ],
      },
    ],
  },
  {
    request: {
      rawText: "chest day two",
      submittedAt: "2026-01-20T16:00:00Z",
      ingestionMode: "auto_save",
    },
    sessionId: "session-chest-2",
    workoutTypeId: "workout-type-chest",
    occurredAt: "2026-01-20T16:00:00Z",
    exercises: [
      {
        exerciseKey: "barbell-bench-press",
        exerciseName: "Barbell Bench Press",
        sets: [
          { reps: 10, weightLbs: 105 },
          { reps: 10, weightLbs: 110 },
          { reps: 8, weightLbs: 115 },
        ],
      },
    ],
  },
];

const seedSessions = async (): Promise<InMemoryWorkoutIngestionRepository> => {
  const repository = new InMemoryWorkoutIngestionRepository();
  const service = new WorkoutIngestionService({
    repository,
    parser: new FixtureParser(fixtures),
  });

  for (const fixture of fixtures) {
    await service.ingest(fixture.request);
  }

  return repository;
};

const main = async (): Promise<void> => {
  const repository = await seedSessions();

  const fullView = await buildDashboardAnalyticsView({ repository });
  assert(!fullView.isEmpty, "dashboard should not be empty after fixture ingestion.");
  assert(fullView.keyStats.totalSessions === 5, "dashboard should include five sessions.");
  assert(fullView.latestSession?.sessionId === "session-chest-2", "latest session mismatch.");
  assert(
    fullView.latestSession?.totalLbsLifted === 3070,
    "latest session total lbs should use deterministic recomputation."
  );
  assert(
    fullView.sessionComparison?.previousSessionTotalLbsDelta === 190,
    "session comparison delta mismatch."
  );
  assert(
    fullView.workoutTypeOptions.some((option) => option.value === "chest"),
    "built-in chest filter option is missing."
  );
  assert(
    fullView.workoutTypeOptions.some(
      (option) => option.value === "workout-type-shoulders-custom"
    ),
    "custom workout-type filter option is missing."
  );

  const chestOnlyView = await buildDashboardAnalyticsView({
    repository,
    filter: { workoutType: "chest" },
  });
  assert(!chestOnlyView.isEmpty, "chest filter should return sessions.");
  assert(chestOnlyView.sessionHistory.length === 2, "chest filter should return two sessions.");
  assert(
    chestOnlyView.keyStats.totalLbsLifted === 5950,
    "chest-only total lbs mismatch."
  );
  assert(
    chestOnlyView.sessionHistory.every((row) => row.workoutTypeLabel === "Chest"),
    "chest filter returned non-chest session."
  );
  assert(
    chestOnlyView.sessionHistory[0]?.previousSessionTotalLbsDelta === 190 &&
      chestOnlyView.sessionHistory[1]?.previousSessionTotalLbsDelta == null,
    "chest history in-range deltas should be computed within filtered window."
  );

  const customOnlyView = await buildDashboardAnalyticsView({
    repository,
    filter: { workoutType: "workout-type-shoulders-custom" },
  });
  assert(customOnlyView.sessionHistory.length === 1, "custom filter should return one session.");
  assert(
    customOnlyView.sessionHistory[0]?.workoutTypeLabel === "Shoulders Custom",
    "custom session label mismatch."
  );

  const dateRangeView = await buildDashboardAnalyticsView({
    repository,
    filter: {
      startDate: "2026-01-08",
      endDate: "2026-01-15",
    },
  });
  assert(dateRangeView.sessionHistory.length === 3, "date range should return three sessions.");
  assert(
    dateRangeView.sessionHistory.some((row) => row.sessionId === "session-back-1") &&
      dateRangeView.sessionHistory.some((row) => row.sessionId === "session-legs-1") &&
      dateRangeView.sessionHistory.some((row) => row.sessionId === "session-shoulders-1"),
    "date range results mismatch."
  );

  const chestSingleDayView = await buildDashboardAnalyticsView({
    repository,
    filter: {
      workoutType: "chest",
      startDate: "2026-01-20",
      endDate: "2026-01-20",
    },
  });
  assert(
    chestSingleDayView.sessionHistory.length === 1 &&
      chestSingleDayView.sessionHistory[0]?.sessionId === "session-chest-2",
    "single-day chest filter should return only session-chest-2."
  );
  assert(
    chestSingleDayView.sessionComparison?.previousSessionTotalLbsDelta == null &&
      chestSingleDayView.sessionComparison.direction === "none",
    "single-day chest comparison delta should be null with no in-range previous session."
  );
  assert(
    chestSingleDayView.sessionHistory[0]?.previousSessionTotalLbsDelta == null,
    "single-day chest history delta should be null with no in-range previous session."
  );
  assert(
    chestSingleDayView.progression.every(
      (row) => row.volumeDeltaLbs === 0 && row.repDelta === 0
    ),
    "single-day chest progression deltas should be zero with no in-range previous session."
  );

  const emptyView = await buildDashboardAnalyticsView({
    repository,
    filter: {
      startDate: "2026-03-01",
      endDate: "2026-03-31",
    },
  });
  assert(emptyView.isEmpty, "future date range should produce an empty state.");
  assert(emptyView.latestSession === null, "empty state should not contain latest session.");
  assert(emptyView.sessionHistory.length === 0, "empty state should have no history rows.");

  console.log("Dashboard MVP analytics verification passed.");
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
