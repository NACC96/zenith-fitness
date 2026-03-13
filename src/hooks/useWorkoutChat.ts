"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChatMessage = {
  _id: string;
  role: "user" | "assistant";
  content: string;
  images?: string[];
};

export type ModelOption = {
  label: string;
  value: string;
};

type StreamHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

/** Lightweight snapshot of current workout state sent alongside each SSE request. */
export interface WorkoutContext {
  workoutSessionId: Id<"workoutSessions"> | null;
}

export interface UseWorkoutChatReturn {
  /** Chat messages from Convex (reactive). */
  messages: ChatMessage[];
  /** Whether an SSE stream is currently in-flight. */
  isStreaming: boolean;
  /** Accumulated text from the active SSE stream (for progressive rendering). */
  streamingContent: string;
  /** Currently selected model identifier. */
  selectedModel: string;
  /** Set the selected model. */
  setSelectedModel: (model: string) => void;
  /** Send a user message (optionally with base-64 images). */
  sendMessage: (content: string, images?: string[]) => Promise<void>;
  /** Update the workout context sent with each SSE request. */
  pushContext: (ctx: WorkoutContext) => void;
  /** The active chat session ID (null while bootstrapping). */
  chatSessionId: Id<"chatSessions"> | null;
  /** True while the chat session is being created. */
  isSessionLoading: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STREAM_UI_FLUSH_MS = 50;
const DEFAULT_MODEL = "anthropic/claude-sonnet-4.6";
const HISTORY_WINDOW = 20;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Extracts all chat-related state and SSE streaming logic from the workout page.
 *
 * Manages:
 * - Convex chat session creation & persistence (sessionStorage)
 * - Chat message list (Convex reactive query)
 * - SSE streaming with 50 ms batched UI flushes
 * - Tool call handling (server-side in convex/ai.ts; the client sees `thinking`
 *   events which signal that tool execution occurred and a follow-up generation
 *   is in progress — the loop continues reading tokens until `done`/`error`)
 * - Workout context ref for passing the active session ID to the backend
 */
export function useWorkoutChat(
  workoutSessionId: Id<"workoutSessions"> | null,
): UseWorkoutChatReturn {
  // ---- refs ---------------------------------------------------------------
  const isSendingRef = useRef(false);
  const streamFlushTimeoutRef = useRef<number | null>(null);
  const streamPendingContentRef = useRef("");
  const workoutContextRef = useRef<WorkoutContext>({
    workoutSessionId: null,
  });

  // ---- state --------------------------------------------------------------
  const [activeChatSessionId, setActiveChatSessionId] =
    useState<Id<"chatSessions"> | null>(null);
  const [creatingChatSession, setCreatingChatSession] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);

  // ---- Convex mutations/queries -------------------------------------------
  const createChatSession = useMutation(api.chatSessions.create);
  const sendChatMessage = useMutation(api.chatMessages.send);
  const chatMessagesRaw = useQuery(
    api.chatMessages.list,
    activeChatSessionId ? { sessionId: activeChatSessionId } : "skip",
  );
  const messages = useMemo(
    () => (chatMessagesRaw ?? []) as ChatMessage[],
    [chatMessagesRaw],
  );

  // ---- Keep workout context ref in sync -----------------------------------
  useEffect(() => {
    workoutContextRef.current = { workoutSessionId };
  }, [workoutSessionId]);

  // ---- Chat session bootstrap ---------------------------------------------
  useEffect(() => {
    if (!workoutSessionId) {
      setActiveChatSessionId(null);
      return;
    }
    if (activeChatSessionId || creatingChatSession) return;

    const storageKey = `workout-chat-session:${workoutSessionId}`;
    const storedSessionId = window.sessionStorage.getItem(storageKey);
    if (storedSessionId && storedSessionId.length > 0) {
      setActiveChatSessionId(storedSessionId as Id<"chatSessions">);
      return;
    }

    setCreatingChatSession(true);
    void createChatSession()
      .then((sessionId) => {
        setActiveChatSessionId(sessionId);
        window.sessionStorage.setItem(storageKey, sessionId);
      })
      .catch((error) => {
        console.error("Failed to create workout chat session:", error);
      })
      .finally(() => {
        setCreatingChatSession(false);
      });
  }, [workoutSessionId, activeChatSessionId, creatingChatSession, createChatSession]);

  // ---- 50 ms batched flush helper -----------------------------------------
  const flushStreamingContent = useCallback(
    (content: string, immediate = false) => {
      const flush = () => {
        streamFlushTimeoutRef.current = null;
        setStreamingContent(streamPendingContentRef.current);
        if (process.env.NODE_ENV !== "production" && typeof performance !== "undefined") {
          performance.mark("workout-chat-stream-commit");
        }
      };

      streamPendingContentRef.current = content;

      if (immediate) {
        if (streamFlushTimeoutRef.current !== null) {
          window.clearTimeout(streamFlushTimeoutRef.current);
          streamFlushTimeoutRef.current = null;
        }
        flush();
        return;
      }

      if (streamFlushTimeoutRef.current !== null) return;
      streamFlushTimeoutRef.current = window.setTimeout(flush, STREAM_UI_FLUSH_MS);
    },
    [],
  );

