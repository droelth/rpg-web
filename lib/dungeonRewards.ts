import type { Item, ItemRarity } from "@/types/item";
import { allCatalogItems, itemsForClass } from "@/lib/items";

/** Dungeon drop table (final stage only). */
const RARITY_WEIGHTS: { rarity: ItemRarity; cumulative: number }[] = [
  { rarity: "common", cumulative: 55 },
  { rarity: "uncommon", cumulative: 80 },
  { rarity: "rare", cumulative: 93 },
  { rarity: "epic", cumulative: 99 },
  { rarity: "legendary", cumulative: 100 },
];

export function rollDungeonItemRarity(): ItemRarity {
  const roll = Math.random() * 100;
  for (const row of RARITY_WEIGHTS) {
    if (roll < row.cumulative) return row.rarity;
  }
  return "legendary";
}

function pickRandomItemFromPool(pool: Item[]): Item {
  return pool[Math.floor(Math.random() * pool.length)]!;
}

/** Prefer class-filtered catalog; fall back if pool is empty. */
export function pickRandomDungeonCatalogItem(classId: string | null): Item {
  let pool = itemsForClass(classId);
  if (pool.length === 0) {
    pool = allCatalogItems();
  }
  return pickRandomItemFromPool(pool);
}

export type DungeonDrop = {
  itemId: string;
  rarity: ItemRarity;
  item: Item;
};

export function rollDungeonDrop(classId: string | null): DungeonDrop {
  const item = pickRandomDungeonCatalogItem(classId);
  const rarity = rollDungeonItemRarity();
  return { itemId: item.id, rarity, item };
}
