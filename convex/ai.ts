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
- You only need to provide ISO dates. Session labels are generated server-side.
- You can delete workouts, exercises, and individual sets using the delete tools
- When asked to delete something, first use getWorkoutHistory to find the exact session, then confirm with the user what you're about to delete before proceeding
- After deleting, confirm what was removed
- Users can attach images to their messages. When you receive an image, analyze it and respond helpfully. For gym-related images (form check photos, equipment, nutrition labels), provide relevant fitness advice.`;

function getWorkoutSystemPrompt(workoutSessionId: string): string {
  return `You are Zenith AI, a live workout assistant. The user is actively working out right now.

WORKFLOW:
1. When the user says they're starting an exercise (e.g., "starting bench press", "bench press 25lb plates on bar"), use startSet to begin the timer
2. When the user reports finishing (e.g., "done", "got 12", "12 reps", "finished"), use completeSet to stop the timer and record the set. Rest timer starts automatically.
3. When the user starts their next set, the rest timer ends automatically

WEIGHT PARSING:
- "25lb plates on bar" or "25s on the bar" = 95 lbs (45lb standard bar + 2×25lb plates)
- "a plate" or "plate on each side" = 135 lbs (45lb bar + 2×45lb plates)
- "135" or "135 lbs" = 135 lbs (exact weight)
- "two plates" = 225 lbs (45lb bar + 4×45lb plates)
- If weight is ambiguous, ASK the user to clarify
- Always assume a standard 45lb barbell unless told otherwise

BEHAVIOR:
- Be extremely concise — the user is mid-workout
- Confirm actions briefly: "Timer started: Bench Press ⏱" or "Got it: Bench Press — 95 lbs × 12 reps ✓"
- If the user says just a number like "12" after starting a set, that means 12 reps at the same weight context
- Track the current weight context — if user said "25lb plates" for set 1, assume same weight for subsequent sets unless told otherwise
- You can also answer questions, suggest exercises, give form tips between sets

WORKOUT TYPE:
- After the user's FIRST exercise, automatically call setWorkoutType to categorize the workout
- Infer the type from the exercise: bench press/flyes/dips → "Chest", squats/leg press/lunges → "Legs", deadlifts/rows/pullups → "Back", overhead press/lateral raises → "Shoulders", curls/tricep extensions → "Arms", etc.
- For mixed exercises, use broader categories: "Push" (chest+shoulders+triceps), "Pull" (back+biceps), "Upper Body", "Lower Body", "Full Body"
- Only call setWorkoutType once — on the first exercise. Don't change it mid-workout unless the user explicitly asks.

ACTIVE SESSION: ${workoutSessionId}. ALL exercises go to this session.

TOOLS:
- startSet: Start the set timer (use when user begins a set)
- completeSet: Stop timer, record weight + reps (use when user finishes a set)
- setWorkoutType: Set the workout type/category for the session (call after first exercise)
- logExercise: Log completed sets without timing (use for retroactive logging, e.g. "I did 3x10 bench earlier")
- getWorkoutHistory: Check past workouts
- getExerciseStats: Get stats for a specific exercise
- createWorkoutType: Create a new workout type
- deleteWorkout / deleteExercise / deleteSet: Delete data

