import type { WorkoutIngestionRequest, WorkoutParseOutput } from "./ingestion-contract";
import {
  buildOpenRouterUserPrompt,
  buildParseFailureOutput,
  DEFAULT_OPENROUTER_MODEL,
  extractOpenRouterMessageContent,
  OPENROUTER_API_URL,
  parseAndValidateOpenRouterOutput,
  WORKOUT_PARSE_JSON_SCHEMA,
  WORKOUT_PARSE_SCHEMA_NAME,
  WORKOUT_PARSE_SYSTEM_PROMPT,
} from "./openrouter-schema";

export interface OpenRouterModelResponseLog {
  loggedAt: string;
  requestStartedAt: string;
  requestCompletedAt: string;
  durationMs: number;
  attempt: number;
  model: string;
  requestPayload: Record<string, unknown>;
  responseStatus?: number;
  responsePayload?: unknown;
  errorMessage?: string;
}

export interface WorkoutParseGatewayResult {
  parse: WorkoutParseOutput;
  modelLog: OpenRouterModelResponseLog;
}

export interface WorkoutParsingGateway {
  parseWorkout(request: WorkoutIngestionRequest): Promise<WorkoutParseGatewayResult>;
}

interface FetchResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

type FetchLike = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
  }
) => Promise<FetchResponse>;

export interface OpenRouterParserOptions {
  apiKey: string;
  model?: string;
  endpoint?: string;
  referer?: string;
  title?: string;
  maxAttempts?: number;
  retryBaseDelayMs?: number;
  fetchImplementation?: FetchLike;
  now?: () => Date;
}

const TRANSIENT_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

const sleep = async (durationMs: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, durationMs));
};

const parseBody = (responseText: string): unknown => {
  if (!responseText) {
    return undefined;
  }

  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
};

export class OpenRouterWorkoutParser implements WorkoutParsingGateway {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly endpoint: string;
  private readonly referer?: string;
  private readonly title?: string;
  private readonly maxAttempts: number;
  private readonly retryBaseDelayMs: number;
  private readonly fetchImplementation: FetchLike;
  private readonly now: () => Date;

  constructor(options: OpenRouterParserOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_OPENROUTER_MODEL;
    this.endpoint = options.endpoint ?? OPENROUTER_API_URL;
    this.referer = options.referer;
    this.title = options.title;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 250;
    this.fetchImplementation = options.fetchImplementation ?? (fetch as FetchLike);
    this.now = options.now ?? (() => new Date());
  }

  async parseWorkout(request: WorkoutIngestionRequest): Promise<WorkoutParseGatewayResult> {
    if (!this.apiKey.trim()) {
      const now = this.now();
      return {
        parse: buildParseFailureOutput(
          "OpenRouter API key is not configured.",
          "INTERNAL_ERROR"
        ),
        modelLog: {
          loggedAt: now.toISOString(),
          requestStartedAt: now.toISOString(),
          requestCompletedAt: now.toISOString(),
          durationMs: 0,
          attempt: 1,
          model: this.model,
          requestPayload: {},
          errorMessage: "Missing OPENROUTER_API_KEY.",
        },
      };
    }

    const requestPayload = {
      model: this.model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: WORKOUT_PARSE_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: buildOpenRouterUserPrompt(request),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: WORKOUT_PARSE_SCHEMA_NAME,
          strict: true,
          schema: WORKOUT_PARSE_JSON_SCHEMA,
        },
      },
    } as const;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const requestStartedAt = this.now();

      try {
        const response = await this.fetchImplementation(this.endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            ...(this.referer ? { "HTTP-Referer": this.referer } : {}),
            ...(this.title ? { "X-Title": this.title } : {}),
          },
          body: JSON.stringify(requestPayload),
        });

        const responseText = await response.text();
        const responsePayload = parseBody(responseText);
        const requestCompletedAt = this.now();

        const modelLog: OpenRouterModelResponseLog = {
          loggedAt: requestCompletedAt.toISOString(),
          requestStartedAt: requestStartedAt.toISOString(),
          requestCompletedAt: requestCompletedAt.toISOString(),
          durationMs:
            requestCompletedAt.getTime() - requestStartedAt.getTime(),
          attempt,
          model: this.model,
          requestPayload: requestPayload as unknown as Record<string, unknown>,
          responseStatus: response.status,
          responsePayload,
        };

        if (!response.ok) {
          if (
            TRANSIENT_STATUS_CODES.has(response.status) &&
            attempt < this.maxAttempts
          ) {
            await sleep(this.retryBaseDelayMs * attempt);
            continue;
          }

          return {
            parse: buildParseFailureOutput(
              `OpenRouter returned HTTP ${response.status}.`,
              "INTERNAL_ERROR"
            ),
            modelLog,
          };
        }

        const rawContent = extractOpenRouterMessageContent(responsePayload);
        if (!rawContent) {
          return {
            parse: buildParseFailureOutput(
              "OpenRouter returned no parse payload content.",
              "INTERNAL_ERROR"
            ),
            modelLog,
          };
        }

        return {
          parse: parseAndValidateOpenRouterOutput(rawContent),
          modelLog,
        };
      } catch (error) {
        const requestCompletedAt = this.now();

        if (attempt < this.maxAttempts) {
          await sleep(this.retryBaseDelayMs * attempt);
          continue;
        }

        return {
          parse: buildParseFailureOutput(
            "OpenRouter request failed after retries.",
            "INTERNAL_ERROR"
          ),
          modelLog: {
            loggedAt: requestCompletedAt.toISOString(),
            requestStartedAt: requestStartedAt.toISOString(),
            requestCompletedAt: requestCompletedAt.toISOString(),
            durationMs:
              requestCompletedAt.getTime() - requestStartedAt.getTime(),
            attempt,
            model: this.model,
            requestPayload: requestPayload as unknown as Record<string, unknown>,
            errorMessage: error instanceof Error ? error.message : "Unknown error",
          },
        };
      }
    }

    const now = this.now();
    return {
      parse: buildParseFailureOutput(
        "OpenRouter request failed to produce a parse output.",
        "INTERNAL_ERROR"
      ),
      modelLog: {
        loggedAt: now.toISOString(),
        requestStartedAt: now.toISOString(),
        requestCompletedAt: now.toISOString(),
        durationMs: 0,
        attempt: this.maxAttempts,
        model: this.model,
        requestPayload: {},
        errorMessage: "No parse output produced.",
      },
    };
  }
}
