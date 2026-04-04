import type { InventoryInstance, Item, ItemType } from "@/types/item";
import { effectiveItemStatsForInstance } from "@/lib/itemRarityStats";

export function formatItemStatHint(
  item: Item,
  instance?: Pick<InventoryInstance, "rarity"> | null,
): string {
  const s = effectiveItemStatsForInstance(item, instance);
  const p: string[] = [];
  if (s.atk) p.push(`+${s.atk} ATK`);
  if (s.def) p.push(`+${s.def} DEF`);
  if (s.hp) p.push(`+${s.hp} HP`);
  if (s.crit) p.push(`+${s.crit} CRIT`);
  return p.length ? p.join(" · ") : "—";
}

/** Lines like "+3 ATK" for detail panels (scaled by instance rarity when provided). */
export function describeItemStats(
  item: Item,
  instance?: Pick<InventoryInstance, "rarity"> | null,
): string[] {
  const stats = effectiveItemStatsForInstance(item, instance);
  const lines: string[] = [];
  if (stats.atk != null && stats.atk !== 0) {
    lines.push(`+${stats.atk} ATK`);
  }
  if (stats.def != null && stats.def !== 0) {
    lines.push(`+${stats.def} DEF`);
  }
  if (stats.hp != null && stats.hp !== 0) {
    lines.push(`+${stats.hp} HP`);
  }
  if (stats.crit != null && stats.crit !== 0) {
    lines.push(`+${stats.crit} CRIT`);
  }
  return lines;
}

export function slotTypeGlyph(type: ItemType): string {
  switch (type) {
    case "weapon":
      return "⚔";
    case "armor":
      return "🛡";
    case "helmet":
      return "⛑";
    case "ring":
      return "💍";
    default:
      return "◇";
  }
}
