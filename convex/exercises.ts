import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const add = mutation({
  args: {
    sessionId: v.id("workoutSessions"),
    name: v.string(),
    sets: v.array(v.object({ weight: v.number(), reps: v.number() })),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("exercises", {
      sessionId: args.sessionId,
      name: args.name,
      sets: args.sets,
    });
  },
});

export const update = mutation({
  args: {
    exerciseId: v.id("exercises"),
    sets: v.array(v.object({ weight: v.number(), reps: v.number() })),
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
