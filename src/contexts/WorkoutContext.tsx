"use client";

import { createContext, useContext, ReactNode } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface WorkoutContextValue {
  // Session
  session: ReturnType<typeof useQuery<typeof api.workoutSessions.getActive>> | undefined;
  sessionId: Id<"workoutSessions"> | null;

  // Exercises
  exercises: ReturnType<typeof useQuery<typeof api.exercises.listBySession>> | undefined;

  // Timing
  timingState: ReturnType<typeof useQuery<typeof api.workoutSessions.getLiveTimingState>> | undefined;

  // Mutations
  completeSet: ReturnType<typeof useMutation<typeof api.exercises.completeSet>>;
  startSet: ReturnType<typeof useMutation<typeof api.exercises.startSet>>;
  finishWorkout: ReturnType<typeof useMutation<typeof api.workoutSessions.finishActive>>;
}

const WorkoutContext = createContext<WorkoutContextValue | null>(null);

export function useWorkout() {
  const ctx = useContext(WorkoutContext);
  if (!ctx) throw new Error("useWorkout must be used within WorkoutProvider");
  return ctx;
}

export function WorkoutProvider({
  sessionId,
  children,
}: {
  sessionId: Id<"workoutSessions"> | null;
  children: ReactNode;
}) {
  const session = useQuery(api.workoutSessions.getActive);
  const exercises = useQuery(
    api.exercises.listBySession,
    sessionId ? { sessionId } : "skip"
  );
  const timingState = useQuery(
    api.workoutSessions.getLiveTimingState,
    sessionId ? { sessionId } : "skip"
  );

  const completeSet = useMutation(api.exercises.completeSet);
  const startSet = useMutation(api.exercises.startSet);
  const finishWorkout = useMutation(api.workoutSessions.finishActive);

  return (
    <WorkoutContext.Provider
      value={{
        session,
        sessionId,
        exercises,
        timingState,
        completeSet,
        startSet,
        finishWorkout,
      }}
    >
      {children}
    </WorkoutContext.Provider>
  );
}
