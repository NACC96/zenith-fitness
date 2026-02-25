import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

const timedSetValidator = v.object({
  weight: v.number(),
  reps: v.number(),
  startedAt: v.optional(v.number()),
  endedAt: v.optional(v.number()),
  restStartedAt: v.optional(v.number()),
  restEndedAt: v.optional(v.number()),
});

type TimedSet = {
  weight: number;
  reps: number;
  startedAt?: number;
  endedAt?: number;
  restStartedAt?: number;
  restEndedAt?: number;
};

function normalizeSetsWithTiming(sets: TimedSet[], inferredAt: number): TimedSet[] {
  const normalized = sets.map((set) => {
    const startedAt = set.startedAt ?? inferredAt;
    const endedAt = set.endedAt ?? inferredAt;
    return {
      ...set,
      startedAt,
      endedAt,
      restStartedAt: set.restStartedAt ?? endedAt,
    };
  });

  return normalized.map((set, index) => ({
    ...set,
    restEndedAt: set.restEndedAt ?? normalized[index + 1]?.startedAt,
  }));
}

async function findExerciseByName(
  ctx: any,
  sessionId: Id<"workoutSessions">,
  exerciseName: string
) {
  const exercises = await ctx.db
    .query("exercises")
    .withIndex("by_session", (q: any) => q.eq("sessionId", sessionId))
    .collect();

  return (
    exercises.find((exercise: any) =>
      exercise.name.toLowerCase() === exerciseName.toLowerCase()
    ) ?? null
  );
}

async function closeOpenRest(
  ctx: any,
  sessionId: Id<"workoutSessions">,
  restEndedAt: number
) {
  const exercises = await ctx.db
    .query("exercises")
    .withIndex("by_session", (q: any) => q.eq("sessionId", sessionId))
    .collect();

  let latestCandidateExercise: any | null = null;
  let latestCandidateSetIndex = -1;
  let latestCandidateRestStartedAt = -1;

  for (const exercise of exercises) {
    for (let index = 0; index < exercise.sets.length; index += 1) {
      const set = exercise.sets[index] as TimedSet;
      if (set.restStartedAt === undefined || set.restEndedAt !== undefined) continue;
      if (set.restStartedAt > latestCandidateRestStartedAt) {
        latestCandidateExercise = exercise;
        latestCandidateSetIndex = index;
        latestCandidateRestStartedAt = set.restStartedAt;
      }
    }
  }

  if (!latestCandidateExercise || latestCandidateSetIndex < 0) return;

  const nextSets = [...latestCandidateExercise.sets];
  nextSets[latestCandidateSetIndex] = {
    ...nextSets[latestCandidateSetIndex],
    restEndedAt,
  };

  await ctx.db.patch(latestCandidateExercise._id, { sets: nextSets });
}

async function appendSetsToExercise(
  ctx: any,
  sessionId: Id<"workoutSessions">,
  exerciseName: string,
  sets: TimedSet[]
) {
  const existing = await findExerciseByName(ctx, sessionId, exerciseName);

  if (!existing) {
    return await ctx.db.insert("exercises", {
      sessionId,
      name: exerciseName,
      sets,
    });
  }

  await ctx.db.patch(existing._id, {
    sets: [...existing.sets, ...sets],
  });

  return existing._id;
}

