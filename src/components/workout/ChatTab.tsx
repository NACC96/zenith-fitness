// src/components/workout/ChatTab.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkout } from "@/contexts/WorkoutContext";
import { useWorkoutChat } from "@/hooks/useWorkoutChat";
import type { WorkoutContext } from "@/hooks/useWorkoutChat";

interface ChatTabProps {
  isVisible: boolean;
}

export default function ChatTab({ isVisible }: ChatTabProps) {
  const { sessionId, session } = useWorkout();
  const { messages, isStreaming, streamingContent, sendMessage, pushContext, selectedModel, setSelectedModel } =
    useWorkoutChat(sessionId);

  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Build workout context identifier for the chat session
  const buildWorkoutState = useCallback((): WorkoutContext => {
    return { workoutSessionId: sessionId };
  }, [sessionId]);

  // Push context whenever the tab becomes visible or workout state changes
  useEffect(() => {
    if (!isVisible) return;
    pushContext(buildWorkoutState());
  }, [isVisible, pushContext, buildWorkoutState]);

  // Auto-scroll to bottom when messages update or streaming content changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleSend = useCallback(async () => {
    const content = inputValue.trim();
    if (!content || isStreaming) return;
    setInputValue("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    await sendMessage(content);
  }, [inputValue, isStreaming, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputValue(e.target.value);
      // Auto-grow textarea
      const el = e.target;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    },
    [],
  );

  const MODELS = [
    { id: "anthropic/claude-sonnet-4.6", label: "Sonnet" },
    { id: "x-ai/grok-4.20-beta", label: "Grok" },
    { id: "z-ai/glm-5-turbo", label: "GLM" },
  ] as const;

  return (
    <div className="flex flex-col h-full pb-12 bg-black">
      {/* Header — model picker */}
      <div className="flex-none px-4 pt-3 pb-2 border-b border-zinc-800">
        <div className="flex justify-center gap-2">
          {MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedModel(m.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedModel === m.id
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-500 active:bg-zinc-800"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && !isStreaming && (
          <p className="text-zinc-600 text-sm text-center mt-8">
            Ask me anything about your workout.
          </p>
        )}

        {messages.map((msg) => (
          <div
            key={msg._id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-100"
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
            </div>
          </div>
        ))}

        {/* Streaming bubble */}
        {isStreaming && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl px-4 py-2 text-sm bg-zinc-800 text-zinc-100">
              {streamingContent ? (
                <p className="whitespace-pre-wrap break-words">
                  {streamingContent}
                </p>
              ) : (
                <span className="inline-flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:300ms]" />
                </span>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar — safe-area padding for notched phones */}
      <div className="flex-none border-t border-zinc-800 px-3 py-2 pb-[env(safe-area-inset-bottom,8px)] bg-black">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Message…"
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none overflow-hidden rounded-2xl bg-zinc-800 px-4 py-2 text-base text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-600 disabled:opacity-50 max-h-32"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!inputValue.trim() || isStreaming}
            className="flex-none w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            aria-label="Send message"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4 text-white"
              aria-hidden="true"
            >
              <title>Send</title>
              <path
                fillRule="evenodd"
                d="M10 17a.75.75 0 0 1-.75-.75V5.56l-3.22 3.22a.75.75 0 0 1-1.06-1.06l4.5-4.5a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1-1.06 1.06L10.75 5.56v10.69A.75.75 0 0 1 10 17Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
