import type {
  WorkoutIngestionRequest,
  WorkoutParseOutput,
} from "../src/workouts/ingestion-contract.ts";
import { buildDashboardAnalyticsView } from "../src/workouts/dashboard-analytics.ts";
import { WorkoutCorrectionService } from "../src/workouts/correction-service.ts";
import { createWorkoutCorrectionPostHandler } from "../src/workouts/ingestion-endpoint.ts";
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
  confidence: number;
  warnings?: WorkoutParseOutput["warnings"];
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
        // Intentionally wrong so ingestion recomputation is exercised deterministically.
        totalSets: 1,
        totalReps: 1,
        totalVolumeLbs: 1,
      })),
      metrics: {
        // Intentionally wrong so ingestion recomputation is exercised deterministically.
        totalLbsLifted: 1,
        totalSets: 1,
        totalReps: 1,
        previousSessionTotalLbsDelta: 1,
        perExerciseProgression: fixture.exercises.map((exercise) => ({
          exerciseKey: exercise.exerciseKey,
          volumeDeltaLbs: 0,
          repDelta: 0,
        })),
      },
    },
    overallConfidence: fixture.confidence,
    fieldConfidence: [],
    errors: [],
    warnings: fixture.warnings ?? [],
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
    confidence: 0.98,
    exercises: [
      {
        exerciseKey: "barbell-bench-press",
        exerciseName: "Barbell Bench Press",
        sets: [
          { reps: 8, weightLbs: 100 },
          { reps: 8, weightLbs: 100 },
        ],
      },
    ],
  },
  {
    request: {
      rawText: "chest day two",
      submittedAt: "2026-01-12T16:00:00Z",
      ingestionMode: "auto_save",
    },
    sessionId: "session-chest-2",
    workoutTypeId: "workout-type-chest",
    occurredAt: "2026-01-12T16:00:00Z",
    confidence: 0.97,
    exercises: [
      {
        exerciseKey: "barbell-bench-press",
        exerciseName: "Barbell Bench Press",
        sets: [
          { reps: 8, weightLbs: 110 },
          { reps: 8, weightLbs: 110 },
        ],
      },
    ],
  },
  {
    request: {
      rawText: "shoulders uncertain",
      submittedAt: "2026-01-15T16:00:00Z",
      ingestionMode: "auto_save",
    },
    sessionId: "session-shoulders-1",
    workoutTypeId: "workout-type-shoulders-custom",
    occurredAt: "2026-01-15T16:00:00Z",
    confidence: 0.62,
    warnings: [
      {
        code: "AMBIGUOUS_VALUE",
        message: "Could not confidently determine one set value.",
        fieldPath: "exercisePerformances[0].setEntries[1].weightLbs",
      },
    ],
    exercises: [
      {
        exerciseKey: "overhead-press",
        exerciseName: "Overhead Press",
        sets: [
          { reps: 8, weightLbs: 95 },
          { reps: 7, weightLbs: 95 },
        ],
      },
    ],
  },
];

const main = async (): Promise<void> => {
  const repository = new InMemoryWorkoutIngestionRepository();
  const ingestionService = new WorkoutIngestionService({
    repository,
    parser: new FixtureParser(fixtures),
  });

  for (const fixture of fixtures) {
    await ingestionService.ingest(fixture.request);
  }

  const preCorrectionChestView = await buildDashboardAnalyticsView({
    repository,
    filter: { workoutType: "chest" },
  });
  assert(
    preCorrectionChestView.sessionInsights.every((insight) => insight.mode === "actionable"),
    "High-confidence chest sessions should produce actionable insights."
  );

  const lowConfidenceView = await buildDashboardAnalyticsView({
    repository,
    filter: { workoutType: "workout-type-shoulders-custom" },
  });
  assert(
    lowConfidenceView.sessionInsights[0]?.mode === "review",
    "Low-confidence sessions should suppress overconfident coaching."
  );
  assert(
    lowConfidenceView.sessionInsights[0]?.recommendations.length === 0,
    "Low-confidence sessions should suppress recommendations."
  );

  const chestOneBefore = await repository.findBySessionId("session-chest-1");
  const chestTwoBefore = await repository.findBySessionId("session-chest-2");
  assert(chestOneBefore && chestTwoBefore, "Chest fixtures must be persisted.");

  const correctionService = new WorkoutCorrectionService({ repository });
  const correctionHandler = createWorkoutCorrectionPostHandler(correctionService);
  const correctionBody = new URLSearchParams({
    redirectTo: "/dashboard",
    sessionRef: `session-chest-1::${chestOneBefore.rawLogId}`,
    reason: "Fix top set load",
    exerciseIndex: "1",
    setIndex: "1",
    reps: "8",
    weightLbs: "120",
  });

  const correctionResponse = await correctionHandler(
    new Request("http://localhost/api/workouts/corrections", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: correctionBody.toString(),
    })
  );
  assert(correctionResponse.status === 303, "Form-based correction should redirect.");
  const redirectLocation = correctionResponse.headers.get("location") ?? "";
  assert(
    redirectLocation.includes("correction=applied"),
    "Correction redirect should report applied status."
  );

  const chestOneAfter = await repository.findBySessionId("session-chest-1");
  const chestTwoAfter = await repository.findBySessionId("session-chest-2");
  assert(chestOneAfter?.parse.session, "Corrected chest session should exist.");
  assert(chestTwoAfter?.parse.session, "Downstream chest session should exist.");

  assert(chestOneAfter.parseVersion === 2, "Corrected session parseVersion should increment.");
  assert(
    chestOneAfter.parse.session.metrics.computationVersion === 2,
    "Corrected session computationVersion should increment."
  );

  const expectedChestTwoDelta =
    chestTwoAfter.parse.session.metrics.totalLbsLifted -
    chestOneAfter.parse.session.metrics.totalLbsLifted;
  assert(
    chestTwoAfter.parse.session.metrics.previousSessionTotalLbsDelta === expectedChestTwoDelta,
    "Downstream previous-session delta should recompute after correction."
  );
  assert(
    chestTwoAfter.parse.session.metrics.computationVersion === 2,
    "Downstream session computationVersion should increment after recompute."
  );

  const correctionRecords = await repository.listCorrectionRecordsBySessionId("session-chest-1");
  assert(correctionRecords.length === 1, "Correction audit record should be persisted.");
  assert(correctionRecords[0]?.status === "applied", "Correction audit status mismatch.");

  const postCorrectionChestView = await buildDashboardAnalyticsView({
    repository,
    filter: { workoutType: "chest" },
  });
  assert(
    postCorrectionChestView.sessionComparison?.previousSessionTotalLbsDelta ===
      expectedChestTwoDelta,
    "Dashboard comparison delta should reflect recomputed persisted metrics."
  );
  assert(
    postCorrectionChestView.sessionHistory[1]?.parseVersion === 2,
    "Dashboard history should expose incremented parse version."
  );
  assert(
    postCorrectionChestView.sessionHistory[1]?.computationVersion === 2,
    "Dashboard history should expose incremented computation version."
  );

  console.log("AI insights and correction-loop verification passed.");
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
