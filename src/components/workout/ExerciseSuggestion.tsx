// src/components/workout/ExerciseSuggestion.tsx
"use client";

interface ExerciseSuggestionProps {
  topSuggestion: string | null;
  allSuggestions: string[];
  showAll: boolean;
  onAccept: (exerciseName: string) => void;
  onSkip: () => void;
}

export default function ExerciseSuggestion({
  topSuggestion,
  allSuggestions,
  showAll,
  onAccept,
  onSkip,
}: ExerciseSuggestionProps) {
  if (!topSuggestion && allSuggestions.length === 0) return null;

  // After skipping — show the full list
  if (showAll) {
    return (
      <div className="px-5 mt-4">
        <div
          className="text-[9px] uppercase tracking-[0.2em] mb-3"
          style={{ fontFamily: "var(--font-mono)", color: "#ff2d2d" }}
        >
          Pick an Exercise
        </div>
        <div
          className="rounded-[1.5rem] backdrop-blur-[16px] overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {allSuggestions.map((name, i) => (
            <button
              key={name}
              type="button"
              onClick={() => onAccept(name)}
              className="w-full flex items-center justify-between px-5 py-3.5 text-left transition-all active:bg-white/5"
              style={{
                borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none",
              }}
            >
              <span
                className="text-sm text-white font-medium"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {name}
              </span>
              <span
                className="text-[10px] uppercase tracking-wider"
                style={{ fontFamily: "var(--font-mono)", color: "#ff2d2d" }}
              >
                Start
              </span>
            </button>
          ))}
          {allSuggestions.length === 0 && (
            <div className="px-5 py-4 text-center">
              <span
                className="text-sm"
                style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-display)" }}
              >
                No more suggestions
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Default — show top suggestion with Skip/Start
  if (!topSuggestion) return null;

  return (
    <div className="px-5 mt-4">
      <div
        className="rounded-[1.5rem] backdrop-blur-[16px] p-5"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          className="text-[9px] uppercase tracking-[0.2em] mb-3"
          style={{ fontFamily: "var(--font-mono)", color: "#ff2d2d" }}
        >
          Next Up
        </div>
        <div className="flex items-center justify-between">
          <span
            className="text-white font-semibold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {topSuggestion}?
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSkip}
              className="px-4 py-2 text-sm rounded-lg transition-all active:scale-95"
              style={{
                color: "rgba(255,255,255,0.4)",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => onAccept(topSuggestion)}
              className="px-4 py-2 text-sm font-semibold rounded-lg transition-all active:scale-95"
              style={{
                background: "rgba(255,45,45,0.15)",
                border: "1px solid rgba(255,45,45,0.3)",
                color: "#ff2d2d",
              }}
            >
              Start
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
