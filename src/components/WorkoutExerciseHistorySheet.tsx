"use client";

import { useEffect, useMemo, useState } from "react";
import Portal from "@/components/Portal";
import { formatDuration, formatNum } from "@/lib/utils";

type FeedSet = {
  setNumber: number;
  weight: number;
  reps: number;
  startedAt?: number;
  endedAt?: number;
  restStartedAt?: number;
  restEndedAt?: number;
};

type FeedExercise = {
  name: string;
  sets: FeedSet[];
};

export interface WorkoutExerciseHistorySheetProps {
  isOpen: boolean;
  onClose: () => void;
  exercises: FeedExercise[];
  activeExerciseName: string | null;
  totalSetCount: number;
  totalVolume: number;
}

export default function WorkoutExerciseHistorySheet({
  isOpen,
  onClose,
  exercises,
  activeExerciseName,
  totalSetCount,
  totalVolume,
}: WorkoutExerciseHistorySheetProps) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isOpen) {
      setExpandedRows({});
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const listRows = useMemo(() => {
    return exercises.map((exercise, index) => {
      const rowKey = `${exercise.name}:${index}`;
      const volume = exercise.sets.reduce((sum, set) => sum + set.weight * set.reps, 0);
      const isActive =
        activeExerciseName !== null &&
        exercise.name.toLowerCase() === activeExerciseName.toLowerCase();

      return {
        rowKey,
        exercise,
        volume,
        isActive,
        detailsId: `exercise-history-details-${index}`,
      };
    });
  }, [activeExerciseName, exercises]);

  if (!isOpen) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[90] flex items-end">
        <button
          type="button"
          aria-label="Close exercise history"
          className="absolute inset-0 cursor-pointer"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(2px)" }}
          onClick={onClose}
        />

        <div
          role="dialog"
          aria-modal="true"
          aria-label="Exercise history"
          className="relative z-[91] w-full max-h-[78vh] rounded-t-2xl border-t border-white/[0.12] flex flex-col overflow-hidden"
          style={{
            background: "rgba(10,10,10,0.98)",
            backdropFilter: "blur(24px)",
            boxShadow: "0 -16px 48px rgba(0,0,0,0.55)",
          }}
        >
          <div
            className="shrink-0 px-4 py-3 flex items-start justify-between gap-3"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex flex-col">
              <span
                className="text-sm uppercase tracking-widest"
                style={{ color: "#ebebeb", fontFamily: "var(--font-display)" }}
              >
                Exercise history
              </span>
              <span className="font-mono text-[10px] text-white/45">
                {exercises.length} {exercises.length === 1 ? "exercise" : "exercises"} &middot; {totalSetCount}{" "}
                {totalSetCount === 1 ? "set" : "sets"} &middot; {formatNum(totalVolume)} lbs
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="shrink-0 w-8 h-8 rounded-lg cursor-pointer flex items-center justify-center"
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.03)",
                color: "rgba(255,255,255,0.7)",
              }}
              aria-label="Close exercise history"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                role="img"
                aria-labelledby="exercise-history-close-icon-title"
              >
                <title id="exercise-history-close-icon-title">Close exercise history</title>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div
            className="flex-1 overflow-y-auto px-4 py-3"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1.5rem)" }}
          >
            {listRows.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <span className="font-mono text-xs text-white/35">No exercises logged yet.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {listRows.map(({ rowKey, exercise, volume, isActive, detailsId }) => {
                  const isExpanded = expandedRows[rowKey] ?? false;
                  const setCount = exercise.sets.length;

                  return (
                    <div
                      key={rowKey}
                      className="rounded-xl border overflow-hidden"
                      style={{
                        borderColor: isActive ? "rgba(255,45,45,0.4)" : "rgba(255,255,255,0.08)",
                        background: isActive ? "rgba(255,45,45,0.05)" : "rgba(255,255,255,0.02)",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedRows((prev) => ({
                            ...prev,
                            [rowKey]: !isExpanded,
                          }));
                        }}
                        aria-expanded={isExpanded}
                        aria-controls={detailsId}
                        className="w-full px-3 py-3 flex items-center justify-between gap-3 text-left cursor-pointer"
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          {isActive && (
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#ff2d2d" }} />
                          )}
                          <span
                            className="uppercase truncate"
                            style={{
                              color: "#ebebeb",
                              fontFamily: "var(--font-display)",
                              letterSpacing: "0.04em",
                              fontSize: "16px",
                            }}
                          >
                            {exercise.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-[11px] text-white/45">
                            {setCount} {setCount === 1 ? "set" : "sets"} &middot; {formatNum(volume)} lbs
                          </span>
                          <span className="font-mono text-[12px] text-white/40">{isExpanded ? "−" : "+"}</span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div
                          id={detailsId}
                          role="region"
                          aria-label={`${exercise.name} set details`}
                          className="px-3 pb-3 flex flex-wrap gap-1.5"
                          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                        >
                          {exercise.sets.map((set) => (
                            <div
                              key={`${rowKey}:${set.setNumber}`}
                              className="min-w-[110px] rounded-lg px-2 py-1"
                              style={{
                                border: "1px solid rgba(255,255,255,0.08)",
                                background: "rgba(255,255,255,0.03)",
                              }}
                            >
                              <div className="font-mono text-[11px] text-white/75">
                                <span className="text-white/40">#{set.setNumber}</span> {set.weight}
                                <span className="text-white/35">&times;</span>
                                {set.reps}
                              </div>
                              <div className="font-mono text-[10px] text-white/35">
                                {set.startedAt !== undefined && set.endedAt !== undefined ? (
                                  <span>set {formatDuration(set.endedAt - set.startedAt)}</span>
                                ) : (
                                  <span>&nbsp;</span>
                                )}
                                {set.restStartedAt !== undefined && set.restEndedAt !== undefined && (
                                  <span> &middot; rest {formatDuration(set.restEndedAt - set.restStartedAt)}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
