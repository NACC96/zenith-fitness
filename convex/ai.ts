"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";

const SYSTEM_PROMPT = `You are Zenith AI, a workout tracking assistant. You help users log workouts and analyze their training history.

When a user describes exercises they did, use the logExercise tool to record them. Parse natural language like:
- "bench 95 for 12, 115 for 6" → two sets of bench press
- "did chest today: bench 95x12, 115x6, incline 75x12" → creates a Chest session with multiple exercises
- "squats 135 for 8, 135 for 6, 155 for 4" → three sets

Always confirm what you logged. When the user asks about their history or progress, use getWorkoutHistory and getExerciseStats to give accurate answers.

Key rules:
- Weight is always in pounds (lb)
- If the user doesn't specify a date, use today's date
- If the user doesn't specify a workout type, infer it (bench/incline/flys = Chest, squat/leg press = Legs, etc.)
- Be concise but friendly. Use the user's data for personalized feedback.
- Today's date is ${new Date().toISOString().split("T")[0]}
- Format dates as "Day, Mon DD" (e.g., "Sat, Feb 15") for labels`;

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "logExercise",
      description:
        "Log an exercise with sets to a workout session. Creates the session if it doesn't exist for that date/type.",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description:
              "Workout type (e.g., Chest, Back, Legs, Shoulders, Arms)",
          },
          date: { type: "string", description: "ISO date YYYY-MM-DD" },
          label: {
            type: "string",
            description: "Human-readable date label like 'Sat, Feb 15'",
          },
          exerciseName: {
            type: "string",
            description: "Exercise name (e.g., Bench Press, Squat)",
          },
          sets: {
            type: "array",
            items: {
              type: "object",
              properties: {
                weight: { type: "number", description: "Weight in pounds" },
                reps: { type: "number", description: "Number of reps" },
              },
              required: ["weight", "reps"],
            },
          },
        },
        required: ["type", "date", "label", "exerciseName", "sets"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getWorkoutHistory",
      description:
        "Get recent workout sessions, optionally filtered by type",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description: "Filter by workout type (optional)",
          },
          limit: {
            type: "number",
            description: "Max sessions to return (default 10)",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getExerciseStats",
      description:
        "Get stats for a specific exercise across all sessions: max weight, total volume, estimated 1RM",
      parameters: {
        type: "object",
        properties: {
          exerciseName: {
            type: "string",
            description: "Exercise name to search for",
          },
        },
        required: ["exerciseName"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "createWorkoutType",
      description: "Create a new workout type category",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Workout type name" },
        },
        required: ["name"],
      },
    },
  },
];

export const chat = internalAction({
  args: {
    userMessage: v.string(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

    // Get recent messages for context (last 20)
    const recentMessages = await ctx.runQuery(api.chatMessages.list);
    const messageHistory = recentMessages.slice(-20).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Build request
    const messages: any[] = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      ...messageHistory,
    ];

    // Reasoning config — some models have mandatory reasoning, others use effort param
    const mandatoryReasoningModels = [
      "google/gemini-3.1-pro-preview",
      "minimax/minimax-m2.5",
    ];
    const reasoning = mandatoryReasoningModels.includes(args.model)
      ? undefined // these models reason by default
      : { effort: "high" as const };

    let attempts = 0;
    const maxAttempts = 5; // max tool call rounds

    while (attempts < maxAttempts) {
      attempts++;

      const body: Record<string, unknown> = {
        model: args.model,
        messages,
        tools: TOOLS,
        tool_choice: "auto",
      };
      if (reasoning) body.reasoning = reasoning;

      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://zenith-fitness.vercel.app",
            "X-Title": "Zenith Fitness",
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error("OpenRouter error:", error);
        await ctx.runMutation(internal.chatMessages.saveAssistantMessage, {
          content: `Sorry, I encountered an error: ${response.status}. Please try again.`,
          model: args.model,
        });
        return;
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      if (!choice) {
        await ctx.runMutation(internal.chatMessages.saveAssistantMessage, {
          content: "Sorry, I didn't get a response. Please try again.",
          model: args.model,
        });
        return;
      }

      const message = choice.message;

      // If no tool calls, we have the final response
      if (!message.tool_calls || message.tool_calls.length === 0) {
        const content =
          message.content || "I'm not sure how to respond to that.";
        await ctx.runMutation(internal.chatMessages.saveAssistantMessage, {
          content,
          model: args.model,
        });
        return;
      }

      // Process tool calls
      messages.push(message); // add assistant's tool call message

      for (const toolCall of message.tool_calls) {
        const name = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);
        let result: string;

        try {
          if (name === "logExercise") {
            result = await handleLogExercise(ctx, toolArgs);
          } else if (name === "getWorkoutHistory") {
            result = await handleGetHistory(ctx, toolArgs);
          } else if (name === "getExerciseStats") {
            result = await handleGetStats(ctx, toolArgs);
          } else if (name === "createWorkoutType") {
            result = await handleCreateType(ctx, toolArgs);
          } else {
            result = JSON.stringify({ error: `Unknown tool: ${name}` });
          }
        } catch (e: unknown) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          result = JSON.stringify({ error: errorMessage });
        }

        messages.push({
          role: "tool" as const,
          tool_call_id: toolCall.id,
          content: result,
        });
      }
      // Loop back to let AI process tool results
    }

    // If we exhausted attempts
    await ctx.runMutation(internal.chatMessages.saveAssistantMessage, {
      content:
        "I processed your request but ran into complexity. Here's what I was able to do — check the dashboard for any updates.",
      model: args.model,
    });
  },
});

