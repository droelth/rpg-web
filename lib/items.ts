import type { Item } from "@/types/item";

/**
 * Single source of truth for item definitions.
 * Firebase stores only these IDs in `inventory` and `equipped`.
 */
export const items: Record<string, Item> = {
  warrior_sword_1: {
    id: "warrior_sword_1",
    name: "Iron Sword",
    type: "weapon",
    rarity: "uncommon",
    stats: { atk: 3 },
  },
  warrior_armor_1: {
    id: "warrior_armor_1",
    name: "Leather Armor",
    type: "armor",
    rarity: "common",
    stats: { def: 2 },
  },
};

/** Default inventory for new users / empty inventory (IDs only). */
export const STARTER_INVENTORY_IDS: readonly string[] = [
  "warrior_sword_1",
  "warrior_armor_1",
];

/** Map legacy stored ids to current catalog ids. */
const LEGACY_ITEM_ID_MAP: Record<string, string> = {
  sword_1: "warrior_sword_1",
  armor_1: "warrior_armor_1",
};

/** Normalize any raw id string to a key in `items`, or null if unknown. */
export function canonicalItemId(rawId: string): string | null {
  if (items[rawId]) return rawId;
  const mapped = LEGACY_ITEM_ID_MAP[rawId];
  if (mapped && items[mapped]) return mapped;
  return null;
}

export function resolveItem(id: string): Item | undefined {
  const cid = canonicalItemId(id);
  return cid ? items[cid] : undefined;
}

export function resolveInventory(ids: string[]): Item[] {
  return ids
    .map((id) => resolveItem(id))
    .filter((x): x is Item => x != null);
}

/**
 * Parse Firestore `inventory` field: only string IDs are valid going forward.
 * Migrates legacy full objects or old id strings to canonical catalog ids.
 */
export function parseInventoryIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const el of raw) {
    if (typeof el === "string") {
      const c = canonicalItemId(el);
      if (c) out.push(c);
    } else if (el && typeof el === "object" && typeof (el as { id?: unknown }).id === "string") {
      const c = canonicalItemId((el as { id: string }).id);
      if (c) out.push(c);
    }
  }
  return [...new Set(out)];
}