// List exercises for a workout session (real-time via useQuery)
export const listBySession = query({
  args: { sessionId: v.id("workoutSessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("exercises")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

export const add = mutation({
  args: {
    sessionId: v.id("workoutSessions"),
    name: v.string(),
    sets: v.array(timedSetValidator),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    if (args.sets.length === 0) throw new Error("At least one set is required");

    const inferredAt = Date.now();
    const normalizedSets = normalizeSetsWithTiming(args.sets, inferredAt);
    const earliestStartedAt = Math.min(
      ...normalizedSets.map((set) => set.startedAt ?? inferredAt)
    );
    const latestEndedAt = Math.max(
      ...normalizedSets.map((set) => set.endedAt ?? inferredAt)
    );

    if (session.activeRestStartedAt !== undefined) {
      await closeOpenRest(ctx, args.sessionId, earliestStartedAt);
    }

    const exerciseId = await appendSetsToExercise(
      ctx,
      args.sessionId,
      args.name,
      normalizedSets
    );

    await ctx.db.patch(args.sessionId, {
      firstSetStartedAt:
        session.firstSetStartedAt === undefined
          ? earliestStartedAt
          : Math.min(session.firstSetStartedAt, earliestStartedAt),
      lastSetEndedAt:
        session.lastSetEndedAt === undefined
          ? latestEndedAt
          : Math.max(session.lastSetEndedAt, latestEndedAt),
      activeSet: undefined,
      activeRestStartedAt: latestEndedAt,
    });

    return exerciseId;
  },
});

export const startSet = mutation({
  args: {
    sessionId: v.id("workoutSessions"),
    exerciseName: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    const now = Date.now();

    if (session.activeRestStartedAt !== undefined) {
      await closeOpenRest(ctx, args.sessionId, now);
    }

    await ctx.db.patch(args.sessionId, {
      firstSetStartedAt: session.firstSetStartedAt ?? now,
      activeSet: {
        exerciseName: args.exerciseName,
        startedAt: now,
      },
      activeRestStartedAt: undefined,
    });

    return {
      sessionId: args.sessionId,
      exerciseName: args.exerciseName,
      startedAt: now,
    };
  },
});

export const completeSet = mutation({
  args: {
    sessionId: v.id("workoutSessions"),
    exerciseName: v.optional(v.string()),
    weight: v.number(),
    reps: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    const now = Date.now();
    const exerciseName = args.exerciseName ?? session.activeSet?.exerciseName;
    if (!exerciseName) {
      throw new Error("exerciseName is required when no active set is started");
    }

    const startedAt = session.activeSet?.startedAt ?? now;

    if (session.activeRestStartedAt !== undefined) {
      await closeOpenRest(ctx, args.sessionId, startedAt);
    }

    const completedSet: TimedSet = {
      weight: args.weight,
      reps: args.reps,
      startedAt,
      endedAt: now,
      restStartedAt: now,
    };

    await appendSetsToExercise(ctx, args.sessionId, exerciseName, [completedSet]);

    await ctx.db.patch(args.sessionId, {
      firstSetStartedAt:
        session.firstSetStartedAt === undefined
          ? startedAt
          : Math.min(session.firstSetStartedAt, startedAt),
      lastSetEndedAt:
        session.lastSetEndedAt === undefined
          ? now
          : Math.max(session.lastSetEndedAt, now),
      activeSet: undefined,
      activeRestStartedAt: now,
    });

    return {
      sessionId: args.sessionId,
      exerciseName,
      set: completedSet,
    };
  },
});

export const update = mutation({
  args: {
    exerciseId: v.id("exercises"),
    sets: v.array(timedSetValidator),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.exerciseId, { sets: args.sets });
  },
});

export const remove = mutation({
  args: { exerciseId: v.id("exercises") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.exerciseId);
  },
});

export const removeSet = mutation({
  args: {
    exerciseId: v.id("exercises"),
    setIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const exercise = await ctx.db.get(args.exerciseId);
    if (!exercise) throw new Error("Exercise not found");

    if (args.setIndex < 0 || args.setIndex >= exercise.sets.length) {
      throw new Error(
        `Invalid set index ${args.setIndex}. Exercise has ${exercise.sets.length} sets.`
      );
    }

    if (exercise.sets.length === 1) {
      await ctx.db.delete(args.exerciseId);
      return { deleted: "exercise" };
    }

    const nextSets = [...exercise.sets];
    nextSets.splice(args.setIndex, 1);
    await ctx.db.patch(args.exerciseId, { sets: nextSets });
    return { deleted: "set" };
  },
});
