import { randomUUID } from "node:crypto";
import type {
  WorkoutCorrectionPatch,
  WorkoutCorrectionRequest,
  WorkoutCorrectionResponse,
  WorkoutIngestionResponse,
} from "./ingestion-contract";
import type { ISODateTimeString, ParsedWorkoutSession } from "./model";
import { recomputeParsedSessionMetrics } from "./metrics-engine";
import type {
  PersistCorrectionRecordInput,
  PersistedCorrectionRecord,
  WorkoutIngestionRepository,
} from "./ingestion-repository";
import { validateParsedWorkoutSession } from "./validation";
import { buildSessionInsight } from "./session-insights";

const toIsoString = (date: Date): ISODateTimeString => date.toISOString();

const setEntryPathPattern =
  /^\/exercisePerformances\/(\d+)\/setEntries\/(\d+)\/(reps|weightLbs|rpe|notes)$/;
const exercisePathPattern =
  /^\/exercisePerformances\/(\d+)\/(exerciseName|exerciseKey)$/;
const sessionPathPattern = /^\/session\/(notes|timezone)$/;

export class CorrectionValidationError extends Error {
  public readonly validationErrors: Array<{ field: string; message: string }>;

  constructor(message: string, validationErrors: Array<{ field: string; message: string }>) {
    super(message);
    this.name = "CorrectionValidationError";
    this.validationErrors = validationErrors;
  }
}

export interface WorkoutCorrectionServiceDependencies {
  repository: WorkoutIngestionRepository;
  now?: () => Date;
  idGenerator?: () => string;
}

const isSupportedOp = (
  value: string
): value is WorkoutCorrectionPatch["op"] =>
  value === "add" || value === "replace" || value === "remove";

const normalizePatch = (
  patch: WorkoutCorrectionPatch[]
): WorkoutCorrectionPatch[] => {
  return patch.map((entry) => ({
    op: entry.op,
    path: entry.path.trim(),
    value: entry.value,
  }));
};

const validateCorrectionRequest = (
  request: WorkoutCorrectionRequest
): Array<{ field: string; message: string }> => {
  const errors: Array<{ field: string; message: string }> = [];

  if (!request.rawLogId?.trim()) {
    errors.push({ field: "rawLogId", message: "rawLogId is required." });
  }

  if (!request.sessionId?.trim()) {
    errors.push({ field: "sessionId", message: "sessionId is required." });
  }

  if (!request.reason?.trim()) {
    errors.push({ field: "reason", message: "reason is required." });
  }

  if (!request.requestedAt || Number.isNaN(Date.parse(request.requestedAt))) {
    errors.push({
      field: "requestedAt",
      message: "requestedAt must be an ISO datetime string.",
    });
  }

  if (!Array.isArray(request.patch) || request.patch.length < 1) {
    errors.push({
      field: "patch",
      message: "patch must include at least one operation.",
    });
  }

  request.patch.forEach((patch, index) => {
    if (!isSupportedOp(patch.op)) {
      errors.push({
        field: `patch[${index}].op`,
        message: "patch operation must be add, replace, or remove.",
      });
    }

    if (typeof patch.path !== "string" || !patch.path.trim().startsWith("/")) {
      errors.push({
        field: `patch[${index}].path`,
        message: "patch path must be a JSON pointer path beginning with '/'.",
      });
    }
  });

  return errors;
};

const ensureNumber = (
  value: unknown,
  field: string,
  errors: Array<{ field: string; message: string }>
): number => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    errors.push({
      field,
      message: "value must be a number.",
    });
    return 0;
  }

  return value;
};

