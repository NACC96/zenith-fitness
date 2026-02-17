import type {
  WorkoutIngestionRequest,
  WorkoutParseOutput,
} from "../src/workouts/ingestion-contract.ts";
import {
  InMemoryWorkoutIngestionRepository,
} from "../src/workouts/ingestion-repository.ts";
import type {
  OpenRouterModelResponseLog,
  WorkoutParseGatewayResult,
  WorkoutParsingGateway,
} from "../src/workouts/openrouter-client.ts";
import {
  buildParseFailureOutput,
} from "../src/workouts/openrouter-schema.ts";
import {
  WorkoutIngestionService,
} from "../src/workouts/ingestion-service.ts";
import {
  createWorkoutIngestionPostHandler,
} from "../src/workouts/ingestion-endpoint.ts";

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const sum = (values: number[]): number => values.reduce((acc, value) => acc + value, 0);

interface ExerciseFixture {
  exerciseKey: string;
  exerciseName: string;
  exerciseOrder: number;
  sets: Array<{ reps: number; weightLbs: number }>;
  volumeDeltaLbs: number;
  repDelta: number;
}

const buildParsedOutput = (input: {
  sessionId: string;
  workoutTypeId: string;
  occurredAt: string;
  timezone?: string;
  overallConfidence: number;
  exercises: ExerciseFixture[];
  warnings?: WorkoutParseOutput["warnings"];
}): WorkoutParseOutput => {
  const exercisePerformances = input.exercises.map((exercise, exerciseIndex) => {
    const setEntries = exercise.sets.map((set, setIndex) => ({
      id: `${input.sessionId}-set-${exerciseIndex + 1}-${setIndex + 1}`,
      setIndex: setIndex + 1,
      reps: set.reps,
      weightLbs: set.weightLbs,
    }));

    const totalSets = setEntries.length;
    const totalReps = sum(setEntries.map((setEntry) => setEntry.reps));
    const totalVolumeLbs = sum(
      setEntries.map((setEntry) => setEntry.reps * setEntry.weightLbs)
    );

    return {
      id: `${input.sessionId}-exercise-${exerciseIndex + 1}`,
      exerciseKey: exercise.exerciseKey,
      exerciseName: exercise.exerciseName,
      exerciseOrder: exercise.exerciseOrder,
      setEntries,
      totalSets,
      totalReps,
      totalVolumeLbs,
      previousSessionVolumeDeltaLbs: exercise.volumeDeltaLbs,
    };
  });

  const metricsTotalSets = sum(
    exercisePerformances.map((exercise) => exercise.totalSets)
  );
  const metricsTotalReps = sum(
    exercisePerformances.map((exercise) => exercise.totalReps)
  );
  const metricsTotalLbs = sum(
    exercisePerformances.map((exercise) => exercise.totalVolumeLbs)
  );

  return {
    session: {
      session: {
        id: input.sessionId,
        rawLogId: "placeholder-raw-log-id",
        workoutTypeId: input.workoutTypeId,
        occurredAt: input.occurredAt,
        timezone: input.timezone ?? "UTC",
        parseVersion: 999,
      },
      exercisePerformances,
      metrics: {
        totalLbsLifted: metricsTotalLbs,
        totalSets: metricsTotalSets,
        totalReps: metricsTotalReps,
        previousSessionTotalLbsDelta: sum(
          input.exercises.map((exercise) => exercise.volumeDeltaLbs)
        ),
        perExerciseProgression: input.exercises.map((exercise) => ({
          exerciseKey: exercise.exerciseKey,
          volumeDeltaLbs: exercise.volumeDeltaLbs,
          repDelta: exercise.repDelta,
        })),
      },
    },
    overallConfidence: input.overallConfidence,
    fieldConfidence: [
      {
        fieldPath: "session.occurredAt",
        confidence: Math.max(0, input.overallConfidence - 0.02),
      },
      {
        fieldPath: "exercisePerformances[0].setEntries",
        confidence: Math.max(0, input.overallConfidence - 0.01),
      },
    ],
    errors: [],
    warnings: input.warnings ?? [],
  };
};

interface Fixture {
  name: string;
  request: WorkoutIngestionRequest;
  parse: WorkoutParseOutput;
}

