export type WorkoutType = string;

export interface WorkoutSet {
  weight: number; // lbs
  reps: number;
  startedAt?: number;
  endedAt?: number;
  restStartedAt?: number;
  restEndedAt?: number;
}

export interface Exercise {
  name: string;
  sets: WorkoutSet[];
}

export interface WorkoutSession {
  id: string;
  _id?: string;
  _creationTime?: number;
  date: string; // ISO date string (YYYY-MM-DD)
  type: Exclude<WorkoutType, "All">;
  status?: "active" | "completed";
  label?: string;
  startTime?: number;
  duration?: string;
  firstSetStartedAt?: number;
  lastSetEndedAt?: number;
  exercises: Exercise[];
}
