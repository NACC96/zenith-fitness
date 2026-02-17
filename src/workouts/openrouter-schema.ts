import type {
  ParseIssue,
  ParseIssueCode,
  WorkoutIngestionRequest,
  WorkoutParseOutput,
} from "./ingestion-contract";
import { validateParseOutput } from "./validation";

export const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_OPENROUTER_MODEL = "openai/gpt-4o-mini";
export const WORKOUT_PARSE_SCHEMA_NAME = "workout_parse_output_v1";

export const WORKOUT_PARSE_SYSTEM_PROMPT = [
  "You convert free-form workout logs into strict JSON for an analytics pipeline.",
  "Return only JSON that matches the provided schema.",
  "If workout details are missing or ambiguous, include parse errors and warnings rather than inventing values.",
  "Use lbs for weight values, integers for reps/set counts, and ISO timestamps for datetime fields.",
].join(" ");

export const WORKOUT_PARSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["session", "overallConfidence", "fieldConfidence", "errors", "warnings"],
  properties: {
    session: {
      oneOf: [
        {
          type: "null",
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["session", "exercisePerformances", "metrics"],
          properties: {
            session: {
              type: "object",
              additionalProperties: false,
              required: ["id", "rawLogId", "workoutTypeId", "occurredAt", "parseVersion"],
              properties: {
                id: { type: "string", minLength: 1 },
                rawLogId: { type: "string", minLength: 1 },
                workoutTypeId: { type: "string", minLength: 1 },
                occurredAt: { type: "string", minLength: 1 },
                timezone: { type: ["string", "null"] },
                parseVersion: { type: "integer", minimum: 1 },
                notes: { type: ["string", "null"] },
              },
            },
            exercisePerformances: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                additionalProperties: false,
                required: [
                  "id",
                  "exerciseKey",
                  "exerciseName",
                  "exerciseOrder",
                  "setEntries",
                  "totalSets",
                  "totalReps",
                  "totalVolumeLbs",
                ],
                properties: {
                  id: { type: "string", minLength: 1 },
                  exerciseKey: { type: "string", minLength: 1 },
                  exerciseName: { type: "string", minLength: 1 },
                  exerciseOrder: { type: "integer", minimum: 0 },
                  setEntries: {
                    type: "array",
                    minItems: 1,
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: ["id", "setIndex", "reps", "weightLbs"],
                      properties: {
                        id: { type: "string", minLength: 1 },
                        setIndex: { type: "integer", minimum: 1 },
                        reps: { type: "integer", minimum: 1 },
                        weightLbs: { type: "number", minimum: 0 },
                        isWarmup: { type: "boolean" },
                        rpe: { type: ["number", "null"], minimum: 0, maximum: 10 },
                        notes: { type: ["string", "null"] },
                      },
                    },
                  },
                  totalSets: { type: "integer", minimum: 1 },
                  totalReps: { type: "integer", minimum: 1 },
                  totalVolumeLbs: { type: "number", minimum: 0 },
                  previousSessionVolumeDeltaLbs: { type: ["number", "null"] },
                },
              },
            },
            metrics: {
              type: "object",
              additionalProperties: false,
              required: [
                "totalLbsLifted",
                "totalSets",
                "totalReps",
                "perExerciseProgression",
              ],
              properties: {
                totalLbsLifted: { type: "number", minimum: 0 },
                totalSets: { type: "integer", minimum: 1 },
                totalReps: { type: "integer", minimum: 1 },
                previousSessionTotalLbsDelta: { type: ["number", "null"] },
                perExerciseProgression: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["exerciseKey", "volumeDeltaLbs", "repDelta"],
                    properties: {
                      exerciseKey: { type: "string", minLength: 1 },
                      volumeDeltaLbs: { type: "number" },
                      repDelta: { type: "number" },
                    },
                  },
                },
              },
            },
          },
        },
      ],
    },
    overallConfidence: { type: "number", minimum: 0, maximum: 1 },
    fieldConfidence: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["fieldPath", "confidence"],
        properties: {
          fieldPath: { type: "string", minLength: 1 },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
    },
    errors: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["code", "message"],
        properties: {
          code: {
            type: "string",
            enum: [
              "MISSING_FIELD",
              "INVALID_VALUE",
              "AMBIGUOUS_VALUE",
              "UNMAPPED_EXERCISE",
              "INTERNAL_ERROR",
            ],
          },
          message: { type: "string", minLength: 1 },
          fieldPath: { type: "string" },
        },
      },
    },
    warnings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["code", "message"],
        properties: {
          code: {
            type: "string",
            enum: [
              "MISSING_FIELD",
              "INVALID_VALUE",
              "AMBIGUOUS_VALUE",
              "UNMAPPED_EXERCISE",
              "INTERNAL_ERROR",
            ],
          },
          message: { type: "string", minLength: 1 },
          fieldPath: { type: "string" },
        },
      },
    },
  },
} as const;

