import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

function formatSessionLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;

  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(utcDate.getTime())) return date;

  const weekday = utcDate.toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
  const monthName = utcDate.toLocaleDateString("en-US", {
    month: "short",
    timeZone: "UTC",
  });

  return `${weekday}, ${monthName} ${day}`;
}

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
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const computedLabel = formatSessionLabel(args.date);
    return await ctx.db.insert("workoutSessions", {
      type: args.type,
      date: args.date,
      label: computedLabel,
    });
  },
});

// Backfill labels from date for existing sessions
export const normalizeLabels = mutation({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.db.query("workoutSessions").collect();
    let updated = 0;

    for (const session of sessions) {
      const computedLabel = formatSessionLabel(session.date);
      if (session.label !== computedLabel) {
        await ctx.db.patch(session._id, { label: computedLabel });
        updated += 1;
      }
    }

    return { total: sessions.length, updated };
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
