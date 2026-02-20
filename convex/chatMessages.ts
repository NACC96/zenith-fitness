import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// List recent chat messages (most recent 50)
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("chatMessages")
      .withIndex("by_timestamp")
      .order("asc")
      .take(50);
  },
});

// User sends a message — saves it and schedules AI response
export const send = mutation({
  args: {
    content: v.string(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    // Save user message
    await ctx.db.insert("chatMessages", {
      role: "user",
      content: args.content,
      timestamp: Date.now(),
    });

    // Schedule the AI action (runs asynchronously)
    await ctx.scheduler.runAfter(0, internal.ai.chat, {
      userMessage: args.content,
      model: args.model,
    });
  },
});

// Internal mutation for AI to save its response
export const saveAssistantMessage = internalMutation({
  args: {
    content: v.string(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("chatMessages", {
      role: "assistant",
      content: args.content,
      model: args.model,
      timestamp: Date.now(),
    });
  },
});

// Clear all chat messages
export const clear = mutation({
  args: {},
  handler: async (ctx) => {
    const messages = await ctx.db.query("chatMessages").collect();
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }
  },
});