const trimOrUndefined = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeIssue = (issue: unknown, fallbackCode: ParseIssueCode): ParseIssue => {
  const value = (issue ?? {}) as Record<string, unknown>;

  return {
    code: (value.code as ParseIssueCode | undefined) ?? fallbackCode,
    message: trimOrUndefined(value.message) ?? "Unspecified parse issue.",
    fieldPath: trimOrUndefined(value.fieldPath),
  };
};

export const buildParseFailureOutput = (
  message: string,
  code: ParseIssueCode = "INTERNAL_ERROR",
  fieldPath?: string
): WorkoutParseOutput => ({
  overallConfidence: 0,
  fieldConfidence: [],
  errors: [
    {
      code,
      message,
      ...(fieldPath ? { fieldPath } : {}),
    },
  ],
  warnings: [],
});

export const buildOpenRouterUserPrompt = (
  request: WorkoutIngestionRequest
): string => {
  const hints = [
    `submittedAt=${request.submittedAt}`,
    `ingestionMode=${request.ingestionMode}`,
    `workoutTypeHintSlug=${request.workoutTypeHintSlug ?? "none"}`,
    `occurredAtHint=${request.occurredAtHint ?? "none"}`,
    `timezone=${request.timezone ?? "none"}`,
  ];

  return [
    "Parse this workout log to the structured schema.",
    "Return an explicit parse error if it cannot be parsed safely.",
    `Hints: ${hints.join("; ")}`,
    "Workout log:",
    request.rawText,
  ].join("\n");
};

export const extractOpenRouterMessageContent = (payload: unknown): string | undefined => {
  const root = payload as {
    choices?: Array<{
      message?: { content?: unknown };
    }>;
  };

  const firstChoiceContent = root.choices?.[0]?.message?.content;
  if (typeof firstChoiceContent === "string") {
    return firstChoiceContent;
  }

  if (Array.isArray(firstChoiceContent)) {
    const textParts = firstChoiceContent
      .map((entry) => {
        const item = entry as { type?: unknown; text?: unknown };
        return item.type === "text" && typeof item.text === "string" ? item.text : undefined;
      })
      .filter((entry): entry is string => typeof entry === "string");

    if (textParts.length > 0) {
      return textParts.join("\n");
    }
  }

  return undefined;
};

export const normalizeParseOutput = (rawValue: unknown): WorkoutParseOutput => {
  const value = (rawValue ?? {}) as Record<string, unknown>;
  const session = (value.session as WorkoutParseOutput["session"] | null | undefined) ?? undefined;

  return {
    session: session ?? undefined,
    overallConfidence:
      typeof value.overallConfidence === "number" ? value.overallConfidence : 0,
    fieldConfidence: Array.isArray(value.fieldConfidence)
      ? value.fieldConfidence
          .map((item) => {
            const entry = item as Record<string, unknown>;
            return {
              fieldPath: trimOrUndefined(entry.fieldPath) ?? "unknown",
              confidence:
                typeof entry.confidence === "number" ? entry.confidence : 0,
            };
          })
          .filter((entry) => entry.fieldPath.length > 0)
      : [],
    errors: Array.isArray(value.errors)
      ? value.errors.map((item) => normalizeIssue(item, "INTERNAL_ERROR"))
      : [],
    warnings: Array.isArray(value.warnings)
      ? value.warnings.map((item) => normalizeIssue(item, "AMBIGUOUS_VALUE"))
      : [],
  };
};

export const parseAndValidateOpenRouterOutput = (
  rawContent: string
): WorkoutParseOutput => {
  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(rawContent);
  } catch {
    return buildParseFailureOutput(
      "OpenRouter returned non-JSON content for workout parsing.",
      "INTERNAL_ERROR"
    );
  }

  const normalized = normalizeParseOutput(parsedValue);
  const validationErrors = validateParseOutput(normalized);
  if (validationErrors.length > 0) {
    return {
      ...buildParseFailureOutput(
        "OpenRouter returned JSON that failed schema-level validation.",
        "INVALID_VALUE"
      ),
      warnings: validationErrors.map((error) => ({
        code: "INVALID_VALUE",
        message: error.message,
        fieldPath: error.field,
      })),
    };
  }

  return normalized;
};
