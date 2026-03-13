"use client";

import { useRef, useEffect, useCallback } from "react";

/**
 * Returns a ref whose `.current` is the formatted timer string (e.g., "24:31").
 * Uses requestAnimationFrame to update ~60fps without causing React re-renders.
 * The consumer component should read `.current` inside its own rAF or
 * use the provided `subscribe` to trigger targeted re-renders.
 */
export function useAnimationTimer(startTimeMs: number | null | undefined) {
  const displayRef = useRef("00:00");
  const rafRef = useRef<number>(0);
  const callbacksRef = useRef<Set<() => void>>(new Set());

  const subscribe = useCallback((cb: () => void) => {
    callbacksRef.current.add(cb);
    return () => {
      callbacksRef.current.delete(cb);
    };
  }, []);

  useEffect(() => {
    if (!startTimeMs) {
      displayRef.current = "00:00";
      return;
    }

    let lastFormatted = "";

    function tick() {
      const elapsed = Math.max(0, Date.now() - startTimeMs!);
      const totalSec = Math.floor(elapsed / 1000);
      const min = Math.floor(totalSec / 60);
      const sec = totalSec % 60;
      const formatted = `${min}:${sec.toString().padStart(2, "0")}`;

      if (formatted !== lastFormatted) {
        lastFormatted = formatted;
        displayRef.current = formatted;
        callbacksRef.current.forEach((cb) => cb());
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
  }, [startTimeMs]);

  return { displayRef, subscribe };
}
