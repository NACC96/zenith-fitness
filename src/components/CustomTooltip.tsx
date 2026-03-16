"use client";

interface TooltipPayloadItem {
  value: number;
  name: string;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  unit?: string;
}

export default function CustomTooltip({
  active,
  payload,
  label,
  unit = "lb",
}: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        background: "rgba(12,12,12,0.95)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(255,45,45,0.2)",
        borderRadius: "12px",
        padding: "10px 14px",
      }}
    >
      <p
        style={{
          color: "#ff2d2d",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "11px",
          margin: 0,
          marginBottom: "4px",
        }}
      >
        {label}
      </p>
      {payload.map((entry, i) => (
        <p
          key={i}
          style={{
            color: "#ebebeb",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "11px",
            margin: 0,
          }}
        >
          {entry.value.toLocaleString("en-US")} {unit}
        </p>
      ))}
    </div>
  );
}
