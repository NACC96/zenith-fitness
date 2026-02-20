export type WorkoutType = "All" | "Chest" | "Back" | "Legs" | "Shoulders" | "Arms";

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
  date: string; // ISO date string (YYYY-MM-DD)
  type: Exclude<WorkoutType, "All">;
  exercises: Exercise[];
}
