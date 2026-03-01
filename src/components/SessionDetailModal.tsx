"use client";

import { useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Portal from "@/components/Portal";
import SessionDetail from "@/components/SessionDetail";
import type { WorkoutSession } from "@/lib/types";

interface SessionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  workout: WorkoutSession | null;
  allWorkouts: WorkoutSession[];
}

export default function SessionDetailModal({
  isOpen,
  onClose,
  workout,
  allWorkouts,
}: SessionDetailModalProps) {
  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const handleContentClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <Portal>
      <AnimatePresence>
        {isOpen && workout && (
          <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto">
            {/* Backdrop */}
            <motion.button
              type="button"
              aria-label="Close session detail"
              className="absolute inset-0 cursor-pointer"
              style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
              onClick={onClose}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />

            {/* Modal content */}
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Workout session details"
              className="relative w-full max-w-[900px] mx-4 my-8"
              onClick={handleContentClick}
              initial={{ opacity: 0, scale: 0.97, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 12 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              <div
                className="rounded-3xl overflow-hidden"
                style={{
                  background: "rgba(10,10,10,0.98)",
                  backdropFilter: "blur(24px)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  boxShadow: "0 0 60px rgba(0,0,0,0.5)",
                }}
              >
                {/* Header bar */}
                <div
                  className="px-5 py-4 flex items-center justify-between"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full animate-pulse"
                      style={{ background: "#ff2d2d" }}
                    />
                    <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-white/40">
                      Session Detail
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="shrink-0 w-8 h-8 rounded-lg cursor-pointer flex items-center justify-center"
                    style={{
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.03)",
                      color: "rgba(255,255,255,0.7)",
                    }}
                    aria-label="Close session detail"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                {/* Session detail content */}
                <div className="p-5">
                  <SessionDetail workout={workout} allWorkouts={allWorkouts} />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
