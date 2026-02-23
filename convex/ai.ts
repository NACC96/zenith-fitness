import { httpAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

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
- You only need to provide ISO dates. Session labels are generated server-side.`;

function getWorkoutSystemPrompt(workoutSessionId: string): string {
  return `You are Zenith AI, a live workout assistant. The user is actively working out at the gym right now.

BEHAVIOR:
- When the user logs a lift (e.g., "bench 135 for 10"), confirm it concisely: "Got it: Bench Press — 135 lbs × 10 reps ✓"
- You can answer questions about their workout history, suggest next exercises, give form tips
- Be encouraging but brief — they're between sets
- Always use the logExercise tool to record exercises — ALWAYS use the active workout session ID provided

ACTIVE SESSION: The current workout session ID is ${workoutSessionId}. ALL exercises should be logged to this session.

You have access to these tools:
- logExercise: Log an exercise set (ALWAYS use sessionId: "${workoutSessionId}")
- getWorkoutHistory: Check past workouts
- getExerciseStats: Get stats for a specific exercise
- createWorkoutType: Create a new workout type

Key rules:
- Weight is always in pounds (lb)
- Today's date is ${new Date().toISOString().split("T")[0]}
- Be concise — the user is mid-workout`;
}

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
          sessionId: {
            type: "string",
            description:
              "Workout session ID to log to (used in workout mode)",
          },
        },
        required: ["type", "date", "exerciseName", "sets"],
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

const encoder = new TextEncoder();

function sseHeaders() {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export const streamChat = httpAction(async (ctx, request) => {
  const { sessionId, content, model, messageHistory, workoutSessionId } = await request.json();

  const systemPrompt = workoutSessionId
    ? getWorkoutSystemPrompt(workoutSessionId)
    : SYSTEM_PROMPT;

  const messages: any[] = [
    { role: "system", content: systemPrompt },
    ...(messageHistory || []),
    { role: "user", content },
  ];

  const mandatoryReasoningModels = [
    "google/gemini-3.1-pro-preview",
    "minimax/minimax-m2.5",
  ];
  const reasoning = mandatoryReasoningModels.includes(model)
    ? undefined
    : { effort: "high" as const };

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return new Response(
      `data: ${JSON.stringify({ error: "OpenRouter API key not configured" })}\n\n`,
      { headers: sseHeaders() }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let fullResponse = "";
        let currentMessages = [...messages];
        const maxAttempts = 5;
        let attempt = 0;

        while (attempt < maxAttempts) {
          attempt++;

          const body: Record<string, unknown> = {
            model,
            messages: currentMessages,
            tools: TOOLS,
            tool_choice: "auto",
            stream: true,
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
            const errorText = await response.text();
            console.error("OpenRouter error:", errorText);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ error: `API error: ${response.status}` })}\n\n`
              )
            );
            controller.close();
            return;
          }

          const reader = response.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let streamedContent = "";
          const toolCalls: any[] = [];
          let hasToolCalls = false;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta;
                if (!delta) continue;

                if (delta.content) {
                  streamedContent += delta.content;
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ token: delta.content })}\n\n`
                    )
                  );
                }

                if (delta.tool_calls) {
                  hasToolCalls = true;
                  for (const tc of delta.tool_calls) {
                    const idx = tc.index;
                    if (!toolCalls[idx]) {
                      toolCalls[idx] = {
                        id: tc.id || "",
                        type: "function",
                        function: { name: tc.function?.name || "", arguments: "" },
                      };
                    }
                    if (tc.id) toolCalls[idx].id = tc.id;
                    if (tc.function?.name)
                      toolCalls[idx].function.name = tc.function.name;
                    if (tc.function?.arguments)
                      toolCalls[idx].function.arguments +=
                        tc.function.arguments;
                  }
                }
              } catch {
                // Skip unparseable lines
              }
            }
          }

          if (hasToolCalls && toolCalls.length > 0) {
            currentMessages.push({
              role: "assistant",
              content: streamedContent || null,
              tool_calls: toolCalls,
            });

            for (const tc of toolCalls) {
              const toolName = tc.function.name;
              let toolArgs;
              try {
                toolArgs = JSON.parse(tc.function.arguments);
              } catch {
                toolArgs = {};
              }

              let result: string;
              try {
                if (toolName === "logExercise") {
                  result = await handleLogExercise(ctx, toolArgs, workoutSessionId);
                } else if (toolName === "getWorkoutHistory") {
                  result = await handleGetHistory(ctx, toolArgs);
                } else if (toolName === "getExerciseStats") {
                  result = await handleGetStats(ctx, toolArgs);
                } else if (toolName === "createWorkoutType") {
                  result = await handleCreateType(ctx, toolArgs);
                } else {
                  result = JSON.stringify({ error: `Unknown tool: ${toolName}` });
                }
              } catch (e: unknown) {
                const errorMessage = e instanceof Error ? e.message : String(e);
                result = JSON.stringify({ error: errorMessage });
              }

              currentMessages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: result,
              });
            }

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ thinking: true })}\n\n`
              )
            );
            continue;
          }

          fullResponse = streamedContent;
          break;
        }

        // Save assistant message to DB
        await ctx.runMutation(internal.chatMessages.saveAssistantMessage, {
          sessionId: sessionId as Id<"chatSessions">,
          content: fullResponse || "I wasn't able to generate a response.",
          model,
        });

        // Auto-title: if session title is "New Chat", generate one from user message
        try {
          const session = await ctx.runQuery(api.chatSessions.get, {
            sessionId: sessionId as Id<"chatSessions">,
          });
          if (session && session.title === "New Chat") {
            const title =
              content.length > 40 ? content.slice(0, 40) + "..." : content;
            await ctx.runMutation(api.chatSessions.updateTitle, {
              sessionId: sessionId as Id<"chatSessions">,
              title,
            });
          }
        } catch {
          // Auto-titling is best-effort
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
        );
        controller.close();
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: errorMessage })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
});

// Tool handler implementations
async function handleLogExercise(ctx: any, args: any, workoutSessionId?: string): Promise<string> {
  // In workout mode, use the active session directly
  const targetSessionId = args.sessionId || workoutSessionId;

  let sessionId;
  if (targetSessionId) {
    // Verify the session exists
    const session = await ctx.runQuery(api.workoutSessions.getWithExercises, {
      sessionId: targetSessionId as Id<"workoutSessions">,
    });
    if (!session) {
      return JSON.stringify({ error: "Active workout session not found" });
    }
    sessionId = targetSessionId as Id<"workoutSessions">;
  } else {
    // Original behavior: find or create session by date+type
    const sessions = await ctx.runQuery(api.workoutSessions.listAll);
    const session = sessions.find(
      (s: any) => s.date === args.date && s.type === args.type
    );

    if (!session) {
      sessionId = await ctx.runMutation(api.workoutSessions.create, {
        type: args.type,
        date: args.date,
      });
      await ctx.runMutation(api.workoutTypes.create, { name: args.type });
    } else {
      sessionId = session._id;
    }
  }

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
