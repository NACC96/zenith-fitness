"use client";

interface FilterPillsProps {
  types: string[];
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

export default function FilterPills({
  types,
  activeFilter,
  onFilterChange,
}: FilterPillsProps) {
  return (
    <div
      className="flex items-center gap-1 overflow-x-auto flex-nowrap whitespace-nowrap rounded-full p-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      style={{
        background: "rgba(255, 255, 255, 0.04)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(255, 255, 255, 0.06)",
      }}
    >
      {types.map((type) => {
        const isActive = type === activeFilter;
        return (
          <button
            key={type}
            onClick={() => onFilterChange(type)}
            className={`shrink-0 rounded-full px-4 py-1.5 font-sans text-[13px] font-medium transition-all ${
              isActive
                ? "bg-lime text-black shadow-[0_0_12px_rgba(204,255,0,0.4)]"
                : "bg-transparent text-white/50 hover:text-white/70"
            }`}
          >
            {type}
          </button>
        );
      })}
    </div>
  );
}
