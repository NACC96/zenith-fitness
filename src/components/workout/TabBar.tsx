// src/components/workout/TabBar.tsx
"use client";

import { useRef, useCallback, useState, useEffect } from "react";

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
  const [showHint, setShowHint] = useState(true);

  // Fade out hint after 3 seconds or on first tab switch
  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleTabChange = useCallback(
    (tab: "track" | "chat") => {
      setShowHint(false);
      onTabChange(tab);
    },
    [onTabChange]
  );

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
      {/* Swipe hint */}
      <div
        className="flex items-center justify-center gap-1.5 pt-2"
        style={{
          opacity: showHint ? 1 : 0,
          transition: "opacity 0.8s ease",
          pointerEvents: "none",
        }}
      >
        <svg
          width="10" height="6" viewBox="0 0 10 6" fill="none"
          style={{ opacity: activeTab === "track" ? 0.15 : 0.35, transition: "opacity 0.3s" }}
        >
          <path d="M6 3L1 0.5V5.5L6 3Z" fill="white" />
        </svg>
        <div
          className="flex gap-[3px]"
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-[3px] h-[3px] rounded-full"
              style={{
                background: `rgba(255,255,255,${i === 1 ? 0.25 : 0.12})`,
              }}
            />
          ))}
        </div>
        <svg
          width="10" height="6" viewBox="0 0 10 6" fill="none"
          style={{ opacity: activeTab === "chat" ? 0.15 : 0.35, transition: "opacity 0.3s" }}
        >
          <path d="M4 3L9 0.5V5.5L4 3Z" fill="white" />
        </svg>
      </div>

      <div className="flex justify-center gap-10 py-3 pb-safe">
        <button
          type="button"
          onClick={() => handleTabChange("track")}
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
          onClick={() => handleTabChange("chat")}
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
