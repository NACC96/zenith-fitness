"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { WorkoutSession } from "@/lib/types";
import { motion } from "framer-motion";
import Header from "@/components/Header";
import StatsRow from "@/components/StatsRow";
import VolumeTrendChart from "@/components/VolumeTrendChart";
import ExerciseProgression from "@/components/ExerciseProgression";
import SessionList from "@/components/SessionList";
import SessionDetailModal from "@/components/SessionDetailModal";
import AddTypeModal from "@/components/AddTypeModal";
import ChatDrawer from "@/components/ChatDrawer";
import ChatToggleButton from "@/components/ChatToggleButton";
import Portal from "@/components/Portal";
import SectionLabel from "@/components/SectionLabel";
import CollapsibleSection from "@/components/CollapsibleSection";
import WeekOverWeek from "@/components/WeekOverWeek";
import TrainingStreak from "@/components/TrainingStreak";
import PeriodComparison from "@/components/PeriodComparison";
import DurationTrendChart from "@/components/DurationTrendChart";
import OneRepMaxChart from "@/components/OneRepMaxChart";
import MuscleGroupBalance from "@/components/MuscleGroupBalance";
import RestTimeAnalytics from "@/components/RestTimeAnalytics";
import FatigueCurve from "@/components/FatigueCurve";
import FrequencyHeatmap from "@/components/FrequencyHeatmap";
import PersonalRecords from "@/components/PersonalRecords";
import { useSectionPreviews } from "@/hooks/useSectionPreviews";
import { useDashboardChat } from "@/hooks/useDashboardChat";

