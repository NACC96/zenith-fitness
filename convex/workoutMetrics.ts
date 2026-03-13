import { query } from "./_generated/server";
import { v } from "convex/values";

export const getSessionMetrics = query({
  args: { sessionId: v.id("workoutSessions") },
  handler: async (ctx, { sessionId }) => {
    const exercises = await ctx.db
      .query("exercises")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();

    let totalSets = 0;
    let totalVolume = 0;

    for (const ex of exercises) {
      for (const set of ex.sets) {
        totalSets++;
        totalVolume += (set.weight ?? 0) * (set.reps ?? 0);
      }
    }

    return {
      totalSets,
      totalVolume,
      exerciseCount: exercises.length,
    };
  },
});
