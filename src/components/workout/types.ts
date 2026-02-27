export type FeedSet = {
  setNumber: number;
  weight: number;
  reps: number;
  startedAt?: number;
  endedAt?: number;
  restStartedAt?: number;
  restEndedAt?: number;
};

export type FeedExercise = {
  name: string;
  sets: FeedSet[];
};

export type LatestCompletedSet = {
  exerciseName: string;
  setNumber: number;
  weight: number;
  reps: number;
  endedAt: number | null;
};
