// src/components/workout/TabBar.tsx
"use client";

import { useRef, useCallback } from "react";

interface TabBarProps {
  activeTab: "track" | "chat";
  onTabChange: (tab: "track" | "chat") => void;
}

/** Hook to detect horizontal swipes for tab switching. */
export function useTabSwipe(
  activeTab: "track" | "chat",
  onTabChange: (tab: "track" | "chat") => void
) {
  const startXRef = useRef(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startXRef.current;
      if (Math.abs(dx) < 50) return;
      if (dx < 0 && activeTab === "track") onTabChange("chat");
      else if (dx > 0 && activeTab === "chat") onTabChange("track");
    },
    [activeTab, onTabChange]
  );

  return { onTouchStart, onTouchEnd };
}

export default function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-10"
      style={{
        background: "rgba(12,12,12,0.9)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex justify-center gap-10 py-4 pb-safe">
        <button
          type="button"
          onClick={() => onTabChange("track")}
          className="text-base font-semibold transition-colors px-4 py-1"
          style={{
            fontFamily: "var(--font-display)",
            color: activeTab === "track" ? "#ff2d2d" : "rgba(255,255,255,0.3)",
            textShadow: activeTab === "track" ? "0 0 20px rgba(255,45,45,0.4)" : "none",
          }}
        >
          Track
        </button>
        <button
          type="button"
          onClick={() => onTabChange("chat")}
          className="text-base font-semibold transition-colors px-4 py-1"
          style={{
            fontFamily: "var(--font-display)",
            color: activeTab === "chat" ? "#ff2d2d" : "rgba(255,255,255,0.3)",
            textShadow: activeTab === "chat" ? "0 0 20px rgba(255,45,45,0.4)" : "none",
          }}
        >
          Chat
        </button>
      </div>
    </div>
  );
}
