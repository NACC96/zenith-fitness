"use client";

import { useState, useEffect } from "react";
import type { WorkoutType, WorkoutSession } from "@/lib/types";
import { WORKOUT_DATA } from "@/lib/data";
import Header from "@/components/Header";
import StatsRow from "@/components/StatsRow";
import VolumeTrendChart from "@/components/VolumeTrendChart";
import ExerciseProgression from "@/components/ExerciseProgression";
import SessionList from "@/components/SessionList";
import SessionDetail from "@/components/SessionDetail";
import AddTypeModal from "@/components/AddTypeModal";

export default function DashboardPage() {
  const [activeFilter, setActiveFilter] = useState<WorkoutType>("All");
  const [selectedSession, setSelectedSession] = useState<WorkoutSession | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredSessions =
    activeFilter === "All"
      ? WORKOUT_DATA
      : WORKOUT_DATA.filter((w) => w.type === activeFilter);

  return (
    <div
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 0.8s ease, transform 0.8s ease",
      }}
    >
      <Header activeFilter={activeFilter} onFilterChange={setActiveFilter} />

      <main className="px-5 py-6 md:px-10 md:py-8">
        {/* Filter summary */}
        <p className="mb-6 font-mono text-xs uppercase tracking-widest text-white/40">
          {activeFilter === "All" ? "All Workouts" : activeFilter} —{" "}
          {filteredSessions.length} session
          {filteredSessions.length !== 1 && "s"}
        </p>

        {/* Stats row */}
        <StatsRow workouts={WORKOUT_DATA} activeFilter={activeFilter} />

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
            allWorkouts={WORKOUT_DATA}
          />
        </div>
      </main>

      <AddTypeModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
      />
    </div>
  );
}
