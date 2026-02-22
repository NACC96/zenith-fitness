import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  workoutTypes: defineTable({
    name: v.string(),
  }).index("by_name", ["name"]),

  workoutSessions: defineTable({
    type: v.string(),
    date: v.string(),
    label: v.string(),
    status: v.optional(v.union(v.literal("active"), v.literal("completed"))),
    startTime: v.optional(v.number()),
    duration: v.optional(v.string()),
    workoutTypeId: v.optional(v.id("workoutTypes")),
    firstSetStartedAt: v.optional(v.number()),
    lastSetEndedAt: v.optional(v.number()),
    activeSet: v.optional(
      v.object({
        exerciseName: v.string(),
        startedAt: v.number(),
      })
    ),
    activeRestStartedAt: v.optional(v.number()),
  })
    .index("by_date", ["date"])
    .index("by_type", ["type"])
    .index("by_status", ["status"]),

  exercises: defineTable({
    sessionId: v.id("workoutSessions"),
    name: v.string(),
    sets: v.array(
      v.object({
        weight: v.number(),
        reps: v.number(),
        startedAt: v.optional(v.number()),
        endedAt: v.optional(v.number()),
        restStartedAt: v.optional(v.number()),
        restEndedAt: v.optional(v.number()),
      })
    ),
  }).index("by_session", ["sessionId"]),

  chatSessions: defineTable({
    title: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_updatedAt", ["updatedAt"]),

  chatMessages: defineTable({
    sessionId: v.optional(v.id("chatSessions")),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    model: v.optional(v.string()),
    timestamp: v.number(),
  }).index("by_session", ["sessionId", "timestamp"]),

  settings: defineTable({
    key: v.string(),
    value: v.string(),
  }).index("by_key", ["key"]),
});
