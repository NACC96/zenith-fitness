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
  model?: string;
  timestamp: number;
};

export type ChatSession = {
  _id: Id<"chatSessions">;
  title: string;
  createdAt: number;
  updatedAt: number;
};

export interface UseDashboardChatReturn {
  /** Chat messages for the active session (reactive). */
  messages: ChatMessage[];
  /** All chat sessions (reactive). */
  sessions: ChatSession[];
  /** The active chat session ID (null while bootstrapping). */
  activeSessionId: Id<"chatSessions"> | null;
  /** Whether an SSE stream is currently in-flight. */
  isStreaming: boolean;
  /** Accumulated text from the active SSE stream (for progressive rendering). */
  streamingContent: string;
  /** Currently selected model identifier. */
  selectedModel: string;
  /** Send a user message (optionally with base-64 images). */
  sendMessage: (content: string, images?: string[]) => Promise<void>;
  /** Change the selected model and persist to Convex settings. */
  onModelChange: (model: string) => void;
  /** Clear all messages in the active session. */
  onClearChat: () => Promise<void>;
  /** Create a new chat session and make it active. */
  onNewChat: () => Promise<void>;
  /** Select an existing session by ID string. */
  onSelectSession: (id: string) => void;
  /** Delete a session by ID string; switches to another session if active. */
  onDeleteSession: (id: string) => void;
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
 * Extracts all chat-related state and SSE streaming logic from the dashboard page.
 *
 * Manages:
 * - Convex chat session list, creation, deletion, and selection
 * - Chat message list (Convex reactive query)
 * - Model preference persisted to Convex settings
 * - SSE streaming with 50 ms batched UI flushes
 */
export function useDashboardChat(): UseDashboardChatReturn {
  // ---- refs ---------------------------------------------------------------
  const streamFlushTimeoutRef = useRef<number | null>(null);
  const streamPendingContentRef = useRef("");

  // ---- state --------------------------------------------------------------
  const [activeSessionId, setActiveSessionId] = useState<Id<"chatSessions"> | null>(null);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [modelInitialized, setModelInitialized] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  // ---- Convex queries / mutations -----------------------------------------
  const sessionsRaw = useQuery(api.chatSessions.list);
  const sessions = useMemo(() => (sessionsRaw ?? []) as ChatSession[], [sessionsRaw]);

  const createSession = useMutation(api.chatSessions.create);
  const deleteSessionMutation = useMutation(api.chatSessions.remove);
  const sendMessageMutation = useMutation(api.chatMessages.send);
  const clearChatMutation = useMutation(api.chatMessages.clear);
  const savedModel = useQuery(api.settings.get, { key: "selectedModel" });
  const saveModel = useMutation(api.settings.set);

  const chatMessagesRaw = useQuery(
    api.chatMessages.list,
    activeSessionId ? { sessionId: activeSessionId } : "skip",
  );
  const messages = useMemo(
    () => (chatMessagesRaw ?? []) as ChatMessage[],
    [chatMessagesRaw],
  );

  // ---- Auto-create or select first session on load ------------------------
  useEffect(() => {
    if (sessions.length === 0 && activeSessionId === null) {
      createSession().then((id) => setActiveSessionId(id));
    } else if (activeSessionId === null && sessions.length > 0) {
      setActiveSessionId(sessions[0]._id);
    }
  }, [sessions, activeSessionId, createSession]);

  // ---- Sync saved model preference from Convex ----------------------------
  useEffect(() => {
    if (savedModel && !modelInitialized) {
      setSelectedModel(savedModel);
      setModelInitialized(true);
    }
  }, [savedModel, modelInitialized]);

  // ---- 50 ms batched flush helper -----------------------------------------
  const flushStreamingContent = useCallback((content: string, immediate = false) => {
    const flush = () => {
      streamFlushTimeoutRef.current = null;
      setStreamingContent(streamPendingContentRef.current);
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
  }, []);

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
  const sendMessage = useCallback(async (content: string, images?: string[]) => {
    if (!activeSessionId || isStreaming) return;

    // 1. Save user message to DB via mutation
    await sendMessageMutation({ sessionId: activeSessionId, content, images, model: selectedModel });

    // 2. Build message history from recent messages
    const recentMessages = messages.slice(-HISTORY_WINDOW).map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.images ? { images: m.images } : {}),
    }));

    // 3. Start streaming
    setIsStreaming(true);
    setStreamingContent("");

    try {
      const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
      const baseUrl =
        siteUrl ||
        (process.env.NEXT_PUBLIC_CONVEX_URL?.replace(".cloud", ".site") ?? "");

      const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSessionId,
          content,
          images,
          model: selectedModel,
          messageHistory: recentMessages,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (!data) continue;

          try {
            const parsed = JSON.parse(data);

            if (parsed.token) {
              accumulated += parsed.token;
              flushStreamingContent(accumulated);
            } else if (parsed.done) {
              break;
            } else if (parsed.error) {
              console.error("Stream error:", parsed.error);
              break;
            }
            // parsed.thinking — AI is processing tools, streaming continues
          } catch {
            // Skip unparseable lines
          }
        }
      }

      flushStreamingContent(accumulated, true);
    } catch (error) {
      console.error("Streaming failed:", error);
    } finally {
      if (streamFlushTimeoutRef.current !== null) {
        window.clearTimeout(streamFlushTimeoutRef.current);
        streamFlushTimeoutRef.current = null;
      }
      streamPendingContentRef.current = "";
      setIsStreaming(false);
      setStreamingContent("");
    }
  }, [activeSessionId, messages, flushStreamingContent, isStreaming, selectedModel, sendMessageMutation]);

  // ---- onModelChange ------------------------------------------------------
  const onModelChange = useCallback((model: string) => {
    setSelectedModel(model);
    saveModel({ key: "selectedModel", value: model });
  }, [saveModel]);

  // ---- onClearChat --------------------------------------------------------
  const onClearChat = useCallback(async () => {
    if (!activeSessionId) return;
    await clearChatMutation({ sessionId: activeSessionId });
  }, [activeSessionId, clearChatMutation]);

  // ---- onNewChat ----------------------------------------------------------
  const onNewChat = useCallback(async () => {
    const id = await createSession();
    setActiveSessionId(id);
  }, [createSession]);

  // ---- handleDeleteSession (internal) -------------------------------------
  const handleDeleteSession = useCallback(async (sessionId: Id<"chatSessions">) => {
    await deleteSessionMutation({ sessionId });
    if (activeSessionId === sessionId) {
      const remaining = sessions.filter((s) => s._id !== sessionId);
      if (remaining.length > 0) {
        setActiveSessionId(remaining[0]._id);
      } else {
        const id = await createSession();
        setActiveSessionId(id);
      }
    }
  }, [activeSessionId, createSession, deleteSessionMutation, sessions]);

  // ---- UI string wrappers -------------------------------------------------
  const onSelectSession = useCallback((id: string) => {
    setActiveSessionId(id as Id<"chatSessions">);
  }, []);

  const onDeleteSession = useCallback((id: string) => {
    void handleDeleteSession(id as Id<"chatSessions">);
  }, [handleDeleteSession]);

  // ---- return -------------------------------------------------------------
  return {
    messages,
    sessions,
    activeSessionId,
    isStreaming,
    streamingContent,
    selectedModel,
    sendMessage,
    onModelChange,
    onClearChat,
    onNewChat,
    onSelectSession,
    onDeleteSession,
  };
}
