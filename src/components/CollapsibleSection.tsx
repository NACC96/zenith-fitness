"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GlassCard from "@/components/GlassCard";

interface CollapsibleSectionProps {
  title: string;
  preview: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export default function CollapsibleSection({
  title,
  preview,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <GlassCard
      className="mb-4"
      style={{
        borderLeft: isOpen
          ? "2px solid rgba(255,45,45,0.4)"
          : "2px solid transparent",
        transition: "border-color 0.3s ease",
      }}
    >
      {/* Tappable header */}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 cursor-pointer"
        style={{ background: "none", border: "none" }}
      >
        <p
          className="uppercase tracking-[0.25em] m-0"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "9px",
            color: "rgba(255,255,255,0.3)",
          }}
        >
          {title}
        </p>

        <div className="flex items-center gap-3">
          {/* Preview text — fades out when open */}
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "10px",
              color: "rgba(255,255,255,0.35)",
              opacity: isOpen ? 0 : 1,
              transition: "opacity 0.25s ease",
              whiteSpace: "nowrap",
            }}
          >
            {preview}
          </span>

          {/* Chevron */}
          <motion.svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            style={{ flexShrink: 0 }}
          >
            <path
              d="M3 4.5L6 7.5L9 4.5"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </motion.svg>
        </div>
      </button>

      {/* Collapsible content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
              opacity: { duration: 0.25, delay: 0.1 },
            }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-5 pb-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}
