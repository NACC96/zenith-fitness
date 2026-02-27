"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, useMemo } from "react";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const convex = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) return null;
    return new ConvexReactClient(url);
  }, []);

  if (!convex) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center px-6"
        style={{ color: "rgba(255,255,255,0.78)" }}
      >
        <div
          role="alert"
          aria-live="assertive"
          className="max-w-[520px] w-full rounded-2xl p-5 text-center"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(10px)",
          }}
        >
          <h1 className="font-mono text-xs uppercase tracking-widest text-white/45 mb-2">
            Missing Environment Variable
          </h1>
          <p className="text-sm leading-relaxed">
            `NEXT_PUBLIC_CONVEX_URL` is not configured. Add it in your deployment environment
            to enable workout and chat data.
          </p>
        </div>
      </div>
    );
  }
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
