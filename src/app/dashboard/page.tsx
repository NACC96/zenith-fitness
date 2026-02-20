"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
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

export default function DashboardPage() {
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [selectedSession, setSelectedSession] = useState<WorkoutSession | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState("google/gemini-2.5-pro");
  const [modelInitialized, setModelInitialized] = useState(false);

  const rawWorkouts = useQuery(api.workoutSessions.listAll);
  const workoutTypes = useQuery(api.workoutTypes.list);
  const allWorkouts = (rawWorkouts ?? []) as WorkoutSession[];

  // Chat: Convex queries and mutations
  const chatMessages = useQuery(api.chatMessages.list) ?? [];
  const sendMessage = useMutation(api.chatMessages.send);
  const clearChat = useMutation(api.chatMessages.clear);
  const savedModel = useQuery(api.settings.get, { key: "selectedModel" });
  const saveModel = useMutation(api.settings.set);

  // Loading state: true when the last message is from user (waiting for AI response)
  const isChatLoading =
    chatMessages.length > 0 &&
    chatMessages[chatMessages.length - 1].role === "user";

  const filterOptions = ["All", ...(workoutTypes?.map((t) => t.name) ?? [])];

  // Sync saved model preference from Convex
  useEffect(() => {
    if (savedModel && !modelInitialized) {
      setSelectedModel(savedModel);
      setModelInitialized(true);
    }
  }, [savedModel, modelInitialized]);

  const handleSendMessage = async (content: string) => {
    await sendMessage({ content, model: selectedModel });
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    saveModel({ key: "selectedModel", value: model });
  };

  const handleClearChat = async () => {
    await clearChat();
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
            style={{ background: "#ccff00" }}
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
      />
    </div>
  );
}
