export const DEFAULT_ALLOWED_ORIGINS = ["https://zenith-fitness.vercel.app"] as const;

export const ALLOWED_MODELS = [
  "google/gemini-3.1-pro-preview",
  "google/gemini-3.1-pro-preview-customtools",
  "anthropic/claude-sonnet-4.6",
  "minimax/minimax-m2.5",
  "z-ai/glm-5",
  "z-ai/glm-5-turbo",
  "x-ai/grok-4.20-beta",
  "x-ai/grok-4.20-multi-agent-beta",
  "moonshotai/kimi-k2.5",
  "deepseek/deepseek-v3.2",
] as const;

export type AllowedModel = (typeof ALLOWED_MODELS)[number];

const MODEL_LABELS: Record<AllowedModel, string> = {
  "google/gemini-3.1-pro-preview": "Gemini 3.1 Pro",
  "google/gemini-3.1-pro-preview-customtools": "Gemini 3.1 Pro CT",
  "anthropic/claude-sonnet-4.6": "Claude Sonnet 4.6",
  "minimax/minimax-m2.5": "MiniMax M2.5",
  "z-ai/glm-5": "GLM-5",
  "z-ai/glm-5-turbo": "GLM-5 Turbo",
  "x-ai/grok-4.20-beta": "Grok 4.20",
  "x-ai/grok-4.20-multi-agent-beta": "Grok 4.20 MA",
  "moonshotai/kimi-k2.5": "Kimi K2.5",
  "deepseek/deepseek-v3.2": "DeepSeek V3.2",
};

export const CHAT_MODEL_OPTIONS = ALLOWED_MODELS.map((value) => ({
  value,
  label: MODEL_LABELS[value],
}));

export const WORKOUT_CHAT_MODEL_OPTIONS = [
  { id: "anthropic/claude-sonnet-4.6", label: "Sonnet" },
  { id: "x-ai/grok-4.20-beta", label: "Grok" },
  { id: "z-ai/glm-5-turbo", label: "GLM" },
] as const satisfies readonly { id: AllowedModel; label: string }[];

const MAX_CONTENT_LENGTH = 8_000;
const MAX_HISTORY_MESSAGES = 20;
const MAX_HISTORY_CONTENT_LENGTH = 12_000;
const MAX_IMAGES = 3;
const MAX_IMAGE_DATA_URL_LENGTH = 4_000_000;
const JSON_BODY_OVERHEAD_BYTES = 32_000;
export const MAX_CHAT_REQUEST_BODY_BYTES =
  MAX_CONTENT_LENGTH + MAX_HISTORY_CONTENT_LENGTH + MAX_IMAGES * MAX_IMAGE_DATA_URL_LENGTH + JSON_BODY_OVERHEAD_BYTES;

export type ChatRole = "user" | "assistant";

export type ValidatedHistoryMessage = {
  role: ChatRole;
  content: string;
  images?: string[];
};

export type ValidatedChatRequest = {
  sessionId: string;
  content: string;
  model: string;
  messageHistory: ValidatedHistoryMessage[];
  workoutSessionId?: string;
  images: string[];
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function parseAllowedOrigins(value?: string): string[] {
  const configured = (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configured.length > 0 ? configured : [...DEFAULT_ALLOWED_ORIGINS];
}

function isLocalDevelopmentOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

export function isAllowedOrigin(
  origin: string | null,
  allowedOrigins: readonly string[],
  allowLocalOrigins = false,
): boolean {
  if (!origin) return false;
  if (allowedOrigins.includes(origin)) return true;
  return allowLocalOrigins && isLocalDevelopmentOrigin(origin);
}

export function getCorsHeaders(
  origin: string | null,
  allowedOrigins: readonly string[],
  allowLocalOrigins = false,
) {
  const allowedOrigin = origin && isAllowedOrigin(origin, allowedOrigins, allowLocalOrigins) ? origin : allowedOrigins[0] ?? "null";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

export function isAllowedModel(model: unknown): model is (typeof ALLOWED_MODELS)[number] {
  return typeof model === "string" && (ALLOWED_MODELS as readonly string[]).includes(model);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateImages(value: unknown, fieldName = "images"): ValidationResult<string[]> {
  if (value === undefined || value === null) return { ok: true, value: [] };
  if (!Array.isArray(value)) return { ok: false, error: `${fieldName} must be an array` };
  if (value.length > MAX_IMAGES) return { ok: false, error: `${fieldName} cannot contain more than ${MAX_IMAGES} images` };

  for (const image of value) {
    if (typeof image !== "string") return { ok: false, error: `${fieldName} entries must be strings` };
    if (!image.startsWith("data:image/")) return { ok: false, error: `${fieldName} entries must be image data URLs` };
    if (image.length > MAX_IMAGE_DATA_URL_LENGTH) return { ok: false, error: `${fieldName} entry is too large` };
  }

  return { ok: true, value };
}

function validateHistory(value: unknown): ValidationResult<ValidatedHistoryMessage[]> {
  if (value === undefined || value === null) return { ok: true, value: [] };
  if (!Array.isArray(value)) return { ok: false, error: "messageHistory must be an array" };
  if (value.length > MAX_HISTORY_MESSAGES) {
    return { ok: false, error: `messageHistory cannot contain more than ${MAX_HISTORY_MESSAGES} messages` };
  }

  const history: ValidatedHistoryMessage[] = [];
  for (const message of value) {
    if (!isRecord(message)) return { ok: false, error: "messageHistory entries must be objects" };
    if (message.role !== "user" && message.role !== "assistant") {
      return { ok: false, error: "messageHistory entries must have role user or assistant" };
    }
    if (typeof message.content !== "string") {
      return { ok: false, error: "messageHistory entries must have string content" };
    }
    if (message.content.length > MAX_HISTORY_CONTENT_LENGTH) {
      return { ok: false, error: "messageHistory entry is too long" };
    }

    const imagesResult = validateImages(message.images, "messageHistory.images");
    if (imagesResult.ok === false) return { ok: false, error: imagesResult.error };

    history.push({
      role: message.role,
      content: message.content,
      ...(imagesResult.value.length > 0 ? { images: imagesResult.value } : {}),
    });
  }

  return { ok: true, value: history };
}

export function validateChatRequestBody(body: unknown): ValidationResult<ValidatedChatRequest> {
  if (!isRecord(body)) return { ok: false, error: "Request body must be a JSON object" };
  if (typeof body.content !== "string") return { ok: false, error: "content is required" };
  if (body.content.length > MAX_CONTENT_LENGTH) return { ok: false, error: "content is too long" };
  if (!isAllowedModel(body.model)) return { ok: false, error: "Unsupported model" };

  const historyResult = validateHistory(body.messageHistory);
  if (historyResult.ok === false) return { ok: false, error: historyResult.error };

  const imagesResult = validateImages(body.images);
  if (imagesResult.ok === false) return { ok: false, error: imagesResult.error };

  if (typeof body.sessionId !== "string" || body.sessionId.trim().length === 0) {
    return { ok: false, error: "sessionId is required" };
  }
  if (body.workoutSessionId !== undefined && typeof body.workoutSessionId !== "string") {
    return { ok: false, error: "workoutSessionId must be a string" };
  }

  const workoutSessionId = typeof body.workoutSessionId === "string" ? body.workoutSessionId : undefined;

  return {
    ok: true,
    value: {
      sessionId: body.sessionId,
      workoutSessionId,
      content: body.content,
      model: body.model,
      messageHistory: historyResult.value,
      images: imagesResult.value,
    },
  };
}
