"use client";

import Link from "next/link";
import { INITIAL_USER_ENERGY } from "@/lib/getOrCreateUser";
import { ActionButton } from "@/components/ActionButton";
import { TopBar } from "@/components/TopBar";

export type MainMenuProps = {
  username: string;
  gold: number;
  energy: number;
};

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

export function MainMenu({ username, gold, energy }: MainMenuProps) {
  const energyMax = INITIAL_USER_ENERGY;
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
      <div className="relative z-10 flex min-h-dvh w-full max-w-md flex-col">
        <TopBar
          level={1}
          username={username}
          gold={gold}
          energy={energy}
          energyMax={energyMax}
        />

        <div className="min-h-4 flex-1" aria-hidden />

        {/* Actions */}
        <nav
          className="grid shrink-0 grid-cols-2 gap-3 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4"
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
          <Link
            href="/combat-test"
            className="col-span-2 flex w-full items-center justify-center rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-700 via-teal-800 to-cyan-950 py-3.5 text-center text-sm font-semibold tracking-wide text-white shadow-lg transition hover:shadow-[0_0_24px_rgba(34,211,238,0.3)] active:scale-[0.98]"
          >
            Test Combat
          </Link>
        </nav>
      </div>
    </div>
  );
}