  // Cleanup flush timer on unmount
  useEffect(() => {
    return () => {
      if (streamFlushTimeoutRef.current !== null) {
        window.clearTimeout(streamFlushTimeoutRef.current);
        streamFlushTimeoutRef.current = null;
      }
    };
  }, []);

  // ---- sendMessage --------------------------------------------------------
  const sendMessage = useCallback(
    async (content: string, images?: string[]) => {
      const trimmed = content.trim();
      if (
        (!trimmed && (!images || images.length === 0)) ||
        isStreaming ||
        isSendingRef.current ||
        !activeChatSessionId
      ) {
        return;
      }

      const imagesToSend = images && images.length > 0 ? images : undefined;
      isSendingRef.current = true;

      if (process.env.NODE_ENV !== "production" && typeof performance !== "undefined") {
        performance.mark("workout-chat-stream-start");
      }

      setIsStreaming(true);
      setStreamingContent("");

      try {
        // 1. Persist the user message to Convex
        await sendChatMessage({
          sessionId: activeChatSessionId,
          content: trimmed,
          images: imagesToSend,
          model: selectedModel,
        });

        // 2. Build message history (strip images to reduce payload)
        const messageHistory: StreamHistoryMessage[] = messages
          .slice(-HISTORY_WINDOW)
          .map((message) => ({
            role: message.role,
            content: message.content,
          }));

        // 3. Resolve the Convex HTTP action URL
        const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
        const baseUrl =
          siteUrl ||
          (process.env.NEXT_PUBLIC_CONVEX_URL?.replace(".cloud", ".site") ?? "");

        if (!baseUrl) {
          throw new Error("Convex site URL not configured. Set NEXT_PUBLIC_CONVEX_SITE_URL or NEXT_PUBLIC_CONVEX_URL.");
        }

        // 4. Fire the SSE request
        const response = await fetch(`${baseUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: activeChatSessionId,
            content: trimmed,
            images: imagesToSend,
            model: selectedModel,
            messageHistory,
            workoutSessionId: workoutContextRef.current.workoutSessionId,
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status}`);
        }

        // 5. Read the SSE stream
        //
        // The server (convex/ai.ts) handles tool execution internally.
        // The SSE protocol is:
        //   { token: string }    — incremental content delta
        //   { thinking: true }   — server executed tool call(s), generating follow-up
        //   { done: true }       — stream finished successfully
        //   { error: string }    — stream finished with error
        //
        // When tools mutate workout state (completeSet, startSet, logExercise,
        // setWorkoutType), the server re-reads the DB on the next loop iteration
        // so the AI's follow-up turn has fresh state. On the client side, Convex
        // reactive queries automatically pick up mutations, so the UI updates
        // without any manual refresh — workoutContextRef is kept in sync via the
        // effect above.

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";
        let shouldStop = false;

        while (!shouldStop) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (!data) continue;

            try {
              const parsed = JSON.parse(data) as {
                token?: string;
                done?: boolean;
                error?: string;
                thinking?: boolean;
              };

              if (parsed.token) {
                accumulated += parsed.token;
                flushStreamingContent(accumulated);
                continue;
              }

              if (parsed.done || parsed.error) {
                shouldStop = true;
                break;
              }

              // `thinking` events are informational — the server is executing
              // tools and will produce more tokens in a subsequent loop iteration.
              // We simply continue reading.
            } catch {
              // Ignore malformed chunks.
            }
          }
        }

        if (shouldStop) {
          await reader.cancel().catch(() => {});
        }

        // Final flush with all accumulated content
        flushStreamingContent(accumulated, true);
      } catch (error) {
        console.error("Workout chat streaming failed:", error);
      } finally {
        if (streamFlushTimeoutRef.current !== null) {
          window.clearTimeout(streamFlushTimeoutRef.current);
          streamFlushTimeoutRef.current = null;
        }
        streamPendingContentRef.current = "";
        isSendingRef.current = false;
        setIsStreaming(false);
        setStreamingContent("");

        if (process.env.NODE_ENV !== "production" && typeof performance !== "undefined") {
          performance.mark("workout-chat-stream-end");
        }
      }
    },
    [
      activeChatSessionId,
      flushStreamingContent,
      isStreaming,
      messages,
      selectedModel,
      sendChatMessage,
    ],
  );

  // ---- pushContext --------------------------------------------------------
  const pushContext = useCallback((ctx: WorkoutContext) => {
    workoutContextRef.current = ctx;
  }, []);

  // ---- return -------------------------------------------------------------
  return {
    messages,
    isStreaming,
    streamingContent,
    selectedModel,
    setSelectedModel,
    sendMessage,
    pushContext,
    chatSessionId: activeChatSessionId,
    isSessionLoading: creatingChatSession,
  };
}
