// src/components/workout/TabBar.tsx
"use client";

import { useRef, useCallback } from "react";

interface TabBarProps {
  activeTab: "track" | "chat";
  onTabChange: (tab: "track" | "chat") => void;
}

/**
 * Tab bar with swipe gesture support.
 * Swipe left/right anywhere on the page triggers tab switch.
 * The gesture area is a full-width invisible overlay above the tab bar.
 * Swipe-to-confirm on ExerciseHero uses touchAction: "pan-y" to prevent
 * conflicts (horizontal swipes on that element are captured by SwipeConfirm).
 */
export default function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const startXRef = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startXRef.current;
      const threshold = 50; // minimum swipe distance in px
      if (Math.abs(dx) < threshold) return;

      if (dx < 0 && activeTab === "track") {
        onTabChange("chat");
      } else if (dx > 0 && activeTab === "chat") {
        onTabChange("track");
      }
    },
    [activeTab, onTabChange]
  );

  return (
    <>
      {/* Full-screen swipe detection overlay.
          Covers entire screen above the tab bar. pointer-events: none on children
          is NOT used here — the overlay intercepts horizontal swipes while
          vertical scroll passes through via CSS touch-action: pan-y. */}
      <div
        className="fixed inset-0 bottom-12 z-[9]"
        style={{ touchAction: "pan-y" }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      />

      {/* Tab bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-zinc-800 z-10">
        <div className="flex justify-center gap-12 py-3 pb-safe">
          <button
            type="button"
            onClick={() => onTabChange("track")}
            className={`text-sm font-semibold transition-colors ${
              activeTab === "track" ? "text-white" : "text-zinc-600"
            }`}
          >
            Track
          </button>
          <button
            type="button"
            onClick={() => onTabChange("chat")}
            className={`text-sm font-semibold transition-colors ${
              activeTab === "chat" ? "text-white" : "text-zinc-600"
            }`}
          >
            Chat
          </button>
        </div>
      </div>
    </>
  );
}
