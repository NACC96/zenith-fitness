export type UUID = string;
export type ISODateTimeString = string;

// v1 built-in types used for default filtering; custom types are additional rows.
export const BUILTIN_WORKOUT_TYPE_SLUGS = ["chest", "back", "legs"] as const;
export type BuiltInWorkoutTypeSlug = (typeof BUILTIN_WORKOUT_TYPE_SLUGS)[number];

export interface WorkoutType {
  id: UUID;
  slug: string;
  name: string;
  isBuiltIn: boolean;
  createdAt: ISODateTimeString;
  archivedAt?: ISODateTimeString | null;
}

export interface SetEntry {
  id: UUID;
  setIndex: number;
  reps: number;
  weightLbs: number;
  isWarmup?: boolean;
  rpe?: number | null;
  notes?: string | null;
}

export interface ExercisePerformance {
  id: UUID;
  exerciseKey: string;
  exerciseName: string;
  exerciseOrder: number;
  setEntries: SetEntry[];
  totalSets: number;
  totalReps: number;
  totalVolumeLbs: number;
  previousSessionVolumeDeltaLbs?: number | null;
}

export interface ExerciseProgression {
  exerciseKey: string;
  volumeDeltaLbs: number;
  repDelta: number;
}

export interface SessionMetrics {
  totalLbsLifted: number;
  totalSets: number;
  totalReps: number;
  previousSessionTotalLbsDelta?: number | null;
  perExerciseProgression: ExerciseProgression[];
}

export interface WorkoutSession {
  id: UUID;
  rawLogId: UUID;
  workoutTypeId: UUID;
  occurredAt: ISODateTimeString;
  timezone?: string | null;
  parseVersion: number;
  notes?: string | null;
}

export interface ParsedWorkoutSession {
  session: WorkoutSession;
  exercisePerformances: ExercisePerformance[];
  metrics: SessionMetrics;
}
