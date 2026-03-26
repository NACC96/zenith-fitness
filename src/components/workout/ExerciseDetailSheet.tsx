"use client";

import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { AnimatePresence, motion } from "framer-motion";
import Portal from "@/components/Portal";
import { formatNum } from "@/lib/utils";

interface ExerciseDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  exerciseName: string;
  currentSets: { weight: number; reps: number }[];
  sessionId: Id<"workoutSessions"> | null;
}

export default function ExerciseDetailSheet({
  isOpen,
  onClose,
  exerciseName,
  currentSets,
  sessionId,
}: ExerciseDetailSheetProps) {
  const previous = useQuery(
    api.exercises.getPreviousExercise,
    isOpen && sessionId ? { sessionId, exerciseName } : "skip"
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const currentVolume = currentSets.reduce((s, set) => s + set.weight * set.reps, 0);
  const prevSets = previous?.sets ?? [];
  const prevVolume = prevSets.reduce((s, set) => s + set.weight * set.reps, 0);
  const maxRows = Math.max(currentSets.length, prevSets.length);
  const volumeDiff = currentVolume - prevVolume;

  return (
    <Portal>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center">
            {/* Backdrop */}
            <motion.button
              type="button"
              aria-label="Close detail"
              className="absolute inset-0 cursor-pointer"
              style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)" }}
              onClick={onClose}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />

            {/* Sheet */}
            <motion.div
              role="dialog"
              aria-modal="true"
              className="relative w-full max-w-md rounded-t-3xl overflow-hidden"
              style={{
                background: "rgba(14,14,14,0.98)",
                backdropFilter: "blur(24px)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderBottom: "none",
                boxShadow: "0 -10px 60px rgba(0,0,0,0.5)",
                maxHeight: "80dvh",
              }}
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
              </div>

              <div className="px-5 pt-2 pb-6 overflow-y-auto" style={{ maxHeight: "calc(80dvh - 20px)" }}>
                {/* Title */}
                <h3
                  className="text-lg font-bold text-white mb-1"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {exerciseName}
                </h3>
                <p
                  className="text-[10px] uppercase tracking-[0.15em] mb-5"
                  style={{ fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.35)" }}
                >
                  {currentSets.length} sets today
                  {previous ? ` · ${prevSets.length} sets last time` : ""}
                </p>

                {/* Set-by-set comparison table */}
                <div
                  className="rounded-xl overflow-hidden mb-5"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {/* Header */}
                  <div
                    className="flex px-4 py-2.5"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <span
                      className="w-12 text-[9px] uppercase tracking-[0.15em]"
                      style={{ fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.3)" }}
                    >
                      Set
                    </span>
                    <span
                      className="flex-1 text-[9px] uppercase tracking-[0.15em] text-center"
                      style={{ fontFamily: "var(--font-mono)", color: "#ff2d2d" }}
                    >
                      Today
                    </span>
                    <span
                      className="flex-1 text-[9px] uppercase tracking-[0.15em] text-center"
                      style={{ fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.3)" }}
                    >
                      Last
                    </span>
                  </div>

                  {/* Rows */}
                  {Array.from({ length: maxRows }).map((_, i) => {
                    const cur = currentSets[i];
                    const prev = prevSets[i];
                    const better = cur && prev && cur.weight > prev.weight;
                    const worse = cur && prev && cur.weight < prev.weight;

                    return (
                      <div
                        key={i}
                        className="flex items-center px-4 py-3"
                        style={{
                          borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none",
                        }}
                      >
                        <span
                          className="w-12 text-[11px] tabular-nums"
                          style={{ fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.3)" }}
                        >
                          {i + 1}
                        </span>
                        <span
                          className="flex-1 text-center text-sm tabular-nums font-medium"
                          style={{
                            fontFamily: "var(--font-mono)",
                            color: cur
                              ? better
                                ? "#10b981"
                                : worse
                                  ? "#ff2d2d"
                                  : "rgba(255,255,255,0.8)"
                              : "rgba(255,255,255,0.15)",
                          }}
                        >
                          {cur ? `${cur.weight}×${cur.reps}` : "—"}
                        </span>
                        <span
                          className="flex-1 text-center text-sm tabular-nums"
                          style={{
                            fontFamily: "var(--font-mono)",
                            color: prev ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.15)",
                          }}
                        >
                          {prev ? `${prev.weight}×${prev.reps}` : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Volume comparison */}
                <div
                  className="rounded-xl p-4"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    className="text-[9px] uppercase tracking-[0.2em] mb-3"
                    style={{ fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.35)" }}
                  >
                    Total Volume
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <div
                        className="text-xl font-bold text-white tabular-nums"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {formatNum(currentVolume)} lbs
                      </div>
                      {previous && prevVolume > 0 && (
                        <div
                          className="text-[11px] tabular-nums mt-0.5"
                          style={{
                            fontFamily: "var(--font-mono)",
                            color: "rgba(255,255,255,0.35)",
                          }}
                        >
                          Last: {formatNum(prevVolume)} lbs
                        </div>
                      )}
                    </div>
                    {previous && prevVolume > 0 && (
                      <div
                        className="text-sm font-bold tabular-nums"
                        style={{
                          fontFamily: "var(--font-mono)",
                          color: volumeDiff > 0 ? "#10b981" : volumeDiff < 0 ? "#ff2d2d" : "rgba(255,255,255,0.4)",
                        }}
                      >
                        {volumeDiff > 0 ? "+" : ""}{formatNum(volumeDiff)} lbs
                      </div>
                    )}
                  </div>
                </div>

                {!previous && (
                  <p
                    className="text-center text-[11px] mt-4"
                    style={{ fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.25)" }}
                  >
                    No previous data for this exercise
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
