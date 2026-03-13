"use client";

import { useRef, useState, useCallback, ReactNode } from "react";

interface SwipeConfirmProps {
  onConfirm: () => void;
  children: ReactNode;
  threshold?: number; // percentage of width to trigger (default 60)
  disabled?: boolean;
}

export default function SwipeConfirm({
  onConfirm,
  children,
  threshold = 60,
  disabled = false,
}: SwipeConfirmProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const confirmedRef = useRef(false);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
      confirmedRef.current = false;
      startXRef.current = e.touches[0].clientX;
      setIsDragging(true);
    },
    [disabled]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging || disabled) return;
      const dx = Math.max(0, e.touches[0].clientX - startXRef.current);
      setDragX(dx);
    },
    [isDragging, disabled]
  );

  const handleTouchEnd = useCallback(() => {
    if (!isDragging || disabled) return;
    setIsDragging(false);

    const containerWidth = containerRef.current?.offsetWidth ?? 300;
    const pct = (dragX / containerWidth) * 100;

    if (pct >= threshold && !confirmedRef.current) {
      confirmedRef.current = true;
      onConfirm();
    }

    setDragX(0);
  }, [isDragging, disabled, dragX, threshold, onConfirm]);

  const containerWidth = containerRef.current?.offsetWidth ?? 300;
  const pct = (dragX / containerWidth) * 100;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative overflow-hidden rounded-xl"
      style={{ touchAction: "pan-y" }}
    >
      {/* Progress fill */}
      <div
        className="absolute inset-0 rounded-xl transition-colors"
        style={{
          background: pct >= threshold
            ? "rgba(34, 197, 94, 0.3)"
            : "rgba(37, 99, 235, 0.2)",
          width: `${Math.min(pct, 100)}%`,
        }}
      />

      {/* Content */}
      <div className="relative">{children}</div>

      {/* Arrow hint */}
      {!isDragging && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 text-sm">
          →
        </div>
      )}
    </div>
  );
}
