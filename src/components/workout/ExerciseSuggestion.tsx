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
    <div className="px-4 mt-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="text-xs text-zinc-500 mb-2">NEXT UP</div>
        <div className="flex items-center justify-between">
          <span className="text-white font-medium">{suggestion}?</span>
          <div className="flex gap-2">
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 text-sm text-zinc-500 rounded-lg active:bg-zinc-800"
            >
              Skip
            </button>
            <button
              onClick={() => onAccept(suggestion)}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg active:bg-blue-700"
            >
              Start
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
