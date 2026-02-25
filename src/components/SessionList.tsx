"use client";

import type { WorkoutSession } from "@/lib/types";
import { calcVolume, calcWorkoutVolume, formatNum } from "@/lib/utils";
import GlassCard from "@/components/GlassCard";

interface SessionListProps {
  workouts: WorkoutSession[];
  selectedSession: WorkoutSession | null;
  onSelect: (session: WorkoutSession) => void;
  onDelete?: (sessionId: string) => void;
  onAddType: () => void;
}

function getSessionDurationLabel(workout: WorkoutSession): string {
  if (workout.duration) return workout.duration;
  if (
    workout.firstSetStartedAt !== undefined &&
    workout.lastSetEndedAt !== undefined
  ) {
    const durationMs = Math.max(0, workout.lastSetEndedAt - workout.firstSetStartedAt);
    return `${Math.round(durationMs / 60000)} min`;
  }

  return "--";
}

export default function SessionList({
  workouts,
  selectedSession,
  onSelect,
  onDelete,
  onAddType,
}: SessionListProps) {
  const sorted = [...workouts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="w-full shrink-0 flex flex-col gap-3 md:w-[320px] md:flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <span
          className="font-mono text-[9px] uppercase tracking-[0.15em] text-white/40"
        >
          Sessions
        </span>
        <button
          onClick={onAddType}
          className="font-mono text-[9px] uppercase tracking-wider px-4 py-2.5 min-h-[44px] flex items-center rounded-lg cursor-pointer"
          style={{
            background: "rgba(255,45,45,0.1)",
            border: "1px solid rgba(255,45,45,0.25)",
            color: "#ff2d2d",
          }}
        >
          + Add Type
        </button>
      </div>

      {/* Session cards */}
      <div className="flex flex-col gap-2 max-h-[60vh] md:max-h-none overflow-y-auto">
        {sorted.length === 0 && (
          <div className="text-sm text-white/30 text-center py-8">
            No sessions logged yet
          </div>
        )}

        {sorted.map((workout, index) => {
          const isSelected = selectedSession?.id === workout.id;
          const volume = calcWorkoutVolume(workout);
          const exerciseCount = workout.exercises.length;
          const setCount = workout.exercises.reduce(
            (sum, ex) => sum + ex.sets.length,
            0
          );
          const durationLabel = getSessionDurationLabel(workout);

          // Volume per exercise for mini bars
          const exerciseVolumes = workout.exercises.map((ex) =>
            calcVolume(ex.sets)
          );
          const maxExVolume = Math.max(...exerciseVolumes, 1);

          return (
            <GlassCard
              key={workout.id}
              hover
              onClick={() => onSelect(workout)}
              className="p-4 cursor-pointer"
              style={{
                animation: `slideInLeft 0.4s ease both`,
                animationDelay: `${index * 0.06}s`,
                ...(isSelected
                  ? {
                      background: "rgba(255,45,45,0.06)",
                      border: "1px solid rgba(255,45,45,0.35)",
                    }
                  : {}),
              }}
            >
              {/* Top row: date + type badge + delete */}
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-sm font-semibold"
                  style={{
                    fontFamily: "var(--font-sans)",
                    color: isSelected ? "#ff2d2d" : "rgba(255,255,255,0.9)",
                  }}
                >
                  {new Date(workout.date + "T00:00:00").toLocaleDateString(
                    "en-US",
                    {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }
                  )}
                </span>
                <div className="flex items-center gap-1.5">
                  <span
                    className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      color: "rgba(255,255,255,0.5)",
                    }}
                  >
                    {workout.type}
                  </span>
                  {onDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!confirm("Delete this workout session and all its exercises?")) return;
                        onDelete(workout.id);
                      }}
                      className="ml-1 flex items-center justify-center rounded-md cursor-pointer"
                      style={{
                        width: 28,
                        height: 28,
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: "rgba(255,255,255,0.3)",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "#ff2d2d";
                        e.currentTarget.style.borderColor = "rgba(255,45,45,0.3)";
                        e.currentTarget.style.background = "rgba(255,45,45,0.08)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "rgba(255,255,255,0.3)";
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                        e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                      }}
                      aria-label="Delete workout"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Stats row */}
              <div className="flex gap-4 mb-3">
                <div>
                  <span className="font-mono text-[8px] uppercase tracking-wider text-white/30 block">
                    Volume
                  </span>
                  <span className="text-xs text-white/70">
                    {formatNum(volume)} lb
                  </span>
                </div>
                <div>
                  <span className="font-mono text-[8px] uppercase tracking-wider text-white/30 block">
                    Exercises
                  </span>
                  <span className="text-xs text-white/70">{exerciseCount}</span>
                </div>
                <div>
                  <span className="font-mono text-[8px] uppercase tracking-wider text-white/30 block">
                    Sets
                  </span>
                  <span className="text-xs text-white/70">{setCount}</span>
                </div>
                <div>
                  <span className="font-mono text-[8px] uppercase tracking-wider text-white/30 block">
                    Duration
                  </span>
                  <span className="text-xs text-white/70">{durationLabel}</span>
                </div>
              </div>

              {/* Mini volume bars */}
              <div className="flex items-end gap-1 h-4">
                {exerciseVolumes.map((vol, i) => (
                  <div
                    key={i}
                    className="rounded-sm flex-1"
                    style={{
                      height: `${Math.max((vol / maxExVolume) * 100, 8)}%`,
                      background: isSelected
                        ? `rgba(255,45,45,${0.2 + (vol / maxExVolume) * 0.4})`
                        : `rgba(255,255,255,${0.06 + (vol / maxExVolume) * 0.12})`,
                      transition: "all 0.3s ease",
                    }}
                  />
                ))}
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
