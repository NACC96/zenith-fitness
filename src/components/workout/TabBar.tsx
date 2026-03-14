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
  );
}
