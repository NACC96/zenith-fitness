import { WorkoutIngestionService } from "../src/workouts/ingestion-service.ts";
import { InMemoryWorkoutIngestionRepository } from "../src/workouts/ingestion-repository.ts";
import type { WorkoutIngestionRequest } from "../src/workouts/ingestion-contract.ts";
import type {
  WorkoutParseGatewayResult,
  WorkoutParsingGateway,
} from "../src/workouts/openrouter-client.ts";

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

class SlowParser implements WorkoutParsingGateway {
  async parseWorkout(
    _request: WorkoutIngestionRequest
  ): Promise<WorkoutParseGatewayResult> {
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      parse: {
        session: {
          session: {
            id: "session-1",
            rawLogId: "raw-placeholder",
            workoutTypeId: "type-1",
            occurredAt: "2026-02-16T00:00:00Z",
            parseVersion: 1,
          },
          exercisePerformances: [
            {
              id: "ex-1",
              exerciseKey: "bench",
              exerciseName: "Bench",
              exerciseOrder: 0,
              setEntries: [
                {
                  id: "set-1",
                  setIndex: 1,
                  reps: 5,
                  weightLbs: 100,
                },
              ],
              totalSets: 1,
              totalReps: 5,
              totalVolumeLbs: 500,
            },
          ],
          metrics: {
            totalLbsLifted: 500,
            totalSets: 1,
            totalReps: 5,
            perExerciseProgression: [
              {
                exerciseKey: "bench",
                volumeDeltaLbs: 0,
                repDelta: 0,
              },
            ],
          },
        },
        overallConfidence: 1,
        fieldConfidence: [],
        errors: [],
        warnings: [],
      },
      modelLog: {
        loggedAt: new Date().toISOString(),
        requestStartedAt: new Date().toISOString(),
        requestCompletedAt: new Date().toISOString(),
        durationMs: 1,
        attempt: 1,
        model: "fixture",
        requestPayload: {},
      },
    };
  }
}

const repository = new InMemoryWorkoutIngestionRepository();
let generatedId = 0;

const service = new WorkoutIngestionService({
  parser: new SlowParser(),
  repository,
  idGenerator: () => `id-${++generatedId}`,
  now: () => new Date("2026-02-16T00:00:00Z"),
});

const request: WorkoutIngestionRequest = {
  rawText: "Bench 100x5",
  submittedAt: "2026-02-16T00:00:00Z",
  ingestionMode: "auto_save",
};

const [firstResponse, secondResponse] = await Promise.all([
  service.ingest(request),
  service.ingest(request),
]);

const records = repository.snapshot();

assert(
  firstResponse.rawLogId === secondResponse.rawLogId,
  `Expected stable rawLogId for concurrent duplicate requests; got ${firstResponse.rawLogId} and ${secondResponse.rawLogId}.`
);

assert(
  records.length === 1,
  `Expected a single persisted record for concurrent duplicate requests; got ${records.length}.`
);

assert(
  records[0]?.response.rawLogId === firstResponse.rawLogId,
  "Persisted rawLogId did not match response rawLogId."
);

console.log("Concurrent idempotency verification passed.");
