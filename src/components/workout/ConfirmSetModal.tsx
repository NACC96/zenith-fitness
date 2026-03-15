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
              style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
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
                background: "rgba(24,24,27,0.98)",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 0 40px rgba(0,0,0,0.5)",
              }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            >
              <div className="px-6 pt-6 pb-4 text-center">
                <p className="text-lg font-bold text-white">
                  Log {weight} × {reps}?
                </p>
              </div>

              <div
                className="flex"
                style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
              >
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3.5 text-sm font-medium text-zinc-400 transition-colors active:bg-white/5"
                  style={{ borderRight: "1px solid rgba(255,255,255,0.08)" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="flex-1 py-3.5 text-sm font-semibold text-blue-400 transition-colors active:bg-white/5"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
