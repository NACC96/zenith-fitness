"use client";

import { useState } from "react";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  hover?: boolean;
  onClick?: () => void;
}

export default function GlassCard({
  children,
  className = "",
  style,
  hover = false,
  onClick,
}: GlassCardProps) {
  const [hovered, setHovered] = useState(false);

  const borderColor =
    hover && hovered ? "rgba(255,45,45,0.4)" : "rgba(255,255,255,0.1)";

  return (
    <div
      className={`rounded-[1.5rem] backdrop-blur-[16px] ${className}`}
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${borderColor}`,
        transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
        ...style,
      }}
      onMouseEnter={() => hover && setHovered(true)}
      onMouseLeave={() => hover && setHovered(false)}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
