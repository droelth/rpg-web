"use client";

import Image from "next/image";
import { useMemo } from "react";
import { INITIAL_USER_ENERGY } from "@/lib/getOrCreateUser";
import { HERO_CLASSES } from "@/lib/heroClasses";
import { ActionButton } from "@/components/ActionButton";
import { TopBar } from "@/components/TopBar";

export type MainMenuProps = {
  username: string;
  gold: number;
  energy: number;
  classId: string | null;
  stats: unknown;
};

function parseCombatStats(stats: unknown): {
  hp: number;
  atk: number;
  def: number;
  crit: number;
} | null {
  if (!stats || typeof stats !== "object") return null;
  const s = stats as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" ? v : null);
  const hp = num(s.hp);
  const atk = num(s.atk);
  const def = num(s.def);
  const crit = num(s.crit);
  if (hp == null || atk == null || def == null || crit == null) return null;
  return { hp, atk, def, crit };
}

function PvpIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 4l4 4-3 10M18 4l-4 4 3 10M12 8v8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DungeonIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20V10l8-6 8 6v10H4z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M9 20v-6h6v6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShopIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10h16l-1 10H5L4 10z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M8 10V7a4 4 0 018 0v3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function InventoryIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 4h8l2 4H6l2-4zM6 8h12v12a2 2 0 01-2 2H8a2 2 0 01-2-2V8z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TavernIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 10h14v8H5v-8zM8 10V6h8v4M9 18v-4h6v4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="9" r="3.5" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M6 19c0-3.3 2.7-6 6-6s6 2.7 6 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MainMenu({
  username,
  gold,
  energy,
  classId,
  stats,
}: MainMenuProps) {
  const energyMax = INITIAL_USER_ENERGY;
  const classLabel = useMemo(() => {
    if (!classId) return "Adventurer";
    return HERO_CLASSES.find((c) => c.id === classId)?.name ?? classId;
  }, [classId]);
  const combat = useMemo(() => parseCombatStats(stats), [stats]);

  const noop = () => {};

  return (
    <div className="relative flex min-h-dvh w-full justify-center overflow-hidden bg-black">
      {/* Background */}
      <div
        className="pointer-events-none absolute inset-0 scale-105 bg-[url('/images/menu-bg.svg')] bg-cover bg-center"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-black/55 backdrop-blur-[2px]" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80"
        aria-hidden
      />

      {/* App column */}
      <div className="relative z-10 flex w-full max-w-md flex-col">
        <TopBar
          level={1}
          username={username}
          gold={gold}
          energy={energy}
          energyMax={energyMax}
        />

        {/* Character */}
        <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-4">
          <p className="mb-3 text-center text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
            {classLabel}
          </p>
          <div className="relative aspect-[3/4] w-[min(72vw,16rem)] max-w-full">
            <div
              className="absolute inset-0 rounded-3xl shadow-[0_0_0_1px_rgba(255,255,255,0.08),inset_0_0_60px_rgba(0,0,0,0.75),0_20px_50px_rgba(0,0,0,0.6)] ring-1 ring-white/10"
              aria-hidden
            />
            <div className="relative h-full w-full overflow-hidden rounded-3xl">
              <Image
                src="/images/hero.png"
                alt=""
                fill
                className="object-cover object-top"
                sizes="256px"
                priority
                unoptimized
              />
            </div>
          </div>
          {combat ? (
            <p className="mt-4 text-center text-[11px] font-medium tabular-nums tracking-wide text-zinc-400">
              HP {combat.hp} · ATK {combat.atk} · DEF {combat.def} · CRIT{" "}
              {combat.crit}%
            </p>
          ) : null}
        </div>

        {/* Actions */}
        <nav
          className="grid shrink-0 grid-cols-2 gap-3 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2"
          aria-label="Main menu"
        >
          <ActionButton
            label="PvP"
            theme="pvp"
            icon={<PvpIcon />}
            onClick={noop}
          />
          <ActionButton
            label="Dungeon"
            theme="dungeon"
            icon={<DungeonIcon />}
            onClick={noop}
          />
          <ActionButton
            label="Shop"
            theme="shop"
            icon={<ShopIcon />}
            onClick={noop}
          />
          <ActionButton
            label="Inventory"
            theme="inventory"
            icon={<InventoryIcon />}
            onClick={noop}
          />
          <ActionButton
            label="Tavern"
            theme="tavern"
            icon={<TavernIcon />}
            onClick={noop}
          />
          <ActionButton
            label="Profile"
            theme="profile"
            icon={<ProfileIcon />}
            onClick={noop}
          />
        </nav>
      </div>
    </div>
  );
}
