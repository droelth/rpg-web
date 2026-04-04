import type { Item, ItemRarity } from "@/types/item";

/** Base border + glow per rarity (spec). */
export const rarityStyles: Record<ItemRarity, string> = {
  common: "border-gray-500",
  uncommon: "border-green-500 shadow-green-500/30",
  rare: "border-blue-500 shadow-blue-500/40",
  epic: "border-purple-500 shadow-purple-500/50",
  legendary: "border-orange-500 shadow-orange-500/60",
};

export const rarityLabelClass: Record<ItemRarity, string> = {
  common: "text-zinc-400",
  uncommon: "text-green-400",
  rare: "text-blue-400",
  epic: "text-purple-400",
  legendary: "text-orange-400",
};

const rarityHoverGlow: Record<ItemRarity, string> = {
  common: "hover:shadow-lg hover:shadow-zinc-500/25",
  uncommon: "hover:shadow-xl hover:shadow-green-500/45",
  rare: "hover:shadow-xl hover:shadow-blue-500/50",
  epic: "hover:shadow-xl hover:shadow-purple-500/55",
  legendary: "hover:shadow-xl hover:shadow-orange-500/60",
};

const raritySelectedRing: Record<ItemRarity, string> = {
  common: "ring-2 ring-gray-400/60 shadow-lg shadow-gray-500/35",
  uncommon: "ring-2 ring-green-400/70 shadow-xl shadow-green-500/50",
  rare: "ring-2 ring-blue-400/70 shadow-xl shadow-blue-500/55",
  epic: "ring-2 ring-purple-400/70 shadow-xl shadow-purple-500/60",
  legendary: "ring-2 ring-orange-400/70 shadow-xl shadow-orange-500/65",
};

export function getItemRarity(item: Item): ItemRarity {
  return item.rarity;
}

export function itemCardClassNames(
  rarity: ItemRarity,
  opts: { selected?: boolean; interactive?: boolean },
): string {
  const { selected, interactive } = opts;
  const base = [
    "rounded-xl border-2 bg-gradient-to-b from-zinc-900/95 via-zinc-950/90 to-black/85",
    "backdrop-blur-md backdrop-saturate-150",
    "shadow-md shadow-black/50 transition-all duration-200 ease-out",
    rarityStyles[rarity],
  ];
  if (interactive) {
    base.push(
      "hover:scale-105 hover:border-opacity-100",
      rarityHoverGlow[rarity],
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60",
    );
  }
  if (selected) {
    base.push(
      "scale-[1.02] border-2 bg-zinc-900/95",
      "from-violet-950/30 via-zinc-950/95 to-black/90",
      raritySelectedRing[rarity],
    );
  }
  return base.filter(Boolean).join(" ");
}
