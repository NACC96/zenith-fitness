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
  })
    .index("by_date", ["date"])
    .index("by_type", ["type"]),

  exercises: defineTable({
    sessionId: v.id("workoutSessions"),
    name: v.string(),
    sets: v.array(
      v.object({
        weight: v.number(),
        reps: v.number(),
      })
    ),
  }).index("by_session", ["sessionId"]),
});