const applyPatch = (
  session: ParsedWorkoutSession,
  patch: WorkoutCorrectionPatch[]
): ParsedWorkoutSession => {
  const nextSession = structuredClone(session);
  const errors: Array<{ field: string; message: string }> = [];

  for (const [index, operation] of normalizePatch(patch).entries()) {
    const setEntryMatch = operation.path.match(setEntryPathPattern);
    if (setEntryMatch) {
      const exerciseIndex = Number(setEntryMatch[1]);
      const setIndex = Number(setEntryMatch[2]);
      const field = setEntryMatch[3];
      const exercise = nextSession.exercisePerformances[exerciseIndex];
      const setEntry = exercise?.setEntries[setIndex];

      if (!exercise || !setEntry) {
        errors.push({
          field: `patch[${index}]`,
          message: "patch path targets a set that does not exist.",
        });
        continue;
      }

      if (operation.op === "remove") {
        if (field === "notes") {
          setEntry.notes = null;
          continue;
        }
        if (field === "rpe") {
          setEntry.rpe = null;
          continue;
        }

        errors.push({
          field: `patch[${index}]`,
          message: "reps and weightLbs cannot be removed.",
        });
        continue;
      }

      if (field === "reps") {
        const value = ensureNumber(operation.value, `patch[${index}].value`, errors);
        if (!Number.isInteger(value) || value < 1) {
          errors.push({
            field: `patch[${index}].value`,
            message: "reps must be an integer greater than 0.",
          });
          continue;
        }
        setEntry.reps = value;
        continue;
      }

      if (field === "weightLbs") {
        const value = ensureNumber(operation.value, `patch[${index}].value`, errors);
        if (value < 0) {
          errors.push({
            field: `patch[${index}].value`,
            message: "weightLbs cannot be negative.",
          });
          continue;
        }
        setEntry.weightLbs = value;
        continue;
      }

      if (field === "rpe") {
        const value = ensureNumber(operation.value, `patch[${index}].value`, errors);
        if (value < 0 || value > 10) {
          errors.push({
            field: `patch[${index}].value`,
            message: "rpe must be between 0 and 10.",
          });
          continue;
        }
        setEntry.rpe = value;
        continue;
      }

      setEntry.notes = typeof operation.value === "string" ? operation.value : null;
      continue;
    }

    const exerciseMatch = operation.path.match(exercisePathPattern);
    if (exerciseMatch) {
      const exerciseIndex = Number(exerciseMatch[1]);
      const field = exerciseMatch[2];
      const exercise = nextSession.exercisePerformances[exerciseIndex];
      if (!exercise) {
        errors.push({
          field: `patch[${index}]`,
          message: "patch path targets an exercise that does not exist.",
        });
        continue;
      }

      if (operation.op === "remove") {
        errors.push({
          field: `patch[${index}]`,
          message: `${field} cannot be removed.`,
        });
        continue;
      }

      if (typeof operation.value !== "string" || !operation.value.trim()) {
        errors.push({
          field: `patch[${index}].value`,
          message: `${field} must be a non-empty string.`,
        });
        continue;
      }

      if (field === "exerciseName") {
        exercise.exerciseName = operation.value.trim();
      } else {
        exercise.exerciseKey = operation.value.trim();
      }
      continue;
    }

    const sessionMatch = operation.path.match(sessionPathPattern);
    if (sessionMatch) {
      const field = sessionMatch[1];
      if (operation.op === "remove") {
        if (field === "notes") {
          nextSession.session.notes = null;
        } else {
          nextSession.session.timezone = null;
        }
        continue;
      }

      if (operation.value == null) {
        if (field === "notes") {
          nextSession.session.notes = null;
        } else {
          nextSession.session.timezone = null;
        }
        continue;
      }

      if (typeof operation.value !== "string") {
        errors.push({
          field: `patch[${index}].value`,
          message: `${field} must be a string or null.`,
        });
        continue;
      }

      if (field === "notes") {
        nextSession.session.notes = operation.value;
      } else {
        nextSession.session.timezone = operation.value;
      }
      continue;
    }

    errors.push({
      field: `patch[${index}].path`,
      message:
        "Unsupported patch path. Supported paths: /session/{notes|timezone}, /exercisePerformances/{i}/{exerciseName|exerciseKey}, /exercisePerformances/{i}/setEntries/{j}/{reps|weightLbs|rpe|notes}.",
    });
  }

  if (errors.length > 0) {
    throw new CorrectionValidationError("Correction patch failed validation.", errors);
  }

  return nextSession;
};

