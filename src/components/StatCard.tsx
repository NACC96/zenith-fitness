"use client";

import GlassCard from "./GlassCard";

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  accent?: boolean;
  sub?: string;
}

export default function StatCard({
  label,
  value,
  unit,
  accent = false,
  sub,
}: StatCardProps) {
  return (
    <GlassCard hover className="flex-1 min-w-0 md:min-w-[160px]" style={{ padding: "16px 16px" }}>
      <p
        className="uppercase tracking-[0.2em]"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "9px",
          color: "rgba(255,255,255,0.4)",
          margin: 0,
        }}
      >
        {label}
      </p>

      <p
        className="font-bold tracking-tight text-xl md:text-2xl"
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          color: accent ? "#ff2d2d" : "#ebebeb",
          margin: "4px 0 0",
          lineHeight: 1.1,
        }}
      >
        {value}
        {unit && (
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "11px",
              color: "rgba(255,255,255,0.4)",
              marginLeft: "4px",
              verticalAlign: "baseline",
            }}
          >
            {unit}
          </span>
        )}
      </p>

      {sub && (
        <p
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "10px",
            color: "rgba(255,255,255,0.35)",
            marginTop: "6px",
            marginBottom: 0,
          }}
        >
          {sub}
        </p>
      )}
    </GlassCard>
  );
}
