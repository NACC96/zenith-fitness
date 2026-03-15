"use client";

import { useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Portal from "@/components/Portal";

interface ConfirmSetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  weight: number;
  reps: number;
}

export default function ConfirmSetModal({
  isOpen,
  onClose,
  onConfirm,
  weight,
  reps,
}: ConfirmSetModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const handleConfirm = useCallback(() => {
    onConfirm();
    onClose();
  }, [onConfirm, onClose]);

  return (
    <Portal>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center">
            {/* Backdrop */}
            <motion.button
              type="button"
              aria-label="Close confirmation"
              className="absolute inset-0 cursor-pointer"
              style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)" }}
              onClick={onClose}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />

            {/* Modal */}
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Confirm set"
              className="relative w-full max-w-[280px] mx-4 rounded-2xl overflow-hidden"
              style={{
                background: "rgba(14,14,14,0.98)",
                backdropFilter: "blur(24px)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 0 60px rgba(0,0,0,0.5), 0 0 30px rgba(255,45,45,0.05)",
              }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            >
              <div className="px-6 pt-6 pb-5 text-center">
                <div
                  className="text-[9px] uppercase tracking-[0.2em] mb-3"
                  style={{ fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.35)" }}
                >
                  Confirm Set
                </div>
                <p
                  className="text-xl font-bold text-white"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {weight} × {reps}
                </p>
              </div>

              <div
                className="flex"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
              >
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3.5 text-sm font-medium transition-colors active:bg-white/5"
                  style={{
                    color: "rgba(255,255,255,0.4)",
                    borderRight: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="flex-1 py-3.5 text-sm font-semibold transition-colors active:bg-white/5"
                  style={{
                    color: "#ff2d2d",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  Log It
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