const toDerivedSnapshot = (session: ParsedWorkoutSession): string => {
  return JSON.stringify({
    exercisePerformances: session.exercisePerformances.map((exercise) => ({
      exerciseKey: exercise.exerciseKey,
      exerciseName: exercise.exerciseName,
      totalSets: exercise.totalSets,
      totalReps: exercise.totalReps,
      totalVolumeLbs: exercise.totalVolumeLbs,
      previousSessionVolumeDeltaLbs: exercise.previousSessionVolumeDeltaLbs ?? null,
    })),
    metrics: {
      totalLbsLifted: session.metrics.totalLbsLifted,
      totalSets: session.metrics.totalSets,
      totalReps: session.metrics.totalReps,
      previousSessionTotalLbsDelta: session.metrics.previousSessionTotalLbsDelta ?? null,
      perExerciseProgression: session.metrics.perExerciseProgression,
    },
  });
};

export class WorkoutCorrectionService {
  private readonly repository: WorkoutIngestionRepository;
  private readonly now: () => Date;
  private readonly idGenerator: () => string;

  constructor(deps: WorkoutCorrectionServiceDependencies) {
    this.repository = deps.repository;
    this.now = deps.now ?? (() => new Date());
    this.idGenerator = deps.idGenerator ?? (() => randomUUID());
  }

