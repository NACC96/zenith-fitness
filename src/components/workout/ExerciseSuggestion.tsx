// src/components/workout/ExerciseSuggestion.tsx
"use client";

interface ExerciseSuggestionProps {
  suggestion: string | null;
  onAccept: (exerciseName: string) => void;
  onDismiss: () => void;
}

export default function ExerciseSuggestion({
  suggestion,
  onAccept,
  onDismiss,
}: ExerciseSuggestionProps) {
  if (!suggestion) return null;

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
            {suggestion}?
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onDismiss}
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
              onClick={() => onAccept(suggestion)}
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