const fixtures: Fixture[] = [
  {
    name: "Chest - compact notation",
    request: {
      rawText:
        "Chest day: Bench 185x8, 185x7, 185x6. Incline DB 70x10, 70x9, 70x8.",
      submittedAt: "2026-02-16T09:00:00Z",
      ingestionMode: "auto_save",
      workoutTypeHintSlug: "chest",
      timezone: "America/New_York",
    },
    parse: buildParsedOutput({
      sessionId: "session-fixture-001",
      workoutTypeId: "00000000-0000-0000-0000-000000000001",
      occurredAt: "2026-02-16T08:40:00Z",
      timezone: "America/New_York",
      overallConfidence: 0.97,
      exercises: [
        {
          exerciseKey: "barbell-bench-press",
          exerciseName: "Barbell Bench Press",
          exerciseOrder: 0,
          sets: [
            { reps: 8, weightLbs: 185 },
            { reps: 7, weightLbs: 185 },
            { reps: 6, weightLbs: 185 },
          ],
          volumeDeltaLbs: 120,
          repDelta: 1,
        },
        {
          exerciseKey: "incline-dumbbell-press",
          exerciseName: "Incline Dumbbell Press",
          exerciseOrder: 1,
          sets: [
            { reps: 10, weightLbs: 70 },
            { reps: 9, weightLbs: 70 },
            { reps: 8, weightLbs: 70 },
          ],
          volumeDeltaLbs: 90,
          repDelta: 2,
        },
      ],
    }),
  },
  {
    name: "Back - sentence format",
    request: {
      rawText:
        "Back workout complete. Deadlift 275 for 5,5,4. Lat pulldown 140 for 10,10,9.",
      submittedAt: "2026-02-16T10:15:00Z",
      ingestionMode: "auto_save",
      workoutTypeHintSlug: "back",
      timezone: "America/New_York",
    },
    parse: buildParsedOutput({
      sessionId: "session-fixture-002",
      workoutTypeId: "00000000-0000-0000-0000-000000000002",
      occurredAt: "2026-02-16T09:40:00Z",
      timezone: "America/New_York",
      overallConfidence: 0.95,
      exercises: [
        {
          exerciseKey: "barbell-deadlift",
          exerciseName: "Barbell Deadlift",
          exerciseOrder: 0,
          sets: [
            { reps: 5, weightLbs: 275 },
            { reps: 5, weightLbs: 275 },
            { reps: 4, weightLbs: 275 },
          ],
          volumeDeltaLbs: 180,
          repDelta: 1,
        },
        {
          exerciseKey: "lat-pulldown",
          exerciseName: "Lat Pulldown",
          exerciseOrder: 1,
          sets: [
            { reps: 10, weightLbs: 140 },
            { reps: 10, weightLbs: 140 },
            { reps: 9, weightLbs: 140 },
          ],
          volumeDeltaLbs: 70,
          repDelta: 0,
        },
      ],
    }),
  },
  {
    name: "Legs - multiline style",
    request: {
      rawText: [
        "Leg Day",
        "Squat: 225x8 225x8 225x7",
        "Leg Press: 360x12 360x12 360x10",
      ].join("\n"),
      submittedAt: "2026-02-16T11:45:00Z",
      ingestionMode: "auto_save",
      workoutTypeHintSlug: "legs",
      timezone: "America/New_York",
    },
    parse: buildParsedOutput({
      sessionId: "session-fixture-003",
      workoutTypeId: "00000000-0000-0000-0000-000000000003",
      occurredAt: "2026-02-16T11:00:00Z",
      timezone: "America/New_York",
      overallConfidence: 0.96,
      exercises: [
        {
          exerciseKey: "barbell-squat",
          exerciseName: "Barbell Squat",
          exerciseOrder: 0,
          sets: [
            { reps: 8, weightLbs: 225 },
            { reps: 8, weightLbs: 225 },
            { reps: 7, weightLbs: 225 },
          ],
          volumeDeltaLbs: 140,
          repDelta: 1,
        },
        {
          exerciseKey: "leg-press",
          exerciseName: "Leg Press",
          exerciseOrder: 1,
          sets: [
            { reps: 12, weightLbs: 360 },
            { reps: 12, weightLbs: 360 },
            { reps: 10, weightLbs: 360 },
          ],
          volumeDeltaLbs: 210,
          repDelta: 2,
        },
      ],
    }),
  },
  {
    name: "Shoulders - custom category",
    request: {
      rawText:
        "Shoulders: OHP 115x8, 115x7, 115x6. Lateral Raise 25x14, 25x12, 25x12.",
      submittedAt: "2026-02-16T12:30:00Z",
      ingestionMode: "auto_save",
      workoutTypeHintSlug: "shoulders",
      timezone: "America/Chicago",
    },
    parse: buildParsedOutput({
      sessionId: "session-fixture-004",
      workoutTypeId: "00000000-0000-0000-0000-0000000000AA",
      occurredAt: "2026-02-16T12:00:00Z",
      timezone: "America/Chicago",
      overallConfidence: 0.9,
      exercises: [
        {
          exerciseKey: "overhead-press",
          exerciseName: "Overhead Press",
          exerciseOrder: 0,
          sets: [
            { reps: 8, weightLbs: 115 },
            { reps: 7, weightLbs: 115 },
            { reps: 6, weightLbs: 115 },
          ],
          volumeDeltaLbs: 85,
          repDelta: 1,
        },
        {
          exerciseKey: "dumbbell-lateral-raise",
          exerciseName: "Dumbbell Lateral Raise",
          exerciseOrder: 1,
          sets: [
            { reps: 14, weightLbs: 25 },
            { reps: 12, weightLbs: 25 },
            { reps: 12, weightLbs: 25 },
          ],
          volumeDeltaLbs: 40,
          repDelta: 0,
        },
      ],
      warnings: [
        {
          code: "AMBIGUOUS_VALUE",
          message: "Workout date inferred from submittedAt.",
          fieldPath: "session.occurredAt",
        },
      ],
    }),
  },
  {
    name: "Full-body - inferred workout type",
    request: {
      rawText:
        "Today: Clean 165x3x5 sets, Front Squat 185x5x4 sets, Pull-ups bodyweight x 8,8,7.",
      submittedAt: "2026-02-16T14:05:00Z",
      ingestionMode: "auto_save",
      timezone: "America/Los_Angeles",
    },
    parse: buildParsedOutput({
      sessionId: "session-fixture-005",
      workoutTypeId: "00000000-0000-0000-0000-0000000000BB",
      occurredAt: "2026-02-16T13:40:00Z",
      timezone: "America/Los_Angeles",
      overallConfidence: 0.84,
      exercises: [
        {
          exerciseKey: "power-clean",
          exerciseName: "Power Clean",
          exerciseOrder: 0,
          sets: [
            { reps: 3, weightLbs: 165 },
            { reps: 3, weightLbs: 165 },
            { reps: 3, weightLbs: 165 },
            { reps: 3, weightLbs: 165 },
            { reps: 3, weightLbs: 165 },
          ],
          volumeDeltaLbs: 55,
          repDelta: 0,
        },
        {
          exerciseKey: "front-squat",
          exerciseName: "Front Squat",
          exerciseOrder: 1,
          sets: [
            { reps: 5, weightLbs: 185 },
            { reps: 5, weightLbs: 185 },
            { reps: 5, weightLbs: 185 },
            { reps: 5, weightLbs: 185 },
          ],
          volumeDeltaLbs: 75,
          repDelta: 1,
        },
        {
          exerciseKey: "pull-up",
          exerciseName: "Pull-up",
          exerciseOrder: 2,
          sets: [
            { reps: 8, weightLbs: 0 },
            { reps: 8, weightLbs: 0 },
            { reps: 7, weightLbs: 0 },
          ],
          volumeDeltaLbs: 0,
          repDelta: -1,
        },
      ],
      warnings: [
        {
          code: "AMBIGUOUS_VALUE",
          message: "workoutType inferred as custom full-body.",
          fieldPath: "session.workoutTypeId",
        },
      ],
    }),
  },
];

