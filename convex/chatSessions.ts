import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("chatSessions")
      .withIndex("by_updatedAt")
      .order("desc")
      .take(50);
  },
});

export const create = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("chatSessions", {
      title: "New Chat",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateTitle = mutation({
  args: { sessionId: v.id("chatSessions"), title: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { title: args.title });
  },
});

export const remove = mutation({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    // Delete all messages in the session
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }
    // Delete the session
    await ctx.db.delete(args.sessionId);
  },
});
