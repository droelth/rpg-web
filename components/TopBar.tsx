"use client";

import type { CombatTotals } from "@/lib/inventoryUtils";

export type TopBarProps = {
  level?: number;
  username: string;
  gold: number;
  energy: number;
  energyMax: number;
  combatTotals: CombatTotals;
};

function CoinIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" className="text-amber-500/35" />
      <circle cx="12" cy="11" r="7.5" className="text-amber-400" />
      <path
        d="M12 8v6M9.5 10.5h5"
        className="text-amber-950"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BoltIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path
        className="text-cyan-300"
        d="M13 2L4 14h6.5L9 22l11-14h-6.5L13 2z"
      />
    </svg>
  );
}

export function TopBar({
  level = 1,
  username,
  gold,
  energy,
  energyMax,
  combatTotals,
}: TopBarProps) {
  return (
    <header className="relative z-20 mx-3 mt-3 shrink-0 rounded-2xl border border-white/10 bg-black/45 px-3 py-2.5 shadow-[0_0_24px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="shrink-0 rounded-lg border border-amber-400/35 bg-amber-500/15 px-2 py-1 text-[11px] font-bold tabular-nums tracking-wide text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.2)]"
            aria-label={`Level ${level}`}
          >
            L{level}
          </span>
          <span className="truncate font-semibold tracking-tight text-zinc-100">
            {username}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div
            className="flex items-center gap-1.5 rounded-lg bg-black/30 px-2 py-1"
            title="Gold"
          >
            <CoinIcon className="h-5 w-5" />
            <span className="text-sm font-bold tabular-nums text-amber-100">
              {gold}
            </span>
          </div>
          <div
            className="flex items-center gap-1.5 rounded-lg bg-black/30 px-2 py-1"
            title="Energy"
          >
            <BoltIcon className="h-5 w-5" />
            <span className="text-sm font-bold tabular-nums text-cyan-100">
              {energy}/{energyMax}
            </span>
          </div>
        </div>
      </div>
      <div
        className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 border-t border-white/5 pt-2 text-[10px] tabular-nums text-zinc-400"
        title="Combat stats"
      >
        <span>
          HP <strong className="text-zinc-200">{combatTotals.hp}</strong>
        </span>
        <span>
          ATK <strong className="text-zinc-200">{combatTotals.atk}</strong>
        </span>
        <span>
          DEF <strong className="text-zinc-200">{combatTotals.def}</strong>
        </span>
        <span>
          CRIT <strong className="text-zinc-200">{combatTotals.crit}</strong>
        </span>
      </div>
    </header>
  );
}
