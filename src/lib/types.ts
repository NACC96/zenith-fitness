export type WorkoutType = string;

export interface WorkoutSet {
  weight: number; // lbs
  reps: number;
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
  label?: string;
  exercises: Exercise[];
}
