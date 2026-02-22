"use client";

import { motion } from "framer-motion";
import { formatNum } from "@/lib/utils";

interface WorkoutExerciseCardProps {
  exerciseName: string;
  sets: Array<{
    weight: number;
    reps: number;
    setNumber: number;
    startedAt?: number;
    endedAt?: number;
    restStartedAt?: number;
    restEndedAt?: number;
  }>;
  totalVolume: number;
  index?: number;
}

function formatDuration(ms: number): string {
  const safeMs = Math.max(0, ms);
  const minutes = Math.floor(safeMs / 60000);
  const seconds = Math.floor((safeMs % 60000) / 1000);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function WorkoutExerciseCard({
  exerciseName,
  sets,
  totalVolume,
  index = 0,
}: WorkoutExerciseCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden"
    >
      {/* Red left accent border */}
      <div className="flex">
        <div
          className="w-[3px] shrink-0"
          style={{ background: "#ff2d2d" }}
        />

        <div className="flex-1 px-4 py-3">
          {/* Header: exercise name + summary */}
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-sm font-semibold uppercase tracking-wide text-white"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {exerciseName}
            </span>
            <span
              className="text-[10px] text-white/40"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {sets.length} {sets.length === 1 ? "set" : "sets"} &middot;{" "}
              {formatNum(totalVolume)} lbs
            </span>
          </div>

          {/* Set chips */}
          <div className="flex flex-wrap gap-1.5">
            {sets.map((set) => (
              <div
                key={set.setNumber}
                className="font-mono text-xs px-2 py-1 rounded-lg min-w-[110px]"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div>
                  <span className="text-white/30 text-[10px]">
                    {set.setNumber}:
                  </span>{" "}
                  <span className="text-white/70">{set.weight}</span>
                  <span className="text-white/30">&times;</span>
                  <span className="text-white/60">{set.reps}</span>
                </div>
                <div className="text-[9px] text-white/35">
                  {set.startedAt !== undefined && set.endedAt !== undefined ? (
                    <span>set {formatDuration(set.endedAt - set.startedAt)}</span>
                  ) : (
                    <span>&nbsp;</span>
                  )}
                  {set.restStartedAt !== undefined && set.restEndedAt !== undefined && (
                    <span> · rest {formatDuration(set.restEndedAt - set.restStartedAt)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
