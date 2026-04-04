import type { Item, ItemType } from "@/types/item";

export function formatItemStatHint(item: Item): string {
  const p: string[] = [];
  if (item.stats.atk) p.push(`+${item.stats.atk} ATK`);
  if (item.stats.def) p.push(`+${item.stats.def} DEF`);
  if (item.stats.hp) p.push(`+${item.stats.hp} HP`);
  if (item.stats.crit) p.push(`+${item.stats.crit} CRIT`);
  return p.length ? p.join(" · ") : "—";
}

/** Lines like "+3 ATK" for detail panels. */
export function describeItemStats(item: Item): string[] {
  const lines: string[] = [];
  if (item.stats.atk != null && item.stats.atk !== 0) {
    lines.push(`+${item.stats.atk} ATK`);
  }
  if (item.stats.def != null && item.stats.def !== 0) {
    lines.push(`+${item.stats.def} DEF`);
  }
  if (item.stats.hp != null && item.stats.hp !== 0) {
    lines.push(`+${item.stats.hp} HP`);
  }
  if (item.stats.crit != null && item.stats.crit !== 0) {
    lines.push(`+${item.stats.crit} CRIT`);
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
