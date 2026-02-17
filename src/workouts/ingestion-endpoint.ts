import type {
  WorkoutCorrectionPatch,
  WorkoutCorrectionRequest,
  WorkoutIngestionRequest,
} from "./ingestion-contract";
import { InMemoryWorkoutIngestionRepository } from "./ingestion-repository";
import { OpenRouterWorkoutParser } from "./openrouter-client";
import {
  IngestionValidationError,
  WorkoutIngestionService,
  type WorkoutIngestionServiceDependencies,
} from "./ingestion-service";
import {
  CorrectionValidationError,
  WorkoutCorrectionService,
} from "./correction-service";

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
const defaultWorkoutCorrectionService = new WorkoutCorrectionService({
  repository: defaultRepository,
});

const toPatchListFromArray = (value: unknown): WorkoutCorrectionPatch[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => {
    const item = (entry ?? {}) as Record<string, unknown>;
    return {
      op:
        typeof item.op === "string"
          ? (item.op as WorkoutCorrectionPatch["op"])
          : "replace",
      path: typeof item.path === "string" ? item.path : "",
      value: item.value,
    };
  });
};

const buildPatchFromFormFields = (
  payload: Record<string, unknown>
): WorkoutCorrectionPatch[] => {
  const exerciseIndex = Number(optionalString(payload.exerciseIndex));
  const setIndex = Number(optionalString(payload.setIndex));
  const reps = Number(optionalString(payload.reps));
  const weightLbs = Number(optionalString(payload.weightLbs));

  if (
    !Number.isInteger(exerciseIndex) ||
    !Number.isInteger(setIndex) ||
    Number.isNaN(reps) ||
    Number.isNaN(weightLbs)
  ) {
    return [];
  }

  const exerciseOffset = exerciseIndex - 1;
  const setOffset = setIndex - 1;
  return [
    {
      op: "replace",
      path: `/exercisePerformances/${exerciseOffset}/setEntries/${setOffset}/reps`,
      value: reps,
    },
    {
      op: "replace",
      path: `/exercisePerformances/${exerciseOffset}/setEntries/${setOffset}/weightLbs`,
      value: weightLbs,
    },
  ];
};

const toWorkoutCorrectionRequest = (
  payload: unknown,
  nowIso: string
): WorkoutCorrectionRequest => {
  if (!isRecord(payload)) {
    throw new CorrectionValidationError("Workout correction request must be an object.", [
      {
        field: "body",
        message: "Request body must be a JSON object or form payload.",
      },
    ]);
  }

  const sessionRef = optionalString(payload.sessionRef);
  const [sessionFromRef, rawLogFromRef] = sessionRef ? sessionRef.split("::") : [];
  const patchJson = optionalString(payload.patchJson);
  let parsedPatchFromText: WorkoutCorrectionPatch[] = [];

  if (patchJson) {
    try {
      parsedPatchFromText = toPatchListFromArray(JSON.parse(patchJson));
    } catch {
      throw new CorrectionValidationError("patchJson must be valid JSON.", [
        {
          field: "patchJson",
          message: "patchJson must be a valid JSON array of patch operations.",
        },
      ]);
    }
  }

  const patchFromBody = toPatchListFromArray(payload.patch);
  const patchFromForm = buildPatchFromFormFields(payload);
  const normalizedPatch =
    patchFromBody.length > 0
      ? patchFromBody
      : parsedPatchFromText.length > 0
        ? parsedPatchFromText
        : patchFromForm;

  return {
    rawLogId: optionalString(payload.rawLogId) ?? rawLogFromRef ?? "",
    sessionId: optionalString(payload.sessionId) ?? sessionFromRef ?? "",
    reason: optionalString(payload.reason) ?? "",
    requestedAt: optionalString(payload.requestedAt) ?? nowIso,
    patch: normalizedPatch,
  };
};

const asFormPayload = async (
  request: Request
): Promise<Record<string, unknown>> => {
  const formData = await request.formData();
  const payload: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      payload[key] = value;
    }
  }

  return payload;
};

const toRedirectResponse = (
  request: Request,
  redirectTo: string,
  values: Record<string, string>
): Response => {
  const redirectUrl = new URL(redirectTo, request.url);
  for (const [key, value] of Object.entries(values)) {
    redirectUrl.searchParams.set(key, value);
  }

  return Response.redirect(redirectUrl, 303);
};

export const getDefaultWorkoutIngestionRepository =
  (): InMemoryWorkoutIngestionRepository => defaultRepository;

export const createDefaultWorkoutIngestionService = (): WorkoutIngestionService => {
  return defaultWorkoutIngestionService;
};

export const createDefaultWorkoutCorrectionService = (): WorkoutCorrectionService => {
  return defaultWorkoutCorrectionService;
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

export const createWorkoutCorrectionPostHandler = (
  service: WorkoutCorrectionService
) => {
  return async function postWorkoutCorrection(request: Request): Promise<Response> {
    const contentType = request.headers.get("content-type") ?? "";
    let payload: unknown;

    try {
      payload = contentType.includes("application/json")
        ? await request.json()
        : await asFormPayload(request);
    } catch {
      return json(
        {
          error: "Invalid correction payload.",
        },
        400
      );
    }

    const redirectTo =
      isRecord(payload) && typeof payload.redirectTo === "string"
        ? payload.redirectTo
        : undefined;

    try {
      const correctionRequest = toWorkoutCorrectionRequest(
        payload,
        new Date().toISOString()
      );
      const response = await service.applyCorrection(correctionRequest);

      if (redirectTo) {
        return toRedirectResponse(request, redirectTo, {
          correction: "applied",
          sessionId: response.sessionId,
          parseVersion: String(response.parseVersion),
          computationVersion: String(response.computationVersion),
        });
      }

      return json(response, 200);
    } catch (error) {
      if (error instanceof CorrectionValidationError) {
        if (redirectTo) {
          return toRedirectResponse(request, redirectTo, {
            correction: "error",
            error: error.validationErrors[0]?.message ?? error.message,
          });
        }

        return json(
          {
            error: error.message,
            validationErrors: error.validationErrors,
          },
          400
        );
      }

      if (redirectTo) {
        return toRedirectResponse(request, redirectTo, {
          correction: "error",
          error: "Correction failed unexpectedly.",
        });
      }

      return json(
        {
          error: "Correction failed unexpectedly.",
        },
        500
      );
    }
  };
};
