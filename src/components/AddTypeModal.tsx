"use client";

import GlassCard from "@/components/GlassCard";

interface AddTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = ["Shoulders", "Arms", "Core", "Cardio", "Full Body"];

export default function AddTypeModal({ isOpen, onClose }: AddTypeModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <div className="mx-4" onClick={(e) => e.stopPropagation()}>
        <GlassCard className="max-w-[400px] w-full p-6 md:p-8">
          <h3
            className="text-lg font-semibold mb-3"
            style={{ fontFamily: "var(--font-sans)", fontSize: "1.2rem" }}
          >
            Add Workout Type
          </h3>

          <p className="text-sm text-white/50 mb-5 leading-relaxed">
            Zenith uses AI to automatically categorize your workouts as you log
            them. Choose a category below to get started.
          </p>

          {/* Category pills */}
          <div className="flex flex-wrap gap-2 mb-6">
            {CATEGORIES.map((cat) => (
              <div
                key={cat}
                className="px-4 py-3 min-h-[44px] flex items-center rounded-xl text-xs text-white/60 cursor-pointer transition-all hover:text-white/80"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {cat}
              </div>
            ))}
          </div>

          {/* Got It button */}
          <button
            onClick={onClose}
            className="w-full py-3 min-h-[44px] rounded-full font-semibold text-sm cursor-pointer transition-all"
            style={{
              background: "#ccff00",
              color: "#000",
              boxShadow: "0 0 20px rgba(204,255,0,0.25)",
            }}
          >
            Got It
          </button>
        </GlassCard>
      </div>
    </div>
  );
}
