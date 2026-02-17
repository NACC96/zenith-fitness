import type {
  WorkoutIngestionRequest,
  WorkoutParseOutput,
} from "../src/workouts/ingestion-contract.ts";
import type { SetEntry } from "../src/workouts/model.ts";
import {
  InMemoryWorkoutIngestionRepository,
} from "../src/workouts/ingestion-repository.ts";
import {
  calculateExerciseTotals,
} from "../src/workouts/metrics-engine.ts";
import type {
  OpenRouterModelResponseLog,
  WorkoutParseGatewayResult,
  WorkoutParsingGateway,
} from "../src/workouts/openrouter-client.ts";
import {
  WorkoutIngestionService,
} from "../src/workouts/ingestion-service.ts";

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const almostEqual = (left: number, right: number, epsilon = 0.0001): boolean =>
  Math.abs(left - right) <= epsilon;

interface ExerciseFixture {
  exerciseKey: string;
  exerciseName: string;
  exerciseOrder: number;
  sets: Array<{ reps: number; weightLbs: number }>;
}

interface SessionFixture {
  name: string;
  request: WorkoutIngestionRequest;
  parse: WorkoutParseOutput;
}

const buildParseOutputFixture = (input: {
  sessionId: string;
  workoutTypeId: string;
  occurredAt: string;
  exercises: ExerciseFixture[];
}): WorkoutParseOutput => {
  const exercisePerformances = input.exercises.map((exercise, exerciseIndex) => ({
    id: `${input.sessionId}-exercise-${exerciseIndex + 1}`,
    exerciseKey: exercise.exerciseKey,
    exerciseName: exercise.exerciseName,
    exerciseOrder: exercise.exerciseOrder,
    setEntries: exercise.sets.map((set, setIndex) => ({
      id: `${input.sessionId}-set-${exerciseIndex + 1}-${setIndex + 1}`,
      setIndex: setIndex + 1,
      reps: set.reps,
      weightLbs: set.weightLbs,
    })),
    // Intentionally wrong to prove deterministic recomputation.
    totalSets: 999,
    totalReps: 999,
    totalVolumeLbs: 999999,
    previousSessionVolumeDeltaLbs: 999999,
  }));

  return {
    session: {
      session: {
        id: input.sessionId,
        rawLogId: "placeholder-raw-log-id",
        workoutTypeId: input.workoutTypeId,
        occurredAt: input.occurredAt,
        parseVersion: 1,
      },
      exercisePerformances,
      // Intentionally wrong to prove deterministic recomputation.
      metrics: {
        totalLbsLifted: 999999,
        totalSets: 999,
        totalReps: 999,
        previousSessionTotalLbsDelta: 999999,
        perExerciseProgression: [],
      },
    },
    overallConfidence: 0.95,
    fieldConfidence: [],
    errors: [],
    warnings: [],
  };
};

const fixtures: SessionFixture[] = [
  {
    name: "chest-1",
    request: {
      rawText: "chest-fixture-1",
      submittedAt: "2026-01-10T18:00:00Z",
      ingestionMode: "auto_save",
      workoutTypeHintSlug: "chest",
      timezone: "America/New_York",
    },
    parse: buildParseOutputFixture({
      sessionId: "session-chest-1",
      workoutTypeId: "workout-type-chest",
      occurredAt: "2026-01-10T17:30:00Z",
      exercises: [
        {
          exerciseKey: "barbell-bench-press",
          exerciseName: "Barbell Bench Press",
          exerciseOrder: 0,
          sets: [
            { reps: 5, weightLbs: 100 },
            { reps: 5, weightLbs: 100 },
          ],
        },
        {
          exerciseKey: "cable-fly",
          exerciseName: "Cable Fly",
          exerciseOrder: 1,
          sets: [
            { reps: 10, weightLbs: 30 },
            { reps: 8, weightLbs: 30 },
          ],
        },
      ],
    }),
  },
  {
    name: "shoulders-1-custom",
    request: {
      rawText: "shoulders-fixture-1",
      submittedAt: "2026-01-12T18:00:00Z",
      ingestionMode: "auto_save",
      workoutTypeHintSlug: "shoulders",
      timezone: "America/Chicago",
    },
    parse: buildParseOutputFixture({
      sessionId: "session-shoulders-1",
      workoutTypeId: "workout-type-shoulders",
      occurredAt: "2026-01-12T17:30:00Z",
      exercises: [
        {
          exerciseKey: "overhead-press",
          exerciseName: "Overhead Press",
          exerciseOrder: 0,
          sets: [
            { reps: 8, weightLbs: 95 },
            { reps: 7, weightLbs: 95 },
          ],
        },
        {
          exerciseKey: "dumbbell-lateral-raise",
          exerciseName: "Dumbbell Lateral Raise",
          exerciseOrder: 1,
          sets: [
            { reps: 12, weightLbs: 20 },
            { reps: 12, weightLbs: 20 },
          ],
        },
      ],
    }),
  },
  {
    name: "chest-2",
    request: {
      rawText: "chest-fixture-2",
      submittedAt: "2026-01-17T18:00:00Z",
      ingestionMode: "auto_save",
      workoutTypeHintSlug: "chest",
      timezone: "America/New_York",
    },
    parse: buildParseOutputFixture({
      sessionId: "session-chest-2",
      workoutTypeId: "workout-type-chest",
      occurredAt: "2026-01-17T17:30:00Z",
      exercises: [
        {
          exerciseKey: "barbell-bench-press",
          exerciseName: "Barbell Bench Press",
          exerciseOrder: 0,
          sets: [
            { reps: 6, weightLbs: 105 },
            { reps: 5, weightLbs: 105 },
          ],
        },
        {
          exerciseKey: "cable-fly",
          exerciseName: "Cable Fly",
          exerciseOrder: 1,
          sets: [
            { reps: 10, weightLbs: 35 },
            { reps: 9, weightLbs: 35 },
          ],
        },
      ],
    }),
  },
  {
    name: "shoulders-2-custom",
    request: {
      rawText: "shoulders-fixture-2",
      submittedAt: "2026-01-19T18:00:00Z",
      ingestionMode: "auto_save",
      workoutTypeHintSlug: "shoulders",
      timezone: "America/Chicago",
    },
    parse: buildParseOutputFixture({
      sessionId: "session-shoulders-2",
      workoutTypeId: "workout-type-shoulders",
      occurredAt: "2026-01-19T17:30:00Z",
      exercises: [
        {
          exerciseKey: "overhead-press",
          exerciseName: "Overhead Press",
          exerciseOrder: 0,
          sets: [
            { reps: 9, weightLbs: 100 },
            { reps: 8, weightLbs: 100 },
          ],
        },
        {
          exerciseKey: "dumbbell-lateral-raise",
          exerciseName: "Dumbbell Lateral Raise",
          exerciseOrder: 1,
          sets: [
            { reps: 13, weightLbs: 22.5 },
            { reps: 12, weightLbs: 22.5 },
          ],
        },
      ],
    }),
  },
];

