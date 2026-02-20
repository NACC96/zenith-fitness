import { internalMutation } from "./_generated/server";

const init = internalMutation(async (ctx) => {
  const existing = await ctx.db.query("workoutTypes").first();
  if (existing) {
    console.log("Database already seeded, skipping.");
    return;
  }

  // Seed workout types
  const types = ["Chest", "Back", "Legs", "Shoulders", "Arms"];
  for (const name of types) {
    await ctx.db.insert("workoutTypes", { name });
  }

  // Workout 1 — Chest, Jan 25, 2026
  const session1 = await ctx.db.insert("workoutSessions", {
    type: "Chest",
    date: "2026-01-25",
    label: "Sun, Jan 25",
  });
  await ctx.db.insert("exercises", {
    sessionId: session1,
    name: "Bench Press",
    sets: [
      { weight: 65, reps: 12 },
      { weight: 75, reps: 12 },
      { weight: 95, reps: 12 },
      { weight: 95, reps: 12 },
    ],
  });
  await ctx.db.insert("exercises", {
    sessionId: session1,
    name: "Incline Bench",
    sets: [
      { weight: 55, reps: 12 },
      { weight: 65, reps: 12 },
      { weight: 75, reps: 12 },
      { weight: 85, reps: 13 },
    ],
  });
  await ctx.db.insert("exercises", {
    sessionId: session1,
    name: "DB Press",
    sets: [
      { weight: 50, reps: 12 },
      { weight: 70, reps: 11 },
      { weight: 70, reps: 7 },
      { weight: 80, reps: 7 },
      { weight: 60, reps: 6 },
    ],
  });
  await ctx.db.insert("exercises", {
    sessionId: session1,
    name: "Fly Machine",
    sets: [
      { weight: 40, reps: 7 },
      { weight: 30, reps: 12 },
      { weight: 30, reps: 12 },
      { weight: 30, reps: 12 },
    ],
  });

  // Workout 2 — Chest, Feb 8, 2026
  const session2 = await ctx.db.insert("workoutSessions", {
    type: "Chest",
    date: "2026-02-08",
    label: "Sat, Feb 8",
  });
  await ctx.db.insert("exercises", {
    sessionId: session2,
    name: "Bench Press",
    sets: [
      { weight: 65, reps: 12 },
      { weight: 75, reps: 12 },
      { weight: 95, reps: 12 },
      { weight: 115, reps: 6 },
    ],
  });
  await ctx.db.insert("exercises", {
    sessionId: session2,
    name: "Incline Bench",
    sets: [
      { weight: 75, reps: 12 },
      { weight: 95, reps: 8 },
      { weight: 95, reps: 6 },
      { weight: 115, reps: 4 },
    ],
  });
  await ctx.db.insert("exercises", {
    sessionId: session2,
    name: "DB Press",
    sets: [
      { weight: 80, reps: 9 },
      { weight: 80, reps: 7 },
      { weight: 80, reps: 7 },
      { weight: 90, reps: 2 },
    ],
  });
  await ctx.db.insert("exercises", {
    sessionId: session2,
    name: "Fly Machine",
    sets: [
      { weight: 40, reps: 5 },
      { weight: 35, reps: 12 },
      { weight: 35, reps: 9 },
      { weight: 35, reps: 4 },
    ],
  });

  // Workout 3 — Chest, Feb 15, 2026
  const session3 = await ctx.db.insert("workoutSessions", {
    type: "Chest",
    date: "2026-02-15",
    label: "Sat, Feb 15",
  });
  await ctx.db.insert("exercises", {
    sessionId: session3,
    name: "Bench Press",
    sets: [
      { weight: 85, reps: 12 },
      { weight: 95, reps: 12 },
      { weight: 105, reps: 11.5 },
      { weight: 115, reps: 6 },
    ],
  });
  await ctx.db.insert("exercises", {
    sessionId: session3,
    name: "Incline Bench",
    sets: [
      { weight: 85, reps: 12 },
      { weight: 95, reps: 8 },
      { weight: 105, reps: 3 },
      { weight: 95, reps: 6 },
    ],
  });
  await ctx.db.insert("exercises", {
    sessionId: session3,
    name: "DB Press",
    sets: [
      { weight: 80, reps: 10 },
      { weight: 80, reps: 5 },
      { weight: 70, reps: 3 },
      { weight: 70, reps: 9 },
      { weight: 70, reps: 8 },
    ],
  });
  await ctx.db.insert("exercises", {
    sessionId: session3,
    name: "DB Pec Flys",
    sets: [
      { weight: 20, reps: 12 },
      { weight: 20, reps: 12 },
      { weight: 20, reps: 25 },
    ],
  });

  // Workout 4 — Back, Jan 27, 2026
  const session4 = await ctx.db.insert("workoutSessions", {
    type: "Back",
    date: "2026-01-27",
    label: "Tue, Jan 27",
  });
  await ctx.db.insert("exercises", {
    sessionId: session4,
    name: "Lat Pulldown",
    sets: [
      { weight: 90, reps: 12 },
      { weight: 100, reps: 10 },
      { weight: 110, reps: 8 },
      { weight: 110, reps: 7 },
    ],
  });
  await ctx.db.insert("exercises", {
    sessionId: session4,
    name: "Seated Row",
    sets: [
      { weight: 80, reps: 12 },
      { weight: 90, reps: 10 },
      { weight: 100, reps: 8 },
    ],
  });
  await ctx.db.insert("exercises", {
    sessionId: session4,
    name: "DB Row",
    sets: [
      { weight: 70, reps: 12 },
      { weight: 80, reps: 10 },
      { weight: 80, reps: 8 },
    ],
  });

  // Workout 5 — Legs, Jan 29, 2026
  const session5 = await ctx.db.insert("workoutSessions", {
    type: "Legs",
    date: "2026-01-29",
    label: "Thu, Jan 29",
  });
  await ctx.db.insert("exercises", {
    sessionId: session5,
    name: "Squat",
    sets: [
      { weight: 95, reps: 12 },
      { weight: 115, reps: 10 },
      { weight: 135, reps: 8 },
      { weight: 135, reps: 6 },
    ],
  });
  await ctx.db.insert("exercises", {
    sessionId: session5,
    name: "Leg Press",
    sets: [
      { weight: 180, reps: 12 },
      { weight: 200, reps: 10 },
      { weight: 220, reps: 8 },
    ],
  });
  await ctx.db.insert("exercises", {
    sessionId: session5,
    name: "Leg Curl",
    sets: [
      { weight: 60, reps: 12 },
      { weight: 70, reps: 10 },
      { weight: 70, reps: 8 },
    ],
  });

  console.log("Database seeded successfully.");
});

export default init;
