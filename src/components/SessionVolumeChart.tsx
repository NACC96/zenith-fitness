"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatNum } from "@/lib/utils";

interface ChartDataItem {
  name: string;
  volume: number;
}

interface SessionVolumeChartProps {
  data: ChartDataItem[];
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartDataItem }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div
      className="px-3 py-2 rounded-lg font-mono text-xs"
      style={{
        background: "rgba(0,0,0,0.85)",
        border: "1px solid rgba(255,45,45,0.3)",
      }}
    >
      <span className="text-white/70">{item.name}</span>
      <br />
      <span style={{ color: "#ff2d2d" }}>{formatNum(item.volume)} lb</span>
    </div>
  );
}

export default function SessionVolumeChart({ data }: SessionVolumeChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} barCategoryGap="20%">
        <XAxis
          dataKey="name"
          tick={{
            fill: "rgba(255,255,255,0.4)",
            fontSize: 9,
            fontFamily: "var(--font-mono)",
          }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(name: string) => name.length > 12 ? name.slice(0, 12) + "…" : name}
        />
        <YAxis hide />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
        />
        <Bar
          dataKey="volume"
          fill="rgba(255,45,45,0.7)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