class FixtureParser implements WorkoutParsingGateway {
  private readonly responseMap = new Map<string, WorkoutParseOutput>();

  constructor(data: Fixture[]) {
    for (const item of data) {
      this.responseMap.set(item.request.rawText, item.parse);
    }
  }

  async parseWorkout(
    request: WorkoutIngestionRequest
  ): Promise<WorkoutParseGatewayResult> {
    const now = new Date().toISOString();

    const modelLog: OpenRouterModelResponseLog = {
      loggedAt: now,
      requestStartedAt: now,
      requestCompletedAt: now,
      durationMs: 12,
      attempt: 1,
      model: "openai/gpt-4o-mini",
      requestPayload: {
        rawText: request.rawText,
      },
      responseStatus: 200,
      responsePayload: {
        fixture: true,
      },
    };

    const parse = this.responseMap.get(request.rawText);
    if (!parse) {
      return {
        parse: {
          ...buildParseFailureOutput(
            "Unable to parse workout log safely.",
            "AMBIGUOUS_VALUE"
          ),
          warnings: [
            {
              code: "AMBIGUOUS_VALUE",
              message: "Input did not include enough structure to infer sets/reps/weight.",
            },
          ],
        },
        modelLog,
      };
    }

    return {
      parse,
      modelLog,
    };
  }
}

