"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import GlassCard from "@/components/GlassCard";

interface AddTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESETS = ["Shoulders", "Arms", "Core", "Cardio", "Full Body"];

export default function AddTypeModal({ isOpen, onClose }: AddTypeModalProps) {
  const [customName, setCustomName] = useState("");
  const createType = useMutation(api.workoutTypes.create);

  if (!isOpen) return null;

  const handlePreset = async (name: string) => {
    await createType({ name });
    onClose();
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customName.trim();
    if (!trimmed) return;
    await createType({ name: trimmed });
    setCustomName("");
    onClose();
  };

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
            Choose a preset category or create your own custom type.
          </p>

          {/* Preset pills */}
          <div className="flex flex-wrap gap-2 mb-6">
            {PRESETS.map((cat) => (
              <button
                key={cat}
                onClick={() => handlePreset(cat)}
                className="px-4 py-3 min-h-[44px] flex items-center rounded-xl text-xs text-white/60 cursor-pointer transition-all hover:text-white/80 hover:border-white/20"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Custom type input */}
          <form onSubmit={handleCustomSubmit} className="mb-6">
            <label className="block text-xs text-white/40 uppercase tracking-widest font-mono mb-2">
              Custom Type
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Olympic Lifts"
                className="flex-1 rounded-xl px-4 py-3 text-sm outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#ebebeb",
                  fontFamily: "var(--font-sans)",
                  fontSize: "14px",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "rgba(204,255,0,0.4)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                }}
              />
              <button
                type="submit"
                disabled={!customName.trim()}
                className="shrink-0 px-5 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                style={{
                  background: "#ccff00",
                  color: "#000",
                  boxShadow: customName.trim()
                    ? "0 0 16px rgba(204,255,0,0.25)"
                    : "none",
                }}
              >
                Add
              </button>
            </div>
          </form>

          {/* Cancel button */}
          <button
            onClick={onClose}
            className="w-full py-3 min-h-[44px] rounded-full text-sm cursor-pointer transition-all text-white/50 hover:text-white/70"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            Cancel
          </button>
        </GlassCard>
      </div>
    </div>
  );
}
