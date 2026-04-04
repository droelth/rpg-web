"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type ActionTheme =
  | "pvp"
  | "dungeon"
  | "shop"
  | "forge"
  | "inventory"
  | "tavern"
  | "profile";

const THEME_STYLES: Record<
  ActionTheme,
  { gradient: string; glow: string; border: string }
> = {
  pvp: {
    gradient:
      "from-sky-600 via-blue-700 to-indigo-950 hover:from-sky-500 hover:via-blue-600 hover:to-indigo-900",
    glow: "hover:shadow-[0_0_28px_rgba(56,189,248,0.35)]",
    border: "border-sky-400/25",
  },
  dungeon: {
    gradient:
      "from-zinc-600 via-zinc-800 to-zinc-950 hover:from-zinc-500 hover:via-zinc-700 hover:to-zinc-900",
    glow: "hover:shadow-[0_0_28px_rgba(161,161,170,0.25)]",
    border: "border-zinc-500/30",
  },
  shop: {
    gradient:
      "from-amber-600 via-yellow-700 to-amber-950 hover:from-amber-500 hover:via-yellow-600 hover:to-amber-900",
    glow: "hover:shadow-[0_0_28px_rgba(251,191,36,0.35)]",
    border: "border-amber-400/30",
  },
  forge: {
    gradient:
      "from-orange-700 via-orange-900 to-stone-950 hover:from-orange-600 hover:via-orange-800 hover:to-stone-900",
    glow: "hover:shadow-[0_0_28px_rgba(249,115,22,0.35)]",
    border: "border-orange-400/30",
  },
  inventory: {
    gradient:
      "from-violet-600 via-purple-800 to-violet-950 hover:from-violet-500 hover:via-purple-700 hover:to-violet-900",
    glow: "hover:shadow-[0_0_28px_rgba(167,139,250,0.35)]",
    border: "border-violet-400/25",
  },
  tavern: {
    gradient:
      "from-red-600 via-orange-600 to-red-950 hover:from-red-500 hover:via-orange-500 hover:to-red-900",
    glow: "hover:shadow-[0_0_28px_rgba(248,113,113,0.35)]",
    border: "border-orange-400/25",
  },
  profile: {
    gradient:
      "from-zinc-500 via-zinc-600 to-zinc-800 hover:from-zinc-400 hover:via-zinc-500 hover:to-zinc-700",
    glow: "hover:shadow-[0_0_24px_rgba(228,228,231,0.2)]",
    border: "border-zinc-400/20",
  },
};

export type ActionButtonProps = {
  label: string;
  theme: ActionTheme;
  icon: ReactNode;
  onClick?: () => void;
  /** When set, renders a Next.js `Link` (preferred for in-app routes). */
  href?: string;
};

export function ActionButton({
  label,
  theme,
  icon,
  onClick,
  href,
}: ActionButtonProps) {
  const t = THEME_STYLES[theme];
  const className = [
    "flex w-full items-center gap-3 rounded-2xl border bg-gradient-to-br px-4 py-4 text-left shadow-lg transition-all duration-200",
    "active:scale-[0.98] active:brightness-95",
    t.gradient,
    t.glow,
    t.border,
  ].join(" ");

  const content = (
    <>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black/25 text-white shadow-inner ring-1 ring-white/10">
        {icon}
      </span>
      <span className="font-semibold tracking-wide text-white drop-shadow-sm">
        {label}
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}
