"use client";

import type { WorkoutSession } from "@/lib/types";
import { calcVolume, calcWorkoutVolume, formatNum } from "@/lib/utils";
import GlassCard from "@/components/GlassCard";

interface SessionListProps {
  workouts: WorkoutSession[];
  selectedSession: WorkoutSession | null;
  onSelect: (session: WorkoutSession) => void;
  onAddType: () => void;
}

export default function SessionList({
  workouts,
  selectedSession,
  onSelect,
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
            background: "rgba(204,255,0,0.1)",
            border: "1px solid rgba(204,255,0,0.25)",
            color: "#ccff00",
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
                      background: "rgba(204,255,0,0.06)",
                      border: "1px solid rgba(204,255,0,0.35)",
                    }
                  : {}),
              }}
            >
              {/* Top row: date + type badge */}
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-sm font-semibold"
                  style={{
                    fontFamily: "var(--font-sans)",
                    color: isSelected ? "#ccff00" : "rgba(255,255,255,0.9)",
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
                <span
                  className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    color: "rgba(255,255,255,0.5)",
                  }}
                >
                  {workout.type}
                </span>
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
                        ? `rgba(204,255,0,${0.2 + (vol / maxExVolume) * 0.4})`
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
