"use client";

import FilterPills from "./FilterPills";

interface HeaderProps {
  types: string[];
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

export default function Header({ types, activeFilter, onFilterChange }: HeaderProps) {
  return (
    <header
      className="flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-10 md:py-6"
      style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}
    >
      {/* Logo + Status row on mobile */}
      <div className="flex items-center justify-between md:contents">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime">
            <span className="text-lg font-semibold text-black">N</span>
          </div>
          <span className="text-lg font-semibold tracking-tight">
            <span className="text-white">IRON</span>
            <span className="text-lime">LOG</span>
          </span>
        </div>

        {/* Right: System Status — inline with logo on mobile */}
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-white/50">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-lime" />
          </span>
          Tracking Active
        </div>
      </div>

      {/* Center: Filter Pills */}
      <FilterPills
        types={types}
        activeFilter={activeFilter}
        onFilterChange={onFilterChange}
      />
    </header>
  );
}
