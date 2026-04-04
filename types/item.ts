export type ItemType = "weapon" | "armor" | "helmet" | "ring";

export type ItemRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type ItemStats = {
  atk?: number;
  def?: number;
  hp?: number;
  crit?: number;
};

export type Item = {
  id: string;
  name: string;
  type: ItemType;
  /** Default / fallback stats (usually matches `common` tier). */
  stats: ItemStats;
  /**
   * When set, combat/UI uses the row for the instance (or catalog) rarity instead of scaling `stats`.
   */
  statsByRarity?: Record<ItemRarity, ItemStats>;
  /** Visual tier; stored only in the item catalog, not in Firebase. */
  rarity: ItemRarity;
  /** If set, item appears in that class’s shop pool only. Omit or empty = any class fallback. */
  classes?: string[];
};

/**
 * One inventory stack row in Firestore. `itemId` is a catalog key in `items`.
 * `rarity` = shop roll when set; omit to use catalog `Item.rarity` in UI.
 */
export type InventoryInstance = {
  instanceId: string;
  itemId: string;
  rarity?: ItemRarity;
};

/** Each slot holds an inventory row’s `instanceId`, or null. */
export type EquippedState = {
  weapon: string | null;
  armor: string | null;
  helmet: string | null;
  ring: string | null;
};

export const EMPTY_EQUIPPED: EquippedState = {
  weapon: null,
  armor: null,
  helmet: null,
  ring: null,
};

export const SLOT_ORDER: ItemType[] = ["weapon", "armor", "helmet", "ring"];
