import type {
  ParsedWorkoutSession,
  WorkoutSession,
  ExercisePerformance,
  SetEntry,
} from "./model";
import type { WorkoutIngestionRequest, WorkoutParseOutput } from "./ingestion-contract";

export interface ValidationError {
  field: string;
  message: string;
}

const isIsoDateTime = (value: string): boolean => !Number.isNaN(Date.parse(value));

const sum = (values: number[]): number => values.reduce((acc, value) => acc + value, 0);

const validateSetEntry = (entry: SetEntry, prefix: string): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!Number.isInteger(entry.setIndex) || entry.setIndex < 1) {
    errors.push({
      field: `${prefix}.setIndex`,
      message: "setIndex must be an integer greater than 0.",
    });
  }

  if (!Number.isInteger(entry.reps) || entry.reps < 1) {
    errors.push({
      field: `${prefix}.reps`,
      message: "reps must be an integer greater than 0.",
    });
  }

  if (entry.weightLbs < 0) {
    errors.push({
      field: `${prefix}.weightLbs`,
      message: "weightLbs cannot be negative.",
    });
  }

  if (entry.rpe != null && (entry.rpe < 0 || entry.rpe > 10)) {
    errors.push({
      field: `${prefix}.rpe`,
      message: "rpe must be between 0 and 10 when provided.",
    });
  }

  return errors;
};

const validateExercisePerformance = (
  exercise: ExercisePerformance,
  index: number
): ValidationError[] => {
  const prefix = `exercisePerformances[${index}]`;
  const errors: ValidationError[] = [];

  if (!exercise.exerciseKey.trim()) {
    errors.push({
      field: `${prefix}.exerciseKey`,
      message: "exerciseKey is required.",
    });
  }

  if (!exercise.exerciseName.trim()) {
    errors.push({
      field: `${prefix}.exerciseName`,
      message: "exerciseName is required.",
    });
  }

  if (exercise.setEntries.length < 1) {
    errors.push({
      field: `${prefix}.setEntries`,
      message: "setEntries must contain at least one set.",
    });
  }

  exercise.setEntries.forEach((setEntry, setIndex) => {
    errors.push(...validateSetEntry(setEntry, `${prefix}.setEntries[${setIndex}]`));
  });

  const totalSets = exercise.setEntries.length;
  const totalReps = sum(exercise.setEntries.map((entry) => entry.reps));
  const totalVolumeLbs = sum(
    exercise.setEntries.map((entry) => entry.reps * entry.weightLbs)
  );

  if (exercise.totalSets !== totalSets) {
    errors.push({
      field: `${prefix}.totalSets`,
      message: "totalSets must equal the number of set entries.",
    });
  }

  if (exercise.totalReps !== totalReps) {
    errors.push({
      field: `${prefix}.totalReps`,
      message: "totalReps must equal the sum of reps across set entries.",
    });
  }

  if (exercise.totalVolumeLbs !== totalVolumeLbs) {
    errors.push({
      field: `${prefix}.totalVolumeLbs`,
      message:
        "totalVolumeLbs must equal the sum of (weightLbs * reps) across set entries.",
    });
  }

  return errors;
};

const validateSessionCore = (session: WorkoutSession): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!session.id.trim()) {
    errors.push({ field: "session.id", message: "session.id is required." });
  }

  if (!session.rawLogId.trim()) {
    errors.push({ field: "session.rawLogId", message: "session.rawLogId is required." });
  }

  if (!session.workoutTypeId.trim()) {
    errors.push({
      field: "session.workoutTypeId",
      message: "session.workoutTypeId is required.",
    });
  }

  if (!isIsoDateTime(session.occurredAt)) {
    errors.push({
      field: "session.occurredAt",
      message: "session.occurredAt must be an ISO datetime string.",
    });
  }

  if (!Number.isInteger(session.parseVersion) || session.parseVersion < 1) {
    errors.push({
      field: "session.parseVersion",
      message: "session.parseVersion must be an integer greater than 0.",
    });
  }

  return errors;
};

export const validateIngestionRequest = (
  request: WorkoutIngestionRequest
): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!request.rawText.trim()) {
    errors.push({
      field: "rawText",
      message: "rawText is required and cannot be empty.",
    });
  }

  if (!isIsoDateTime(request.submittedAt)) {
    errors.push({
      field: "submittedAt",
      message: "submittedAt must be an ISO datetime string.",
    });
  }

  if (request.ingestionMode !== "auto_save") {
    errors.push({
      field: "ingestionMode",
      message: "ingestionMode must be auto_save for v1.",
    });
  }

  if (request.occurredAtHint && !isIsoDateTime(request.occurredAtHint)) {
    errors.push({
      field: "occurredAtHint",
      message: "occurredAtHint must be an ISO datetime string when provided.",
    });
  }

  return errors;
};

export const validateParsedWorkoutSession = (
  parsedSession: ParsedWorkoutSession
): ValidationError[] => {
  const errors: ValidationError[] = [];

  errors.push(...validateSessionCore(parsedSession.session));

  if (parsedSession.exercisePerformances.length < 1) {
    errors.push({
      field: "exercisePerformances",
      message: "exercisePerformances must contain at least one exercise.",
    });
  }

  parsedSession.exercisePerformances.forEach((exercise, index) => {
    errors.push(...validateExercisePerformance(exercise, index));
  });

  const expectedTotalSets = sum(
    parsedSession.exercisePerformances.map((exercise) => exercise.totalSets)
  );
  const expectedTotalReps = sum(
    parsedSession.exercisePerformances.map((exercise) => exercise.totalReps)
  );
  const expectedTotalLbs = sum(
    parsedSession.exercisePerformances.map((exercise) => exercise.totalVolumeLbs)
  );

  if (parsedSession.metrics.totalSets !== expectedTotalSets) {
    errors.push({
      field: "metrics.totalSets",
      message: "metrics.totalSets must equal aggregate exercise totalSets.",
    });
  }

  if (parsedSession.metrics.totalReps !== expectedTotalReps) {
    errors.push({
      field: "metrics.totalReps",
      message: "metrics.totalReps must equal aggregate exercise totalReps.",
    });
  }

  if (parsedSession.metrics.totalLbsLifted !== expectedTotalLbs) {
    errors.push({
      field: "metrics.totalLbsLifted",
      message:
        "metrics.totalLbsLifted must equal aggregate exercise totalVolumeLbs.",
    });
  }

  if (
    parsedSession.metrics.perExerciseProgression.length !==
    parsedSession.exercisePerformances.length
  ) {
    errors.push({
      field: "metrics.perExerciseProgression",
      message:
        "perExerciseProgression must include one entry for each exercise in the session.",
    });
  }

  return errors;
};

export const validateParseOutput = (
  parseOutput: WorkoutParseOutput
): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (parseOutput.overallConfidence < 0 || parseOutput.overallConfidence > 1) {
    errors.push({
      field: "parse.overallConfidence",
      message: "overallConfidence must be between 0 and 1.",
    });
  }

  parseOutput.fieldConfidence.forEach((confidence, index) => {
    if (confidence.confidence < 0 || confidence.confidence > 1) {
      errors.push({
        field: `parse.fieldConfidence[${index}].confidence`,
        message: "field confidence must be between 0 and 1.",
      });
    }
  });

  if (parseOutput.session) {
    errors.push(...validateParsedWorkoutSession(parseOutput.session));
  }

  return errors;
};

