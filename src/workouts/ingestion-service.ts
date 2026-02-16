import { createHash, randomUUID } from "node:crypto";
import type {
  ParseStatus,
  WorkoutIngestionRequest,
  WorkoutIngestionResponse,
  WorkoutParseOutput,
} from "./ingestion-contract";
import type { ISODateTimeString } from "./model";
import type { WorkoutParsingGateway } from "./openrouter-client";
import { buildParseFailureOutput } from "./openrouter-schema";
import type {
  PersistIngestionRecordInput,
  WorkoutIngestionRepository,
} from "./ingestion-repository";
import {
  validateIngestionRequest,
  validateParseOutput,
} from "./validation";

const CORRECTION_ENDPOINT = "/api/workouts/corrections";

export class IngestionValidationError extends Error {
  public readonly validationErrors: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    validationErrors: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = "IngestionValidationError";
    this.validationErrors = validationErrors;
  }
}

export interface WorkoutIngestionServiceDependencies {
  parser: WorkoutParsingGateway;
  repository: WorkoutIngestionRepository;
  now?: () => Date;
  idGenerator?: () => string;
}

export const createIngestionIdempotencyKey = (
  request: WorkoutIngestionRequest
): string => {
  const normalizedText = request.rawText.trim().replace(/\s+/g, " ");
  const stablePayload = JSON.stringify({
    rawText: normalizedText,
    submittedAt: request.submittedAt,
    ingestionMode: request.ingestionMode,
    workoutTypeHintSlug: request.workoutTypeHintSlug ?? null,
    occurredAtHint: request.occurredAtHint ?? null,
    timezone: request.timezone ?? null,
  });

  return createHash("sha256").update(stablePayload).digest("hex");
};

const toIsoString = (date: Date): ISODateTimeString => date.toISOString();

const deriveStatus = (parse: WorkoutParseOutput): ParseStatus => {
  if (!parse.session) {
    return "failed";
  }

  if (parse.errors.length > 0 || parse.warnings.length > 0) {
    return "parsed_with_warnings";
  }

  return "parsed";
};

const enrichParseSessionIdentifiers = (
  parse: WorkoutParseOutput,
  ids: {
    rawLogId: string;
    parseVersion: number;
    idGenerator: () => string;
  }
): WorkoutParseOutput => {
  if (!parse.session) {
    return parse;
  }

  const sessionId =
    parse.session.session.id?.trim() ||
    ids.idGenerator();

  return {
    ...parse,
    session: {
      ...parse.session,
      session: {
        ...parse.session.session,
        id: sessionId,
        rawLogId: ids.rawLogId,
        parseVersion: ids.parseVersion,
      },
      exercisePerformances: parse.session.exercisePerformances.map((exercise) => ({
        ...exercise,
        id: exercise.id?.trim() || ids.idGenerator(),
        setEntries: exercise.setEntries.map((setEntry) => ({
          ...setEntry,
          id: setEntry.id?.trim() || ids.idGenerator(),
        })),
      })),
    },
  };
};

const buildValidationFailureParseOutput = (
  errorList: Array<{ field: string; message: string }>
): WorkoutParseOutput => ({
  ...buildParseFailureOutput(
    "Parsed workout output failed post-parse contract validation.",
    "INVALID_VALUE"
  ),
  warnings: errorList.map((error) => ({
    code: "INVALID_VALUE",
    message: error.message,
    fieldPath: error.field,
  })),
});

export class WorkoutIngestionService {
  private readonly deps: WorkoutIngestionServiceDependencies;
  private readonly now: () => Date;
  private readonly idGenerator: () => string;

  constructor(deps: WorkoutIngestionServiceDependencies) {
    this.deps = deps;
    this.now = deps.now ?? (() => new Date());
    this.idGenerator = deps.idGenerator ?? (() => randomUUID());
  }

  async ingest(
    request: WorkoutIngestionRequest
  ): Promise<WorkoutIngestionResponse> {
    const requestErrors = validateIngestionRequest(request);
    if (requestErrors.length > 0) {
      throw new IngestionValidationError(
        "Workout ingestion request failed validation.",
        requestErrors
      );
    }

    const idempotencyKey = createIngestionIdempotencyKey(request);
    const existingResponse = await this.deps.repository.findByIdempotencyKey(
      idempotencyKey
    );
    if (existingResponse) {
      return existingResponse;
    }

    const rawLogId = this.idGenerator();
    const parseVersion = 1;
    const parserResult = await this.deps.parser.parseWorkout(request);

    let parseOutput = enrichParseSessionIdentifiers(parserResult.parse, {
      rawLogId,
      parseVersion,
      idGenerator: this.idGenerator,
    });

    const parseValidationErrors = validateParseOutput(parseOutput);
    if (parseValidationErrors.length > 0) {
      parseOutput = buildValidationFailureParseOutput(parseValidationErrors);
    }

    const status = deriveStatus(parseOutput);
    const response: WorkoutIngestionResponse = {
      rawLogId,
      parseVersion,
      status,
      autoSaved: Boolean(parseOutput.session),
      ...(parseOutput.session
        ? { sessionId: parseOutput.session.session.id }
        : {}),
      parse: parseOutput,
      correction: {
        canRequestCorrection: Boolean(parseOutput.session),
        correctionEndpoint: CORRECTION_ENDPOINT,
      },
    };

    const persistedAt = toIsoString(this.now());
    const persistInput: PersistIngestionRecordInput = {
      idempotencyKey,
      request,
      response,
      persistedAt,
      modelLog: parserResult.modelLog,
    };

    await this.deps.repository.persistIngestionRecord(persistInput);
    return response;
  }
}