  async applyCorrection(
    request: WorkoutCorrectionRequest
  ): Promise<WorkoutCorrectionResponse> {
    const requestErrors = validateCorrectionRequest(request);
    if (requestErrors.length > 0) {
      throw new CorrectionValidationError(
        "Workout correction request failed validation.",
        requestErrors
      );
    }

    const existingResponse = await this.repository.findBySessionId(request.sessionId);
    if (!existingResponse || !existingResponse.parse.session) {
      throw new CorrectionValidationError("Session is not available for correction.", [
        {
          field: "sessionId",
          message: "sessionId does not reference a persisted parsed session.",
        },
      ]);
    }

    if (existingResponse.rawLogId !== request.rawLogId) {
      throw new CorrectionValidationError("rawLogId does not match the session.", [
        {
          field: "rawLogId",
          message: "rawLogId must match the raw log for the target session.",
        },
      ]);
    }

    const previousComputationVersion =
      existingResponse.parse.session.metrics.computationVersion ?? 1;
    const correctedParseVersion = existingResponse.parseVersion + 1;
    const patchedSession = applyPatch(existingResponse.parse.session, request.patch);
    const workoutTypeId = patchedSession.session.workoutTypeId;

    const sameTypeSessions = await this.repository.listParsedSessions({ workoutTypeId });
    const targetIndex = sameTypeSessions.findIndex(
      (session) => session.session.id === request.sessionId
    );

    if (targetIndex < 0) {
      throw new CorrectionValidationError(
        "Target session is not in the workout-type timeline.",
        [
          {
            field: "sessionId",
            message: "Target session is missing from the workout timeline.",
          },
        ]
      );
    }

    const timeline = [...sameTypeSessions];
    timeline[targetIndex] = patchedSession;
    const recomputedBySessionId = new Map<string, ParsedWorkoutSession>();
    let previousSession = targetIndex > 0 ? timeline[targetIndex - 1] : null;

    for (let index = targetIndex; index < timeline.length; index += 1) {
      const sourceSession = timeline[index];
      const recomputedSession = recomputeParsedSessionMetrics(sourceSession, previousSession);
      recomputedBySessionId.set(sourceSession.session.id, recomputedSession);
      previousSession = recomputedSession;
    }

    const updatedResponses: WorkoutIngestionResponse[] = [];
    for (let index = targetIndex; index < timeline.length; index += 1) {
      const session = timeline[index];
      const sessionId = session.session.id;
      const recomputedSession = recomputedBySessionId.get(sessionId);
      const persistedResponse =
        sessionId === request.sessionId
          ? existingResponse
          : await this.repository.findBySessionId(sessionId);

      if (!persistedResponse || !persistedResponse.parse.session || !recomputedSession) {
        continue;
      }

      const derivedChanged =
        sessionId === request.sessionId ||
        toDerivedSnapshot(persistedResponse.parse.session) !==
          toDerivedSnapshot(recomputedSession);
      if (!derivedChanged) {
        continue;
      }

      const nextComputationVersion =
        (persistedResponse.parse.session.metrics.computationVersion ?? 1) + 1;
      const recomputedSessionWithVersion: ParsedWorkoutSession = {
        ...recomputedSession,
        session: {
          ...recomputedSession.session,
          parseVersion:
            sessionId === request.sessionId
              ? correctedParseVersion
              : persistedResponse.parse.session.session.parseVersion,
        },
        metrics: {
          ...recomputedSession.metrics,
          computationVersion:
            sessionId === request.sessionId
              ? previousComputationVersion + 1
              : nextComputationVersion,
        },
      };

      const validationErrors = validateParsedWorkoutSession(recomputedSessionWithVersion);
      if (validationErrors.length > 0) {
        throw new CorrectionValidationError(
          "Corrected session failed validation after recomputation.",
          validationErrors
        );
      }

      updatedResponses.push({
        ...persistedResponse,
        parseVersion:
          sessionId === request.sessionId
            ? correctedParseVersion
            : persistedResponse.parseVersion,
        parse: {
          ...persistedResponse.parse,
          session: recomputedSessionWithVersion,
        },
      });
    }

    const persistedAt = toIsoString(this.now());
    const correctionRecord: PersistedCorrectionRecord = {
      correctionId: this.idGenerator(),
      rawLogId: request.rawLogId,
      sessionId: request.sessionId,
      reason: request.reason.trim(),
      patch: request.patch,
      status: "applied",
      requestedAt: request.requestedAt,
      appliedAt: persistedAt,
    };
    const persistInput: PersistCorrectionRecordInput = {
      correction: correctionRecord,
      updatedResponses,
      persistedAt,
    };

    await this.repository.persistCorrectionRecord(persistInput);

    const correctedResponse =
      updatedResponses.find((response) => response.sessionId === request.sessionId) ??
      existingResponse;
    if (!correctedResponse.parse.session) {
      throw new CorrectionValidationError(
        "Corrected session could not be persisted.",
        [
          {
            field: "sessionId",
            message: "Corrected session payload is missing after persistence.",
          },
        ]
      );
    }

    const previousForInsight =
      targetIndex > 0 ? recomputedBySessionId.get(timeline[targetIndex - 1].session.id) ?? timeline[targetIndex - 1] : null;
    const insight = buildSessionInsight({
      session: correctedResponse.parse.session,
      previousSession: previousForInsight,
      parseQuality: {
        overallConfidence: correctedResponse.parse.overallConfidence,
        warnings: correctedResponse.parse.warnings,
        errors: correctedResponse.parse.errors,
      },
    });

    return {
      correctionId: correctionRecord.correctionId,
      rawLogId: correctedResponse.rawLogId,
      sessionId: request.sessionId,
      status: "applied",
      parseVersion: correctedResponse.parseVersion,
      computationVersion:
        correctedResponse.parse.session.metrics.computationVersion ?? 1,
      appliedAt: correctionRecord.appliedAt,
      updatedSessionIds: updatedResponses
        .map((response) => response.sessionId)
        .filter((sessionId): sessionId is string => typeof sessionId === "string"),
      session: correctedResponse.parse.session,
      insight,
    };
  }
}
