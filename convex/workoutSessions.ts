import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get all sessions with their exercises, sorted by date desc
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.db
      .query("workoutSessions")
      .order("desc")
      .collect();

    const result = await Promise.all(
      sessions.map(async (session) => {
        const exercises = await ctx.db
          .query("exercises")
          .withIndex("by_session", (q) => q.eq("sessionId", session._id))
          .collect();

        return {
          ...session,
          id: session._id,
          exercises: exercises.map((ex) => ({
            name: ex.name,
            sets: ex.sets,
          })),
        };
      })
    );

    return result;
  },
});

// Get single session with exercises
export const getWithExercises = query({
  args: { sessionId: v.id("workoutSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;

    const exercises = await ctx.db
      .query("exercises")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    return {
      ...session,
      id: session._id,
      exercises: exercises.map((ex) => ({
        name: ex.name,
        sets: ex.sets,
      })),
    };
  },
});

// Create a new session
export const create = mutation({
  args: {
    type: v.string(),
    date: v.string(),
    label: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("workoutSessions", {
      type: args.type,
      date: args.date,
      label: args.label,
    });
  },
});

// Delete a session and its exercises
export const remove = mutation({
  args: { sessionId: v.id("workoutSessions") },
  handler: async (ctx, args) => {
    const exercises = await ctx.db
      .query("exercises")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    for (const ex of exercises) {
      await ctx.db.delete(ex._id);
    }
    await ctx.db.delete(args.sessionId);
  },
});