class FixtureParser implements WorkoutParsingGateway {
  private readonly parseByRawText = new Map<string, WorkoutParseOutput>();

  constructor(entries: SessionFixture[]) {
    for (const entry of entries) {
      this.parseByRawText.set(entry.request.rawText, entry.parse);
    }
  }

  async parseWorkout(
    request: WorkoutIngestionRequest
  ): Promise<WorkoutParseGatewayResult> {
    const parse = this.parseByRawText.get(request.rawText);
    const now = new Date().toISOString();
    const modelLog: OpenRouterModelResponseLog = {
      loggedAt: now,
      requestStartedAt: now,
      requestCompletedAt: now,
      durationMs: 5,
      attempt: 1,
      model: "fixture",
      requestPayload: { rawText: request.rawText },
      responseStatus: 200,
      responsePayload: { fixture: true },
    };

    if (!parse) {
      throw new Error(`No parser fixture found for raw text: ${request.rawText}`);
    }

    return {
      parse: structuredClone(parse),
      modelLog,
    };
  }
}

const progressionByExercise = (
  progression: Array<{ exerciseKey: string; volumeDeltaLbs: number; repDelta: number }>
): Map<string, { volumeDeltaLbs: number; repDelta: number }> => {
  return new Map(
    progression.map((entry) => [
      entry.exerciseKey,
      { volumeDeltaLbs: entry.volumeDeltaLbs, repDelta: entry.repDelta },
    ])
  );
};