Key rules:
- Weight is always in pounds (lb)
- Today's date is ${new Date().toISOString().split("T")[0]}
- When asked to delete, confirm before doing it
- Users can attach images. Analyze them in workout context.`;
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
  {
    type: "function" as const,
    function: {
      name: "deleteWorkout",
      description:
        "Delete an entire workout session and all its exercises. Use sessionId if available, otherwise find by date and type.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "ISO date YYYY-MM-DD" },
          type: {
            type: "string",
            description: "Workout type (e.g., Chest, Back, Legs)",
          },
          sessionId: {
            type: "string",
            description: "Workout session ID (if known)",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "deleteExercise",
      description:
        "Delete a specific exercise (all sets) from a workout session",
      parameters: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "Workout session ID",
          },
          exerciseName: {
            type: "string",
            description: "Name of the exercise to delete",
          },
        },
        required: ["sessionId", "exerciseName"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "deleteSet",
      description:
        "Delete a specific set from an exercise. Use setIndex -1 to delete the last set.",
      parameters: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "Workout session ID",
          },
          exerciseName: {
            type: "string",
            description: "Name of the exercise",
          },
          setIndex: {
            type: "number",
            description: "0-based set index, or -1 for the last set",
          },
        },
        required: ["sessionId", "exerciseName", "setIndex"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "setWorkoutType",
      description:
        "Set the workout type/category for the current session (e.g., Chest, Back, Legs, Push, Pull, Upper, Lower, Full Body, Arms, Shoulders, Cardio). Call this automatically after the first exercise to categorize the workout.",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description:
              "The workout type (e.g., Chest, Back, Legs, Shoulders, Arms, Push, Pull, Upper Body, Lower Body, Full Body, Cardio)",
          },
        },
        required: ["type"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "startSet",
      description:
        "Start the set timer for an exercise. Use this when the user says they're starting/beginning a set. The timer will run until completeSet is called.",
      parameters: {
        type: "object",
        properties: {
          exerciseName: {
            type: "string",
            description: "Exercise name (e.g., Bench Press, Squat)",
          },
        },
        required: ["exerciseName"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "completeSet",
      description:
        "Complete the current set, stop the timer, and record weight + reps. Rest timer starts automatically. Use this when the user reports finishing their set.",
      parameters: {
        type: "object",
        properties: {
          exerciseName: {
            type: "string",
            description:
              "Exercise name (optional if a set is currently active — will use the active set's exercise)",
          },
          weight: {
            type: "number",
            description:
              "Weight in pounds (total bar weight including the bar itself, e.g. 45lb bar + 2x25lb plates = 95)",
          },
          reps: {
            type: "number",
            description: "Number of reps completed",
          },
        },
        required: ["weight", "reps"],
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
  const { sessionId, content, model, messageHistory, workoutSessionId, images } = await request.json();

  const systemPrompt = workoutSessionId
    ? getWorkoutSystemPrompt(workoutSessionId)
    : SYSTEM_PROMPT;

  // Format current user message — multimodal if images attached
  const userMessage = images && images.length > 0
    ? {
        role: "user",
        content: [
          { type: "text", text: content },
          ...images.map((img: string) => ({
            type: "image_url",
            image_url: { url: img },
          })),
        ],
      }
    : { role: "user", content };

  // Format historical messages — multimodal if they had images
  const formattedHistory = (messageHistory || []).map((m: any) => {
    if (m.images && m.images.length > 0 && m.role === "user") {
      return {
        role: m.role,
        content: [
          { type: "text", text: m.content },
          ...m.images.map((img: string) => ({
            type: "image_url",
            image_url: { url: img },
          })),
        ],
      };
    }
    return { role: m.role, content: m.content };
  });

  const messages: any[] = [
    { role: "system", content: systemPrompt },
    ...formattedHistory,
    userMessage,
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
                } else if (toolName === "deleteWorkout") {
                  result = await handleDeleteWorkout(ctx, toolArgs);
                } else if (toolName === "deleteExercise") {
                  result = await handleDeleteExercise(ctx, toolArgs);
                } else if (toolName === "deleteSet") {
                  result = await handleDeleteSet(ctx, toolArgs);
                } else if (toolName === "startSet") {
                  result = await handleStartSet(ctx, toolArgs, workoutSessionId);
                } else if (toolName === "completeSet") {
                  result = await handleCompleteSet(ctx, toolArgs, workoutSessionId);
                } else if (toolName === "setWorkoutType") {
                  result = await handleSetWorkoutType(ctx, toolArgs, workoutSessionId);
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

async function handleDeleteWorkout(ctx: any, args: any): Promise<string> {
  let sessionId: Id<"workoutSessions">;

  if (args.sessionId) {
    sessionId = args.sessionId as Id<"workoutSessions">;
  } else if (args.date || args.type) {
    const sessions = await ctx.runQuery(api.workoutSessions.listAll);
    const match = sessions.find(
      (s: any) =>
        (!args.date || s.date === args.date) &&
        (!args.type || s.type.toLowerCase() === args.type.toLowerCase())
    );
    if (!match) {
      return JSON.stringify({
        error: `No workout session found for date=${args.date}, type=${args.type}`,
      });
    }
    sessionId = match._id;
  } else {
    return JSON.stringify({
      error: "Provide sessionId, or date and/or type to identify the workout",
    });
  }

  const session = await ctx.runQuery(api.workoutSessions.getWithExercises, {
    sessionId,
  });
  await ctx.runMutation(api.workoutSessions.remove, { sessionId });

  return JSON.stringify({
    success: true,
    deleted: {
      date: session?.date,
      type: session?.type,
      exerciseCount: session?.exercises?.length ?? 0,
    },
  });
}

async function handleDeleteExercise(ctx: any, args: any): Promise<string> {
  const sessionId = args.sessionId as Id<"workoutSessions">;
  const session = await ctx.runQuery(api.workoutSessions.getWithExercises, {
    sessionId,
  });
  if (!session) {
    return JSON.stringify({ error: "Workout session not found" });
  }

  const exercise = session.exercises.find(
    (e: any) => e.name.toLowerCase() === args.exerciseName.toLowerCase()
  );
  if (!exercise) {
    return JSON.stringify({
      error: `Exercise "${args.exerciseName}" not found in this session`,
      availableExercises: session.exercises.map((e: any) => e.name),
    });
  }

  await ctx.runMutation(api.exercises.remove, {
    exerciseId: exercise._id as Id<"exercises">,
  });

  return JSON.stringify({
    success: true,
    deleted: {
      exerciseName: exercise.name,
      setsRemoved: exercise.sets.length,
    },
  });
}

async function handleDeleteSet(ctx: any, args: any): Promise<string> {
  const sessionId = args.sessionId as Id<"workoutSessions">;
  const session = await ctx.runQuery(api.workoutSessions.getWithExercises, {
    sessionId,
  });
  if (!session) {
    return JSON.stringify({ error: "Workout session not found" });
  }

  const exercise = session.exercises.find(
    (e: any) => e.name.toLowerCase() === args.exerciseName.toLowerCase()
  );
  if (!exercise) {
    return JSON.stringify({
      error: `Exercise "${args.exerciseName}" not found in this session`,
      availableExercises: session.exercises.map((e: any) => e.name),
    });
  }

  let setIndex = args.setIndex;
  if (setIndex === -1) {
    setIndex = exercise.sets.length - 1;
  }

  const deletedSet = exercise.sets[setIndex];
  const result = await ctx.runMutation(api.exercises.removeSet, {
    exerciseId: exercise._id as Id<"exercises">,
    setIndex,
  });

  return JSON.stringify({
    success: true,
    deleted: {
      exerciseName: exercise.name,
      setIndex,
      set: deletedSet,
      exerciseAlsoDeleted: result.deleted === "exercise",
    },
  });
}

async function handleStartSet(ctx: any, args: any, workoutSessionId?: string): Promise<string> {
  const sessionId = workoutSessionId;
  if (!sessionId) {
    return JSON.stringify({ error: "No active workout session" });
  }

  try {
    const result = await ctx.runMutation(api.exercises.startSet, {
      sessionId: sessionId as Id<"workoutSessions">,
      exerciseName: args.exerciseName,
    });
    return JSON.stringify({
      success: true,
      exerciseName: args.exerciseName,
      startedAt: result.startedAt,
      message: `Timer started for ${args.exerciseName}`,
    });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    return JSON.stringify({ error: errorMessage });
  }
}

async function handleCompleteSet(ctx: any, args: any, workoutSessionId?: string): Promise<string> {
  const sessionId = workoutSessionId;
  if (!sessionId) {
    return JSON.stringify({ error: "No active workout session" });
  }

  try {
    const result = await ctx.runMutation(api.exercises.completeSet, {
      sessionId: sessionId as Id<"workoutSessions">,
      ...(args.exerciseName ? { exerciseName: args.exerciseName } : {}),
      weight: args.weight,
      reps: args.reps,
    });
    return JSON.stringify({
      success: true,
      exerciseName: result.exerciseName,
      weight: args.weight,
      reps: args.reps,
      message: `Completed: ${result.exerciseName} — ${args.weight} lbs × ${args.reps} reps. Rest timer started.`,
    });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    return JSON.stringify({ error: errorMessage });
  }
}

async function handleSetWorkoutType(ctx: any, args: any, workoutSessionId?: string): Promise<string> {
  if (!workoutSessionId) {
    return JSON.stringify({ error: "No active workout session" });
  }
  const { type } = args;
  if (!type) {
    return JSON.stringify({ error: "type is required" });
  }
  await ctx.runMutation(api.workoutSessions.updateType, {
    sessionId: workoutSessionId as any,
    type,
  });
  return JSON.stringify({ success: true, type });
}
