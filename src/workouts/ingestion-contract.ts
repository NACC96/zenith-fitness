import type {
  ISODateTimeString,
  ParsedWorkoutSession,
  UUID,
} from "./model";

export type IngestionMode = "auto_save";
export type ParseStatus = "parsed" | "parsed_with_warnings" | "failed";

export interface WorkoutIngestionRequest {
  rawText: string;
  submittedAt: ISODateTimeString;
  ingestionMode: IngestionMode;
  workoutTypeHintSlug?: string;
  occurredAtHint?: ISODateTimeString;
  timezone?: string;
}

export interface ParseFieldConfidence {
  fieldPath: string;
  confidence: number;
}

export type ParseIssueCode =
  | "MISSING_FIELD"
  | "INVALID_VALUE"
  | "AMBIGUOUS_VALUE"
  | "UNMAPPED_EXERCISE"
  | "INTERNAL_ERROR";

export interface ParseIssue {
  code: ParseIssueCode;
  message: string;
  fieldPath?: string;
}

export interface WorkoutParseOutput {
  session?: ParsedWorkoutSession;
  overallConfidence: number;
  fieldConfidence: ParseFieldConfidence[];
  errors: ParseIssue[];
  warnings: ParseIssue[];
}

export interface WorkoutIngestionResponse {
  rawLogId: UUID;
  parseVersion: number;
  status: ParseStatus;
  autoSaved: boolean;
  sessionId?: UUID;
  parse: WorkoutParseOutput;
  correction: {
    canRequestCorrection: boolean;
    correctionEndpoint: string;
  };
}

export type CorrectionOperation = "add" | "replace" | "remove";

export interface WorkoutCorrectionPatch {
  op: CorrectionOperation;
  path: string;
  value?: unknown;
}

export interface WorkoutCorrectionRequest {
  rawLogId: UUID;
  sessionId: UUID;
  reason: string;
  requestedAt: ISODateTimeString;
  patch: WorkoutCorrectionPatch[];
}

export interface WorkoutCorrectionResponse {
  correctionId: UUID;
  rawLogId: UUID;
  sessionId: UUID;
  status: "pending" | "applied" | "rejected";
  parseVersion: number;
  computationVersion: number;
  appliedAt?: ISODateTimeString;
  updatedSessionIds: UUID[];
  session?: ParsedWorkoutSession;
  insight?: SessionInsight;
}

export interface SessionInsight {
  sessionId: UUID;
  mode: "actionable" | "review";
  confidence: number;
  headline: string;
  summary: string;
  recommendations: string[];
  anomalies: string[];
}

export const INGESTION_REQUIRED_FIELDS = [
  "rawText",
  "submittedAt",
  "ingestionMode",
] as const;

export const INGESTION_OPTIONAL_FIELDS = [
  "workoutTypeHintSlug",
  "occurredAtHint",
  "timezone",
] as const;

export const PARSED_SESSION_REQUIRED_FIELDS = [
  "session.id",
  "session.rawLogId",
  "session.workoutTypeId",
  "session.occurredAt",
  "session.parseVersion",
  "exercisePerformances[].exerciseKey",
  "exercisePerformances[].exerciseName",
  "exercisePerformances[].setEntries[].setIndex",
  "exercisePerformances[].setEntries[].reps",
  "exercisePerformances[].setEntries[].weightLbs",
  "metrics.totalLbsLifted",
  "metrics.totalSets",
  "metrics.totalReps",
] as const;

export const PARSED_SESSION_OPTIONAL_FIELDS = [
  "session.timezone",
  "session.notes",
  "exercisePerformances[].setEntries[].isWarmup",
  "exercisePerformances[].setEntries[].rpe",
  "exercisePerformances[].setEntries[].notes",
  "exercisePerformances[].previousSessionVolumeDeltaLbs",
  "metrics.previousSessionTotalLbsDelta",
] as const;