const main = async (): Promise<void> => {
  const repository = new InMemoryWorkoutIngestionRepository();
  const parser = new FixtureParser(fixtures);
  let generatedId = 0;

  const service = new WorkoutIngestionService({
    parser,
    repository,
    idGenerator: () => `id-${++generatedId}`,
    now: () => new Date("2026-02-16T00:00:00Z"),
  });

  const responseByFixtureName = new Map<string, Awaited<ReturnType<typeof service.ingest>>>();
  for (const fixture of fixtures) {
    const response = await service.ingest(fixture.request);
    responseByFixtureName.set(fixture.name, response);
  }

  const chestOne = responseByFixtureName.get("chest-1");
  const chestTwo = responseByFixtureName.get("chest-2");
  const shouldersOne = responseByFixtureName.get("shoulders-1-custom");
  const shouldersTwo = responseByFixtureName.get("shoulders-2-custom");

  assert(chestOne && chestTwo && shouldersOne && shouldersTwo, "Missing ingested fixtures.");

  assert(chestOne.parse.session, "chest-1 should produce a parsed session.");
  assert(chestOne.parse.session.metrics.totalLbsLifted === 1540, "chest-1 total lbs mismatch.");
  assert(chestOne.parse.session.metrics.totalSets === 4, "chest-1 total sets mismatch.");
  assert(chestOne.parse.session.metrics.totalReps === 28, "chest-1 total reps mismatch.");
  assert(
    chestOne.parse.session.metrics.previousSessionTotalLbsDelta == null,
    "chest-1 should have null previous-session total delta."
  );

  const chestOneBench = chestOne.parse.session.exercisePerformances.find(
    (exercise) => exercise.exerciseKey === "barbell-bench-press"
  );
  assert(chestOneBench, "chest-1 bench exercise missing.");
  assert(chestOneBench.totalVolumeLbs === 1000, "chest-1 bench total volume mismatch.");
  assert(
    chestOneBench.previousSessionVolumeDeltaLbs == null,
    "chest-1 bench previous-session volume delta should be null."
  );

  assert(chestTwo.parse.session, "chest-2 should produce a parsed session.");
  assert(chestTwo.parse.session.metrics.totalLbsLifted === 1820, "chest-2 total lbs mismatch.");
  assert(chestTwo.parse.session.metrics.totalSets === 4, "chest-2 total sets mismatch.");
  assert(chestTwo.parse.session.metrics.totalReps === 30, "chest-2 total reps mismatch.");
  assert(
    chestTwo.parse.session.metrics.previousSessionTotalLbsDelta === 280,
    "chest-2 previous-session total delta mismatch."
  );

  const chestTwoProgression = progressionByExercise(
    chestTwo.parse.session.metrics.perExerciseProgression
  );
  assert(
    chestTwoProgression.get("barbell-bench-press")?.volumeDeltaLbs === 155,
    "chest-2 bench volume delta mismatch."
  );
  assert(
    chestTwoProgression.get("barbell-bench-press")?.repDelta === 1,
    "chest-2 bench rep delta mismatch."
  );
  assert(
    chestTwoProgression.get("cable-fly")?.volumeDeltaLbs === 125,
    "chest-2 cable-fly volume delta mismatch."
  );
  assert(
    chestTwoProgression.get("cable-fly")?.repDelta === 1,
    "chest-2 cable-fly rep delta mismatch."
  );

  assert(shouldersTwo.parse.session, "shoulders-2 should produce a parsed session.");
  assert(
    almostEqual(shouldersTwo.parse.session.metrics.totalLbsLifted, 2262.5),
    "shoulders-2 total lbs mismatch."
  );
  assert(
    almostEqual(shouldersTwo.parse.session.metrics.previousSessionTotalLbsDelta ?? 0, 357.5),
    "shoulders-2 previous-session total delta mismatch."
  );
  const shouldersTwoProgression = progressionByExercise(
    shouldersTwo.parse.session.metrics.perExerciseProgression
  );
  assert(
    shouldersTwoProgression.get("overhead-press")?.volumeDeltaLbs === 275,
    "shoulders-2 OHP volume delta mismatch."
  );
  assert(
    shouldersTwoProgression.get("overhead-press")?.repDelta === 2,
    "shoulders-2 OHP rep delta mismatch."
  );
  assert(
    almostEqual(
      shouldersTwoProgression.get("dumbbell-lateral-raise")?.volumeDeltaLbs ?? 0,
      82.5
    ),
    "shoulders-2 lateral raise volume delta mismatch."
  );
  assert(
    shouldersTwoProgression.get("dumbbell-lateral-raise")?.repDelta === 1,
    "shoulders-2 lateral raise rep delta mismatch."
  );

  const chestOnlySessions = await repository.listParsedSessions({
    workoutTypeId: "workout-type-chest",
  });
  assert(chestOnlySessions.length === 2, "workout-type filter should return two chest sessions.");
  assert(
    chestOnlySessions[0]?.session.id === "session-chest-1" &&
      chestOnlySessions[1]?.session.id === "session-chest-2",
    "workout-type filter ordering mismatch."
  );

  const dateWindowSessions = await repository.listParsedSessions({
    startOccurredAt: "2026-01-11T00:00:00Z",
    endOccurredAt: "2026-01-18T23:59:59Z",
  });
  assert(dateWindowSessions.length === 2, "date-range filter should return two sessions.");
  assert(
    dateWindowSessions.some((session) => session.session.id === "session-shoulders-1") &&
      dateWindowSessions.some((session) => session.session.id === "session-chest-2"),
    "date-range filter returned unexpected sessions."
  );

  const previousCustomSession = await repository.findMostRecentSessionBefore({
    workoutTypeId: "workout-type-shoulders",
    occurredAt: "2026-01-19T17:30:00Z",
  });
  assert(
    previousCustomSession?.session.id === "session-shoulders-1",
    "custom workout previous-session lookup mismatch."
  );

  const malformedTotals = calculateExerciseTotals([
    {
      id: "set-1",
      setIndex: 1,
      reps: 8,
      weightLbs: -100,
    } as unknown as SetEntry,
    {
      id: "set-2",
      setIndex: 2,
      reps: undefined,
      weightLbs: 200,
    } as unknown as SetEntry,
    {
      id: "set-3",
      setIndex: 3,
      reps: 6,
      weightLbs: undefined,
    } as unknown as SetEntry,
  ]);
  assert(malformedTotals.totalSets === 3, "malformed totals set count mismatch.");
  assert(malformedTotals.totalReps === 14, "malformed totals rep count mismatch.");
  assert(
    malformedTotals.totalVolumeLbs === 0,
    "malformed totals volume should clamp to non-negative zero."
  );

  console.log("Metrics and progression verification passed.");
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
