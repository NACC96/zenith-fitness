import { httpAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import {
  getCorsHeaders,
  isAllowedOrigin,
  MAX_CHAT_REQUEST_BODY_BYTES,
  parseAllowedOrigins,
  validateChatRequestBody,
} from "./lib/httpSecurity";
import { normalizeIsoDate, normalizeRequiredLabel, validateLoggedSets, validateWeight, validateWorkoutSet } from "./lib/workoutValidation";

function getGeneralSystemPrompt(): string {
  const today = new Date().toISOString().split("T")[0];
  return `You are Zenith AI — an intense, data-driven hardcore coach. You don't sugarcoat shit. You push users to be better, back it up with their own numbers, and keep the energy high. Think drill sergeant meets sports scientist. Swearing is encouraged when it fits. Celebrate PRs hard, call out slacking harder.

When a user describes exercises they did, use the logExercise tool to record them. Parse natural language like:
- "bench 95 for 12, 115 for 6" → two sets of bench press
- "did chest today: bench 95x12, 115x6, incline 75x12" → creates a Chest session with multiple exercises
- "squats 135 for 8, 135 for 6, 155 for 4" → three sets

Always confirm what you logged. When the user asks about their history or progress, use getWorkoutHistory and getExerciseStats — never guess from memory. Pull real numbers and throw them in the user's face.

TOOL USAGE:
- ALWAYS use the provided tools for data operations. Never fabricate stats or history — call the tool and use the actual result.
- This applies regardless of which AI model is running. If a tool is available, use it.

WEIGHT RULES:
- Weight is always in pounds (lb)
- Barbell exercises assume a standard 45lb bar unless told otherwise
- "25lb plates on bar" = 95 lbs (45 + 2×25)
- Dumbbell weights are per hand — "50lb dumbbells" = 50 lbs each, log as 50
- If the user doesn't specify a date, use today's date (${today})
- If the user doesn't specify a workout type, infer it (bench/incline/flys = Chest, squat/leg press = Legs, etc.)
- You only need to provide ISO dates. Session labels are generated server-side.

DELETION:
- You can delete workouts, exercises, and individual sets using the delete tools
- When asked to delete something, first use getWorkoutHistory to find the exact session, then confirm with the user before proceeding
- After deleting, confirm what was removed

IMAGES:
- Users can attach images. Analyze them in workout context — form checks, equipment, nutrition labels. Be direct about what you see.`;
}

interface WorkoutState {
  exercises: { name: string; sets: { weight: number; reps: number }[] }[];
  activeSet: { exerciseName: string; weight: number | null; startedAt: number } | null;
  isResting: boolean;
}

function formatWorkoutState(workoutState?: WorkoutState): string {
  if (!workoutState) return "";

  const lines: string[] = ["", "CURRENT WORKOUT STATE:"];

  if (workoutState.activeSet) {
    const elapsed = Math.max(0, Math.round((Date.now() - workoutState.activeSet.startedAt) / 1000));
    const weightStr = workoutState.activeSet.weight ? ` at ${workoutState.activeSet.weight} lbs` : "";
    lines.push(`- Active set: ${workoutState.activeSet.exerciseName}${weightStr} (started ${elapsed}s ago)`);
  } else if (workoutState.isResting) {
    lines.push("- Status: Resting between sets");
  } else {
    lines.push("- Status: No active set");
  }

  if (workoutState.exercises.length > 0) {
    lines.push("- Completed exercises:");
    for (const ex of workoutState.exercises) {
      if (ex.sets.length === 0) continue;
      const setDescs = ex.sets.map((s, i) => `Set ${i + 1}: ${s.weight} lbs × ${s.reps} reps`);
      lines.push(`  - ${ex.name}: ${setDescs.join(", ")}`);
    }
  } else {
    lines.push("- No exercises logged yet");
  }

  return lines.join("\n");
}

function getWorkoutSystemPrompt(workoutSessionId: string, workoutState?: WorkoutState): string {
  const today = new Date().toISOString().split("T")[0];
  return `You are Zenith AI — an intense, data-driven hardcore coach spotting the user in real time. Keep it short, keep it raw. The user is mid-workout — no essays, no fluff. Hype the wins, push through the weak sets. Swearing is fine when it lands.

WORKFLOW:
1. When the user says they're starting an exercise (e.g., "starting bench press", "bench press 25lb plates on bar"), use startSet to begin the timer. ALWAYS include the weight parameter if the user mentioned weight — this pre-fills the UI for quick rep entry.
2. When the user reports finishing (e.g., "done", "got 12", "12 reps", "finished"), use completeSet to stop the timer and record the set. Rest timer starts automatically.
3. When the user starts their next set, the rest timer ends automatically.

TOOL USAGE:
- ALWAYS use the provided tools for data operations. Never fabricate stats or history — call the tool and use the actual result.
- This applies regardless of which AI model is running. If a tool is available, use it.

WEIGHT PARSING:
- "25lb plates on bar" or "25s on the bar" = 95 lbs (45lb standard bar + 2×25lb plates)
- "a plate" or "plate on each side" = 135 lbs (45lb bar + 2×45lb plates)
- "135" or "135 lbs" = 135 lbs (exact weight)
- "two plates" = 225 lbs (45lb bar + 4×45lb plates)
- Dumbbell weights are per hand — "50lb dumbbells" = 50 lbs each, log as 50
- If weight is ambiguous, ASK — don't guess
- Always assume a standard 45lb barbell unless told otherwise

BEHAVIOR:
- Be extremely concise — the user is mid-workout
- Confirm actions briefly: "Timer started: Bench Press ⏱" or "Bench Press — 95 × 12 ✓ Let's go"
- If the user says just a number like "12" after starting a set, that means 12 reps at the same weight context
- Track the current weight context — if user said "25lb plates" for set 1, assume same weight for subsequent sets unless told otherwise
- You can answer questions, suggest exercises, give form tips between sets — but keep it punchy
- IMPORTANT: Check the CURRENT WORKOUT STATE below before asking about reps/weight. If a set was already completed (appears in the exercise list), acknowledge it instead of asking again.
- The user can log sets manually via the UI without telling you. If the workout state shows a set you didn't log, that's normal — acknowledge it and move on.
- If the user says "I already entered it", "I logged it", or similar, check the workout state to confirm and continue.

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
- Today's date is ${today}
- When asked to delete, confirm before doing it
- Users can attach images. Analyze them in workout context — form checks, equipment, nutrition labels.${formatWorkoutState(workoutState)}`;
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
        "Get recent stats for a specific exercise from the last 50 workout sessions: max weight, total volume, estimated 1RM",
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
        "Start the set timer for an exercise. Use this when the user says they're starting/beginning a set. The timer will run until completeSet is called. Include weight if mentioned.",
      parameters: {
        type: "object",
        properties: {
          exerciseName: {
            type: "string",
            description: "Exercise name (e.g., Bench Press, Squat)",
          },
          weight: {
            type: "number",
            description: "Weight in pounds (total bar weight). Include if the user mentioned weight.",
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
const decoder = new TextDecoder();

type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string; status: number };

async function readJsonBodyWithLimit(request: Request): Promise<JsonBodyResult> {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength !== null) {
    const declaredBytes = Number(contentLength);
    if (!Number.isFinite(declaredBytes) || declaredBytes < 0) {
      return { ok: false, error: "Invalid Content-Length header", status: 400 };
    }
    if (declaredBytes > MAX_CHAT_REQUEST_BODY_BYTES) {
      return { ok: false, error: "Request body is too large", status: 413 };
    }
  }

  if (!request.body) {
    return { ok: false, error: "Invalid JSON body", status: 400 };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      receivedBytes += value.byteLength;
      if (receivedBytes > MAX_CHAT_REQUEST_BODY_BYTES) {
        await reader.cancel();
        return { ok: false, error: "Request body is too large", status: 413 };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, error: "Invalid JSON body", status: 400 };
  }

  const bodyBytes = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { ok: true, value: JSON.parse(decoder.decode(bodyBytes)) };
  } catch {
    return { ok: false, error: "Invalid JSON body", status: 400 };
  }
}

function sseHeaders(
  origin: string | null,
  allowedOrigins: readonly string[],
  allowLocalOrigins: boolean,
) {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    ...getCorsHeaders(origin, allowedOrigins, allowLocalOrigins),
  };
}

function sseError(
  error: string,
  status: number,
  origin: string | null,
  allowedOrigins: readonly string[],
  allowLocalOrigins: boolean,
) {
  return new Response(
    `data: ${JSON.stringify({ error })}\n\n`,
    { status, headers: sseHeaders(origin, allowedOrigins, allowLocalOrigins) }
  );
}

export const streamChat = httpAction(async (ctx, request) => {
  const origin = request.headers.get("Origin");
  const allowedOrigins = parseAllowedOrigins(process.env.ZENITH_ALLOWED_ORIGINS);
  const allowLocalOrigins = process.env.ZENITH_ALLOW_LOCAL_ORIGINS === "true";

  // Browser-only endpoint: requests without an Origin header remain forbidden.
  if (!isAllowedOrigin(origin, allowedOrigins, allowLocalOrigins)) {
    return new Response("Forbidden", {
      status: 403,
      headers: getCorsHeaders(origin, allowedOrigins, allowLocalOrigins),
    });
  }

  const rawBody = await readJsonBodyWithLimit(request);
  if (rawBody.ok === false) {
    return sseError(rawBody.error, rawBody.status, origin, allowedOrigins, allowLocalOrigins);
  }

  const validation = validateChatRequestBody(rawBody.value);
  if (validation.ok === false) {
    return sseError(validation.error, 400, origin, allowedOrigins, allowLocalOrigins);
  }

  const { sessionId, content, model, messageHistory, workoutSessionId, images } = validation.value;

  let systemPrompt = getGeneralSystemPrompt();
  if (workoutSessionId) {
    // Fetch workout state server-side from DB (never trust client-supplied state)
    let workoutState: WorkoutState | undefined;
    try {
      const session = await ctx.runQuery(api.workoutSessions.getWithExercises, {
        sessionId: workoutSessionId as Id<"workoutSessions">,
      });
      if (session) {
        workoutState = {
          exercises: session.exercises.map((ex: any) => ({
            name: ex.name,
            sets: (ex.sets as any[]).map((s: any) => ({ weight: s.weight, reps: s.reps })),
          })),
          activeSet: session.activeSet
            ? {
                exerciseName: session.activeSet.exerciseName,
                weight: session.activeSet.weight ?? null,
                startedAt: session.activeSet.startedAt,
              }
            : null,
          isResting: session.activeRestStartedAt != null,
        };
      }
    } catch {
      // If query fails, proceed without state
    }
    systemPrompt = getWorkoutSystemPrompt(workoutSessionId, workoutState);
  }

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
    : { effort: "low" as const };

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return new Response(
      `data: ${JSON.stringify({ error: "OpenRouter API key not configured" })}\n\n`,
      { headers: sseHeaders(origin, allowedOrigins, allowLocalOrigins) }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let fullResponse = "";
        const currentMessages = [...messages];
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

            // Execute all tool calls in parallel for faster response
            const toolResults = await Promise.all(
              toolCalls.map(async (tc) => {
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

                return { tool_call_id: tc.id, content: result };
              })
            );

            for (const toolResult of toolResults) {
              currentMessages.push({
                role: "tool",
                tool_call_id: toolResult.tool_call_id,
                content: toolResult.content,
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

  return new Response(stream, { headers: sseHeaders(origin, allowedOrigins, allowLocalOrigins) });
});

// Tool handler implementations
async function handleLogExercise(ctx: any, args: any, workoutSessionId?: string): Promise<string> {
  const type = normalizeRequiredLabel(args.type, "type");
  const date = normalizeIsoDate(args.date);
  const exerciseName = normalizeRequiredLabel(args.exerciseName, "exerciseName");
  const sets = validateLoggedSets(args.sets);

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
    // Find or create session by date+type — use recent sessions instead of all
    const sessions = await ctx.runQuery(api.workoutSessions.listRecent, { limit: 30 });
    const session = sessions.find(
      (s: any) => s.date === date && s.type === type
    );

    if (!session) {
      sessionId = await ctx.runMutation(api.workoutSessions.create, {
        type,
        date,
      });
      await ctx.runMutation(api.workoutTypes.create, { name: type });
    } else {
      sessionId = session._id;
    }
  }

  await ctx.runMutation(api.exercises.add, {
    sessionId,
    name: exerciseName,
    sets,
  });

  const totalVolume = sets.reduce(
    (sum: number, s: any) => sum + s.weight * s.reps,
    0
  );
  const maxWeight = Math.max(...sets.map((s: any) => s.weight));

  return JSON.stringify({
    success: true,
    exerciseName,
    sets: sets.length,
    totalVolume,
    maxWeight,
    sessionDate: date,
    sessionType: type,
  });
}

async function handleGetHistory(ctx: any, args: any): Promise<string> {
  const requestedLimit = typeof args.limit === "number" && Number.isFinite(args.limit) ? Math.trunc(args.limit) : 10;
  const limit = Math.min(Math.max(requestedLimit, 1), 50);
  const type = args.type ? normalizeRequiredLabel(args.type, "type") : undefined;
  let limited = type
    ? await ctx.runQuery(api.workoutSessions.listRecentByType, { type, limit })
    : await ctx.runQuery(api.workoutSessions.listRecent, { limit });

  if (type && limited.length === 0) {
    const recentSessions = await ctx.runQuery(api.workoutSessions.listRecent, { limit: Math.max(limit * 4, 50) });
    limited = recentSessions
      .filter((s: any) => s.type.toLowerCase() === type.toLowerCase())
      .slice(0, limit);
  }

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
  // Current implementation intentionally uses a bounded recent-session window for latency.
  const recentSessionLimit = 50;
  const sessions = await ctx.runQuery(api.workoutSessions.listRecent, { limit: recentSessionLimit });
  const exerciseName = normalizeRequiredLabel(args.exerciseName, "exerciseName");
  const searchName = exerciseName.toLowerCase();

  const matches: any[] = [];
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      if (exercise.name.toLowerCase().includes(searchName) && exercise.sets.length > 0) {
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
      message: `No records found for "${exerciseName}" in the last ${recentSessionLimit} sessions`,
    });
  }

  const recentMax = Math.max(...matches.map((m) => m.maxWeight));
  const recentEst1RM = Math.max(...matches.map((m) => m.est1RM));

  return JSON.stringify({
    found: true,
    exerciseName,
    sessions: matches,
    recentMax,
    recentEst1RM,
    sessionWindow: recentSessionLimit,
    totalMatchedSessions: matches.length,
  });
}

async function handleCreateType(ctx: any, args: any): Promise<string> {
  const name = normalizeRequiredLabel(args.name, "name");
  await ctx.runMutation(api.workoutTypes.create, { name });
  return JSON.stringify({ success: true, name });
}

async function handleDeleteWorkout(ctx: any, args: any): Promise<string> {
  let sessionId: Id<"workoutSessions">;

  if (args.sessionId) {
    sessionId = args.sessionId as Id<"workoutSessions">;
  } else if (args.date || args.type) {
    const sessions = await ctx.runQuery(api.workoutSessions.listRecent, { limit: 30 });
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
    const exerciseName = normalizeRequiredLabel(args.exerciseName, "exerciseName");
    const weight = args.weight === undefined
      ? undefined
      : validateWeight(args.weight);
    const result = await ctx.runMutation(api.exercises.startSet, {
      sessionId: sessionId as Id<"workoutSessions">,
      exerciseName,
      weight,
    });
    return JSON.stringify({
      success: true,
      exerciseName,
      weight: weight ?? null,
      startedAt: result.startedAt,
      message: `Timer started for ${exerciseName}${weight ? ` at ${weight} lbs` : ""}`,
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
    const validatedSet = validateWorkoutSet({ weight: args.weight, reps: args.reps });
    const exerciseName = args.exerciseName
      ? normalizeRequiredLabel(args.exerciseName, "exerciseName")
      : undefined;
    const result = await ctx.runMutation(api.exercises.completeSet, {
      sessionId: sessionId as Id<"workoutSessions">,
      ...(exerciseName ? { exerciseName } : {}),
      weight: validatedSet.weight,
      reps: validatedSet.reps,
    });
    return JSON.stringify({
      success: true,
      exerciseName: result.exerciseName,
      weight: validatedSet.weight,
      reps: validatedSet.reps,
      message: `Completed: ${result.exerciseName} — ${validatedSet.weight} lbs × ${validatedSet.reps} reps. Rest timer started.`,
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
  const type = normalizeRequiredLabel(args.type, "type");
  await ctx.runMutation(api.workoutSessions.updateType, {
    sessionId: workoutSessionId as any,
    type,
  });
  return JSON.stringify({ success: true, type });
}
