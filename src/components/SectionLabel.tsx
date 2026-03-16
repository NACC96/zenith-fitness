"use client";

export default function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="uppercase tracking-[0.25em] mt-8 mb-3"
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "9px",
        color: "rgba(255,255,255,0.3)",
      }}
    >
      {children}
    </p>
  );
}
