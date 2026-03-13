import { query } from "./_generated/server";
import { v } from "convex/values";

export const suggestNext = query({
  args: {
    sessionId: v.id("workoutSessions"),
  },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) return null;

    const currentExercises = await ctx.db
      .query("exercises")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
    const doneNames = new Set(
      currentExercises.map((e) => e.name.toLowerCase())
    );

    const recentSessions = await ctx.db
      .query("workoutSessions")
      .withIndex("by_type", (q) => q.eq("type", session.type))
      .order("desc")
      .take(10);

    const exerciseOrder: Map<string, { count: number; avgPosition: number }> =
      new Map();

    const exercisesBySession = new Map<string, typeof currentExercises>();
    for (const pastSession of recentSessions) {
      if (pastSession._id === sessionId) continue;

      const pastExercises = await ctx.db
        .query("exercises")
        .withIndex("by_session", (q) =>
          q.eq("sessionId", pastSession._id)
        )
        .collect();
      exercisesBySession.set(pastSession._id, pastExercises);

      pastExercises.forEach((ex, index) => {
        const name = ex.name.toLowerCase();
        const existing = exerciseOrder.get(name) ?? {
          count: 0,
          avgPosition: 0,
        };
        existing.avgPosition =
          (existing.avgPosition * existing.count + index) /
          (existing.count + 1);
        existing.count++;
        exerciseOrder.set(name, existing);
      });
    }

    const currentPosition = currentExercises.length;
    const candidates = [...exerciseOrder.entries()]
      .filter(([name]) => !doneNames.has(name))
      .sort(
        (a, b) =>
          Math.abs(a[1].avgPosition - currentPosition) -
          Math.abs(b[1].avgPosition - currentPosition)
      );

    if (candidates.length === 0) return null;

    // Return original casing from most recent occurrence
    const suggestedName = candidates[0][0];
    for (const pastSession of recentSessions) {
      const pastExercises = exercisesBySession.get(pastSession._id);
      if (!pastExercises) continue;
      const match = pastExercises.find(
        (e) => e.name.toLowerCase() === suggestedName
      );
      if (match) return match.name;
    }

    return candidates[0][0];
  },
});
