"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { WorkoutSession } from "@/lib/types";
import Header from "@/components/Header";
import StatsRow from "@/components/StatsRow";
import VolumeTrendChart from "@/components/VolumeTrendChart";
import ExerciseProgression from "@/components/ExerciseProgression";
import SessionList from "@/components/SessionList";
import SessionDetail from "@/components/SessionDetail";
import AddTypeModal from "@/components/AddTypeModal";
import ChatDrawer from "@/components/ChatDrawer";
import ChatToggleButton from "@/components/ChatToggleButton";
import Portal from "@/components/Portal";

export default function DashboardPage() {
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [selectedSession, setSelectedSession] = useState<WorkoutSession | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState("google/gemini-3.1-pro-preview");
  const [modelInitialized, setModelInitialized] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<Id<"chatSessions"> | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const rawWorkouts = useQuery(api.workoutSessions.listAll);
  const workoutTypes = useQuery(api.workoutTypes.list);
  const allWorkouts = (rawWorkouts ?? []) as WorkoutSession[];

  // Chat sessions
  const sessions = useQuery(api.chatSessions.list) ?? [];
  const createSession = useMutation(api.chatSessions.create);
  const deleteSession = useMutation(api.chatSessions.remove);

  // Chat: Convex queries and mutations
  const chatMessages = useQuery(
    api.chatMessages.list,
    activeSessionId ? { sessionId: activeSessionId } : "skip"
  ) ?? [];
  const sendMessage = useMutation(api.chatMessages.send);
  const clearChat = useMutation(api.chatMessages.clear);
  const savedModel = useQuery(api.settings.get, { key: "selectedModel" });
  const saveModel = useMutation(api.settings.set);

  // Streaming replaces the old "last message is user" loading check
  const isChatLoading = isStreaming;

  // Auto-create or select first session on load
  useEffect(() => {
    if (sessions.length === 0 && activeSessionId === null) {
      createSession().then((id) => setActiveSessionId(id));
    } else if (activeSessionId === null && sessions.length > 0) {
      setActiveSessionId(sessions[0]._id);
    }
  }, [sessions, activeSessionId, createSession]);

  const filterOptions = ["All", ...(workoutTypes?.map((t) => t.name) ?? [])];

  // Sync saved model preference from Convex
  useEffect(() => {
    if (savedModel && !modelInitialized) {
      setSelectedModel(savedModel);
      setModelInitialized(true);
    }
  }, [savedModel, modelInitialized]);

  const handleSendMessage = async (content: string) => {
    if (!activeSessionId || isStreaming) return;

    // 1. Save user message to DB via mutation
    await sendMessage({ sessionId: activeSessionId, content, model: selectedModel });

    // 2. Build message history from recent messages
    const recentMessages = chatMessages.slice(-20).map((m) => ({
      role: m.role,
      content: m.content,
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
              setStreamingContent(accumulated);
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
    } catch (error) {
      console.error("Streaming failed:", error);
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
    }
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    saveModel({ key: "selectedModel", value: model });
  };

  const handleClearChat = async () => {
    if (!activeSessionId) return;
    await clearChat({ sessionId: activeSessionId });
  };

  const handleNewChat = async () => {
    const id = await createSession();
    setActiveSessionId(id);
  };

  const handleDeleteSession = async (sessionId: Id<"chatSessions">) => {
    await deleteSession({ sessionId });
    if (activeSessionId === sessionId) {
      const remaining = sessions.filter((s) => s._id !== sessionId);
      if (remaining.length > 0) {
        setActiveSessionId(remaining[0]._id);
      } else {
        const id = await createSession();
        setActiveSessionId(id);
      }
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  if (rawWorkouts === undefined || workoutTypes === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div
          className="rounded-2xl px-8 py-6 flex items-center gap-3"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            backdropFilter: "blur(20px)",
          }}
        >
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: "#ff2d2d" }}
          />
          <span
            className="font-mono text-[11px] uppercase tracking-widest"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            Loading workouts…
          </span>
        </div>
      </div>
    );
  }

  const filteredSessions =
    activeFilter === "All"
      ? allWorkouts
      : allWorkouts.filter((w) => w.type === activeFilter);

  return (
    <div
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 0.8s ease, transform 0.8s ease",
      }}
    >
      <Header
        types={filterOptions}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      <main className="px-5 py-6 md:px-10 md:py-8">
        {/* Filter summary */}
        <p className="mb-6 font-mono text-xs uppercase tracking-widest text-white/40">
          {activeFilter === "All" ? "All Workouts" : activeFilter} —{" "}
          {filteredSessions.length} session
          {filteredSessions.length !== 1 && "s"}
        </p>

        {/* Stats row */}
        <StatsRow workouts={allWorkouts} activeFilter={activeFilter} />

        {/* Charts row */}
        <div className="mt-6 flex flex-col gap-4 md:flex-row">
          <VolumeTrendChart workouts={filteredSessions} />
          <ExerciseProgression workouts={filteredSessions} />
        </div>

        {/* Session list + detail panel */}
        <div className="mt-6 flex flex-col gap-4 md:flex-row md:min-h-[500px]">
          <SessionList
            workouts={filteredSessions}
            selectedSession={selectedSession}
            onSelect={setSelectedSession}
            onAddType={() => setAddModalOpen(true)}
          />
          <SessionDetail
            workout={selectedSession}
            allWorkouts={allWorkouts}
          />
        </div>
      </main>

      <AddTypeModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
      />

      <Portal>
        <ChatToggleButton
          isOpen={isChatOpen}
          onClick={() => setIsChatOpen((o) => !o)}
        />
        <ChatDrawer
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          messages={chatMessages}
          onSendMessage={handleSendMessage}
          isLoading={isChatLoading}
          selectedModel={selectedModel}
          onModelChange={handleModelChange}
          onClearChat={handleClearChat}
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={(id: string) => setActiveSessionId(id as Id<"chatSessions">)}
          onNewChat={handleNewChat}
          onDeleteSession={(id: string) => handleDeleteSession(id as Id<"chatSessions">)}
          streamingContent={streamingContent}
          isStreaming={isStreaming}
        />
      </Portal>
    </div>
  );
}