const parseJsonResponse = async (response: Response): Promise<unknown> => {
  const body = await response.text();

  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`Expected JSON response body but got: ${body}`);
  }
};

const main = async (): Promise<void> => {
  const repository = new InMemoryWorkoutIngestionRepository();
  const parser = new FixtureParser(fixtures);
  const service = new WorkoutIngestionService({
    parser,
    repository,
  });
  const handler = createWorkoutIngestionPostHandler(service);

  for (const fixture of fixtures) {
    const response = await handler(
      new Request("http://localhost/api/workouts/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fixture.request),
      })
    );

    assert(response.status === 200, `${fixture.name}: expected 200 response.`);

    const payload = (await parseJsonResponse(response)) as Record<string, unknown>;
    assert(
      payload.status === "parsed" || payload.status === "parsed_with_warnings",
      `${fixture.name}: expected parsed status, got ${String(payload.status)}.`
    );
    assert(
      typeof payload.rawLogId === "string" && payload.rawLogId.length > 0,
      `${fixture.name}: rawLogId missing.`
    );

    const parse = payload.parse as Record<string, unknown>;
    assert(parse && typeof parse === "object", `${fixture.name}: parse payload missing.`);
    assert(
      typeof parse.overallConfidence === "number",
      `${fixture.name}: overallConfidence missing.`
    );

    const session = parse.session as Record<string, unknown> | undefined;
    assert(session, `${fixture.name}: parse.session should exist.`);

    const correction = payload.correction as Record<string, unknown>;
    assert(
      correction.canRequestCorrection === true,
      `${fixture.name}: correction capability should be enabled for parsed sessions.`
    );
  }

  // Idempotency check: same request payload should not create a new record.
  const firstRequest = fixtures[0].request;
  const firstRun = await handler(
    new Request("http://localhost/api/workouts/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(firstRequest),
    })
  );
  const firstRunPayload = (await parseJsonResponse(firstRun)) as Record<string, unknown>;

  const secondRun = await handler(
    new Request("http://localhost/api/workouts/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(firstRequest),
    })
  );
  const secondRunPayload = (await parseJsonResponse(secondRun)) as Record<string, unknown>;

  assert(
    firstRunPayload.rawLogId === secondRunPayload.rawLogId,
    "Idempotency failed: repeated request generated a new rawLogId."
  );

  // Malformed input should degrade gracefully to explicit parse failure payload.
  const malformedRequest: WorkoutIngestionRequest = {
    rawText: "did stuff with some weights maybe maybe ???",
    submittedAt: "2026-02-16T15:00:00Z",
    ingestionMode: "auto_save",
    timezone: "America/New_York",
  };

  const malformedResponse = await handler(
    new Request("http://localhost/api/workouts/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(malformedRequest),
    })
  );
  assert(malformedResponse.status === 200, "Malformed input should still return 200.");

  const malformedPayload = (await parseJsonResponse(malformedResponse)) as Record<
    string,
    unknown
  >;
  assert(
    malformedPayload.status === "failed",
    "Malformed input should return failed parse status."
  );

  const malformedParse = malformedPayload.parse as Record<string, unknown>;
  assert(
    Array.isArray(malformedParse.errors) && malformedParse.errors.length > 0,
    "Malformed input should include explicit parse errors."
  );

  const malformedCorrection = malformedPayload.correction as Record<string, unknown>;
  assert(
    malformedCorrection.canRequestCorrection === false,
    "Failed parse should disable correction requests until a session exists."
  );

  const persistedRecords = repository.snapshot();
  assert(
    persistedRecords.length === fixtures.length + 1,
    "Unexpected persisted record count after idempotent replay + malformed case."
  );

  for (const record of persistedRecords) {
    assert(
      !Number.isNaN(Date.parse(record.persistedAt)),
      "Persisted record missing valid timestamp."
    );
    assert(
      typeof record.response.rawLogId === "string" && record.response.rawLogId.length > 0,
      "Persisted record missing rawLogId."
    );
    assert(
      !Number.isNaN(Date.parse(record.modelLog.loggedAt)),
      "Model log missing loggedAt timestamp."
    );
    assert(
      !Number.isNaN(Date.parse(record.modelLog.requestStartedAt)) &&
        !Number.isNaN(Date.parse(record.modelLog.requestCompletedAt)),
      "Model log missing request timing timestamps."
    );
  }

  console.log("OpenRouter parsing pipeline verification passed.");
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