export default function DashboardPage() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [selectedSession, setSelectedSession] = useState<WorkoutSession | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const {
    messages: chatMessages,
    sessions,
    activeSessionId,
    isStreaming,
    streamingContent,
    selectedModel,
    sendMessage: handleSendMessage,
    onModelChange: handleModelChange,
    onClearChat: handleClearChat,
    onNewChat: handleNewChat,
    onSelectSession: selectChatSession,
    onDeleteSession: deleteChatSession,
  } = useDashboardChat();

  // Streaming replaces the old "last message is user" loading check
  const isChatLoading = isStreaming;

  const rawWorkouts = useQuery(api.workoutSessions.listAll);
  const workoutTypes = useQuery(api.workoutTypes.list);
  const allWorkoutsUnfiltered = useMemo(() => (rawWorkouts ?? []) as WorkoutSession[], [rawWorkouts]);
  const activeWorkout = useMemo(
    () => allWorkoutsUnfiltered.find((w) => w.status === "active") ?? null,
    [allWorkoutsUnfiltered]
  );
  const allWorkouts = useMemo(
    () => allWorkoutsUnfiltered.filter((w) => w.status !== "active"),
    [allWorkoutsUnfiltered]
  );

  // Workout session deletion
  const deleteWorkoutSession = useMutation(api.workoutSessions.remove);

  const filterOptions = useMemo(
    () => ["All", ...(workoutTypes?.map((t) => t.name) ?? [])],
    [workoutTypes],
  );

  const filteredSessions = useMemo(
    () =>
      activeFilter === "All"
        ? allWorkouts
        : allWorkouts.filter((w) => w.type === activeFilter),
    [allWorkouts, activeFilter],
  );

  const previews = useSectionPreviews(allWorkouts, filteredSessions);

  const handleDeleteWorkout = async (sessionId: string) => {
    try {
      await deleteWorkoutSession({ sessionId: sessionId as Id<"workoutSessions"> });
      if (selectedSession?.id === sessionId) {
        setSelectedSession(null);
      }
    } catch (err) {
      console.error("Failed to delete workout session:", err);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleChat = useCallback(() => {
    setIsChatOpen((open) => !open);
  }, []);

  const closeChat = useCallback(() => {
    setIsChatOpen(false);
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
        {/* Filter summary + Start Workout */}
        <div className="flex items-center justify-between mb-6">
          <p className="font-mono text-xs uppercase tracking-widest text-white/40">
            {activeFilter === "All" ? "All Workouts" : activeFilter} —{" "}
            {filteredSessions.length} session
            {filteredSessions.length !== 1 && "s"}
          </p>

          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => router.push("/workout")}
            aria-label="Start workout"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
            style={{
              background: "rgba(255,45,45,0.1)",
              border: "1px solid rgba(255,45,45,0.3)",
              color: "#ff2d2d",
              fontFamily: "var(--font-display)",
              boxShadow: "0 0 20px rgba(255,45,45,0.1)",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Start Workout
          </motion.button>
        </div>

        {/* Active workout resume banner */}
        {activeWorkout && (
          <motion.button
            type="button"
            onClick={() => router.push("/workout")}
            className="w-full rounded-xl p-4 mb-6 flex items-center justify-between cursor-pointer transition-all active:scale-[0.98]"
            style={{
              background: "rgba(255,45,45,0.08)",
              border: "1px solid rgba(255,45,45,0.25)",
              boxShadow: "0 0 30px rgba(255,45,45,0.08)",
            }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: "#ff2d2d", boxShadow: "0 0 8px rgba(255,45,45,0.6)" }}
              />
              <div className="text-left">
                <div
                  className="text-sm font-semibold text-white"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {activeWorkout.type} — In Progress
                </div>
                <div
                  className="text-[10px] mt-0.5 uppercase tracking-wider"
                  style={{ fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.35)" }}
                >
                  {activeWorkout.exercises.length} exercise{activeWorkout.exercises.length !== 1 ? "s" : ""} ·{" "}
                  {activeWorkout.exercises.reduce((s, e) => s + e.sets.length, 0)} sets logged
                </div>
              </div>
            </div>
            <div
              className="text-sm font-semibold px-4 py-2 rounded-lg"
              style={{
                fontFamily: "var(--font-display)",
                color: "#ff2d2d",
                background: "rgba(255,45,45,0.12)",
                border: "1px solid rgba(255,45,45,0.3)",
              }}
            >
              Resume
            </div>
          </motion.button>
        )}

        {/* ── Overview (always visible) ── */}
        <SectionLabel>Overview</SectionLabel>
        <StatsRow workouts={allWorkouts} activeFilter={activeFilter} />
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <WeekOverWeek workouts={allWorkouts} />
          <TrainingStreak workouts={allWorkouts} />
        </div>

        {/* ── Collapsible sections ── */}
        <div className="mt-6 flex flex-col gap-0">
          <CollapsibleSection title="Period Insights" preview={previews.periodInsights}>
            <PeriodComparison workouts={allWorkouts} />
            <div className="mt-4 flex flex-col gap-4 md:flex-row">
              <VolumeTrendChart workouts={filteredSessions} />
              <DurationTrendChart workouts={filteredSessions} />
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Strength" preview={previews.strength}>
            <OneRepMaxChart workouts={filteredSessions} />
            <div className="mt-4">
              <ExerciseProgression workouts={filteredSessions} />
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Deep Analysis" preview={previews.deepAnalysis}>
            <div className="flex flex-col gap-4 md:flex-row">
              <MuscleGroupBalance workouts={filteredSessions} />
              <RestTimeAnalytics workouts={filteredSessions} />
            </div>
            <div className="mt-4">
              <FatigueCurve workouts={filteredSessions} />
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Activity & Sessions" preview={previews.activityHistory}>
            <div className="flex flex-col gap-4 md:flex-row">
              <FrequencyHeatmap workouts={allWorkouts} />
              <PersonalRecords workouts={allWorkouts} />
            </div>
            <div className="mt-4">
              <SessionList
                workouts={filteredSessions}
                onSelect={setSelectedSession}
                onDelete={handleDeleteWorkout}
                onAddType={() => setAddModalOpen(true)}
              />
            </div>
          </CollapsibleSection>
        </div>
      </main>

      <Portal>
        <AddTypeModal
          isOpen={addModalOpen}
          onClose={() => setAddModalOpen(false)}
        />
      </Portal>

      <SessionDetailModal
        isOpen={selectedSession !== null}
        onClose={() => setSelectedSession(null)}
        workout={selectedSession}
        allWorkouts={allWorkouts}
      />

      <Portal>
        <ChatToggleButton
          isOpen={isChatOpen}
          onClick={toggleChat}
        />
        <ChatDrawer
          isOpen={isChatOpen}
          onClose={closeChat}
          messages={chatMessages}
          onSendMessage={handleSendMessage}
          isLoading={isChatLoading}
          selectedModel={selectedModel}
          onModelChange={handleModelChange}
          onClearChat={handleClearChat}
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={selectChatSession}
          onNewChat={handleNewChat}
          onDeleteSession={deleteChatSession}
          streamingContent={streamingContent}
          isStreaming={isStreaming}
        />
      </Portal>
    </div>
  );
}
