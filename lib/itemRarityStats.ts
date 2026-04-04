import type { InventoryInstance, Item, ItemRarity, ItemStats } from "@/types/item";

/** Multiplier applied to each numeric stat on the catalog item for this rarity tier. */
const RARITY_STAT_MULTIPLIER: Record<ItemRarity, number> = {
  common: 1,
  uncommon: 1.12,
  rare: 1.28,
  epic: 1.48,
  legendary: 1.72,
};

export function effectiveRarityForInstance(
  item: Item,
  instance: Pick<InventoryInstance, "rarity"> | undefined | null,
): ItemRarity {
  return instance?.rarity ?? item.rarity;
}

export function rarityStatMultiplier(rarity: ItemRarity): number {
  return RARITY_STAT_MULTIPLIER[rarity];
}

/**
 * Combat/UI stats for one inventory row: catalog `item.stats` scaled by instance (or catalog) rarity.
 */
export function effectiveItemStatsForInstance(
  item: Item,
  instance: Pick<InventoryInstance, "rarity"> | undefined | null,
): ItemStats {
  const rarity = effectiveRarityForInstance(item, instance);
  const m = RARITY_STAT_MULTIPLIER[rarity];
  const s = item.stats;
  const out: ItemStats = {};
  const scale = (n: number | undefined) =>
    n == null ? undefined : Math.max(0, Math.round(n * m));
  const atk = scale(s.atk);
  const def = scale(s.def);
  const hp = scale(s.hp);
  const crit = scale(s.crit);
  if (atk != null) out.atk = atk;
  if (def != null) out.def = def;
  if (hp != null) out.hp = hp;
  if (crit != null) out.crit = crit;
  return out;
}
