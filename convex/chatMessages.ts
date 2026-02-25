import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// List chat messages for a session
export const list = query({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .take(100);
  },
});

// User sends a message
export const send = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    content: v.string(),
    images: v.optional(v.array(v.string())),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("chatMessages", {
      sessionId: args.sessionId,
      role: "user",
      content: args.content,
      ...(args.images && args.images.length > 0 ? { images: args.images } : {}),
      timestamp: Date.now(),
    });
    // Update session's updatedAt
    await ctx.db.patch(args.sessionId, { updatedAt: Date.now() });
    // NOTE: Do NOT schedule ai.chat here anymore — streaming will handle AI calls from the client side
  },
});

// Internal mutation for AI to save its response
export const saveAssistantMessage = internalMutation({
  args: {
    sessionId: v.id("chatSessions"),
    content: v.string(),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("chatMessages", {
      sessionId: args.sessionId,
      role: "assistant",
      content: args.content,
      model: args.model,
      timestamp: Date.now(),
    });
    await ctx.db.patch(args.sessionId, { updatedAt: Date.now() });
  },
});

// Clear all messages in a session
export const clear = mutation({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }
  },
});
