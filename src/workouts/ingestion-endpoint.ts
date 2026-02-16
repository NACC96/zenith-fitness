import type { WorkoutIngestionRequest } from "./ingestion-contract";
import { InMemoryWorkoutIngestionRepository } from "./ingestion-repository";
import { OpenRouterWorkoutParser } from "./openrouter-client";
import {
  IngestionValidationError,
  WorkoutIngestionService,
  type WorkoutIngestionServiceDependencies,
} from "./ingestion-service";

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const optionalString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toWorkoutIngestionRequest = (
  payload: unknown
): WorkoutIngestionRequest => {
  if (!isRecord(payload)) {
    throw new IngestionValidationError("Workout ingestion request must be an object.", [
      {
        field: "body",
        message: "Request body must be a JSON object.",
      },
    ]);
  }

  return {
    rawText: typeof payload.rawText === "string" ? payload.rawText : "",
    submittedAt: typeof payload.submittedAt === "string" ? payload.submittedAt : "",
    ingestionMode: (typeof payload.ingestionMode === "string"
      ? payload.ingestionMode
      : "") as WorkoutIngestionRequest["ingestionMode"],
    workoutTypeHintSlug: optionalString(payload.workoutTypeHintSlug),
    occurredAtHint: optionalString(payload.occurredAtHint),
    timezone: optionalString(payload.timezone),
  };
};

const defaultRepository = new InMemoryWorkoutIngestionRepository();
const defaultDependencies: WorkoutIngestionServiceDependencies = {
  parser: new OpenRouterWorkoutParser({
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
    referer: process.env.OPENROUTER_REFERER,
    title: "Zenith Fitness Ingestion",
  }),
  repository: defaultRepository,
};
const defaultWorkoutIngestionService = new WorkoutIngestionService(defaultDependencies);

export const getDefaultWorkoutIngestionRepository =
  (): InMemoryWorkoutIngestionRepository => defaultRepository;

export const createDefaultWorkoutIngestionService = (): WorkoutIngestionService => {
  return defaultWorkoutIngestionService;
};

export const createWorkoutIngestionPostHandler = (
  service: WorkoutIngestionService
) => {
  return async function postWorkoutIngestion(request: Request): Promise<Response> {
    let payload: unknown;

    try {
      payload = await request.json();
    } catch {
      return json(
        {
          error: "Invalid JSON payload.",
        },
        400
      );
    }

    try {
      const ingestionRequest = toWorkoutIngestionRequest(payload);
      const response = await service.ingest(ingestionRequest);

      return json(response, 200);
    } catch (error) {
      if (error instanceof IngestionValidationError) {
        return json(
          {
            error: error.message,
            validationErrors: error.validationErrors,
          },
          400
        );
      }

      return json(
        {
          error: "Workout ingestion failed unexpectedly.",
        },
        500
      );
    }
  };
};