// Tool handler implementations
async function handleLogExercise(ctx: any, args: any): Promise<string> {
  // Find or create session for this date/type
  const sessions = await ctx.runQuery(api.workoutSessions.listAll);
  const session = sessions.find(
    (s: any) => s.date === args.date && s.type === args.type
  );

  let sessionId;
  if (!session) {
    // Create session
    sessionId = await ctx.runMutation(api.workoutSessions.create, {
      type: args.type,
      date: args.date,
      label: args.label,
    });
    // Also ensure the workout type exists
    await ctx.runMutation(api.workoutTypes.create, { name: args.type });
  } else {
    sessionId = session._id;
  }

  // Add the exercise
  await ctx.runMutation(api.exercises.add, {
    sessionId,
    name: args.exerciseName,
    sets: args.sets,
  });

  const totalVolume = args.sets.reduce(
    (sum: number, s: any) => sum + s.weight * s.reps,
    0
  );
  const maxWeight = Math.max(...args.sets.map((s: any) => s.weight));

  return JSON.stringify({
    success: true,
    exerciseName: args.exerciseName,
    sets: args.sets.length,
    totalVolume,
    maxWeight,
    sessionDate: args.date,
    sessionType: args.type,
  });
}

async function handleGetHistory(ctx: any, args: any): Promise<string> {
  const sessions = await ctx.runQuery(api.workoutSessions.listAll);
  let filtered = sessions;
  if (args.type) {
    filtered = sessions.filter(
      (s: any) => s.type.toLowerCase() === args.type.toLowerCase()
    );
  }
  const limit = args.limit || 10;
  const limited = filtered.slice(0, limit);

  return JSON.stringify(
    limited.map((s: any) => ({
      date: s.date,
      label: s.label,
      type: s.type,
      exercises: s.exercises.map((e: any) => ({
        name: e.name,
        sets: e.sets,
        totalVolume: e.sets.reduce(
          (sum: number, set: any) => sum + set.weight * set.reps,
          0
        ),
        maxWeight: Math.max(...e.sets.map((set: any) => set.weight)),
      })),
    }))
  );
}

async function handleGetStats(ctx: any, args: any): Promise<string> {
  const sessions = await ctx.runQuery(api.workoutSessions.listAll);
  const searchName = args.exerciseName.toLowerCase();

  const matches: any[] = [];
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      if (exercise.name.toLowerCase().includes(searchName)) {
        const maxWeight = Math.max(
          ...exercise.sets.map((s: any) => s.weight)
        );
        const maxReps = Math.max(
          ...exercise.sets
            .filter((s: any) => s.weight === maxWeight)
            .map((s: any) => s.reps)
        );
        const totalVolume = exercise.sets.reduce(
          (sum: number, s: any) => sum + s.weight * s.reps,
          0
        );
        // Estimated 1RM (Brzycki formula)
        const est1RM =
          maxReps === 1
            ? maxWeight
            : Math.round(maxWeight * (36 / (37 - maxReps)));

        matches.push({
          date: session.date,
          label: session.label,
          exerciseName: exercise.name,
          sets: exercise.sets.length,
          maxWeight,
          maxReps,
          totalVolume,
          est1RM,
        });
      }
    }
  }

  if (matches.length === 0) {
    return JSON.stringify({
      found: false,
      message: `No records found for "${args.exerciseName}"`,
    });
  }

  const allTimeMax = Math.max(...matches.map((m) => m.maxWeight));
  const allTimeEst1RM = Math.max(...matches.map((m) => m.est1RM));

  return JSON.stringify({
    found: true,
    exerciseName: args.exerciseName,
    sessions: matches,
    allTimeMax,
    allTimeEst1RM,
    totalSessions: matches.length,
  });
}

async function handleCreateType(ctx: any, args: any): Promise<string> {
  await ctx.runMutation(api.workoutTypes.create, { name: args.name });
  return JSON.stringify({ success: true, name: args.name });
}
