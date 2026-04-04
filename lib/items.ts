import type {
  InventoryInstance,
  Item,
  ItemRarity,
  ItemStats,
  ItemType,
} from "@/types/item";
import { SLOT_ORDER } from "@/types/item";

const ITEM_RARITIES: readonly ItemRarity[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
];

function isValidItemRarity(v: unknown): v is ItemRarity {
  return typeof v === "string" && ITEM_RARITIES.includes(v as ItemRarity);
}

/** Per-slot stat rows: common → legendary (epic = “unique” in design docs). */
type ClassTierTable = Record<ItemType, Record<ItemRarity, ItemStats>>;

function buildClassGear(
  cls: string,
  names: Record<ItemType, string>,
  tiersBySlot: ClassTierTable,
): Record<string, Item> {
  const out: Record<string, Item> = {};
  for (const type of SLOT_ORDER) {
    const tiers = tiersBySlot[type];
    const id = `${cls}_${type}`;
    out[id] = {
      id,
      name: names[type],
      type,
      rarity: "common",
      classes: [cls],
      stats: { ...tiers.common },
      statsByRarity: {
        common: { ...tiers.common },
        uncommon: { ...tiers.uncommon },
        rare: { ...tiers.rare },
        epic: { ...tiers.epic },
        legendary: { ...tiers.legendary },
      },
    };
  }
  return out;
}

/** Warrior (balanced bruiser) — design table. */
const WARRIOR_TIERS: ClassTierTable = {
  weapon: {
    common: { atk: 3 },
    uncommon: { atk: 5 },
    rare: { atk: 7, def: 2 },
    epic: { atk: 10, def: 3 },
    legendary: { atk: 13, def: 4 },
  },
  armor: {
    common: { def: 2 },
    uncommon: { def: 3 },
    rare: { def: 5, hp: 3 },
    epic: { def: 7, hp: 5 },
    legendary: { def: 10, hp: 8 },
  },
  helmet: {
    common: { hp: 3 },
    uncommon: { hp: 5 },
    rare: { hp: 7, def: 1 },
    epic: { hp: 10, def: 2 },
    legendary: { hp: 14, def: 3 },
  },
  ring: {
    common: { crit: 1 },
    uncommon: { crit: 2 },
    rare: { crit: 3, atk: 1 },
    epic: { crit: 5, atk: 2 },
    legendary: { crit: 7, atk: 3 },
  },
};

/** Mage — design table. */
const MAGE_TIERS: ClassTierTable = {
  weapon: {
    common: { atk: 4 },
    uncommon: { atk: 6 },
    rare: { atk: 8, crit: 2 },
    epic: { atk: 11, crit: 4 },
    legendary: { atk: 14, crit: 6 },
  },
  armor: {
    common: { def: 1 },
    uncommon: { def: 2 },
    rare: { def: 3, hp: 2 },
    epic: { def: 4, hp: 4 },
    legendary: { def: 6, hp: 6 },
  },
  helmet: {
    common: { def: 1 },
    uncommon: { def: 2 },
    rare: { def: 3, hp: 2 },
    epic: { def: 4, hp: 4 },
    legendary: { def: 6, hp: 6 },
  },
  ring: {
    common: { crit: 1 },
    uncommon: { crit: 2 },
    rare: { crit: 4 },
    epic: { crit: 6, atk: 2 },
    legendary: { crit: 10, atk: 4 },
  },
};

/** Ranger (crit / hybrid) — design table. */
const RANGER_TIERS: ClassTierTable = {
  weapon: {
    common: { atk: 4 },
    uncommon: { atk: 6 },
    rare: { atk: 8, crit: 3 },
    epic: { atk: 11, crit: 5 },
    legendary: { atk: 14, crit: 7 },
  },
  armor: {
    common: { def: 1 },
    uncommon: { def: 2 },
    rare: { def: 3, hp: 2 },
    epic: { def: 4, hp: 4 },
    legendary: { def: 6, hp: 6 },
  },
  helmet: {
    common: { crit: 2 },
    uncommon: { crit: 3 },
    rare: { crit: 5, hp: 2 },
    epic: { crit: 7, hp: 3 },
    legendary: { crit: 10, hp: 5 },
  },
  ring: {
    common: { crit: 2 },
    uncommon: { crit: 3 },
    rare: { crit: 5, atk: 2 },
    epic: { crit: 7, atk: 3 },
    legendary: { crit: 10, atk: 4 },
  },
};

/** Paladin (tank / sustain) — design table. */
const PALADIN_TIERS: ClassTierTable = {
  weapon: {
    common: { atk: 2 },
    uncommon: { atk: 3 },
    rare: { atk: 4, def: 2 },
    epic: { atk: 6, def: 3 },
    legendary: { atk: 8, def: 4 },
  },
  armor: {
    common: { def: 3 },
    uncommon: { def: 5 },
    rare: { def: 7, hp: 4 },
    epic: { def: 10, hp: 7 },
    legendary: { def: 14, hp: 10 },
  },
  helmet: {
    common: { hp: 4 },
    uncommon: { hp: 6 },
    rare: { hp: 9, def: 2 },
    epic: { hp: 12, def: 3 },
    legendary: { hp: 16, def: 4 },
  },
  ring: {
    common: { hp: 3 },
    uncommon: { hp: 5 },
    rare: { hp: 7, def: 1 },
    epic: { hp: 10, def: 2 },
    legendary: { hp: 14, def: 3 },
  },
};

/**
 * Single source of truth for item definitions.
 * Inventory rows are `InventoryInstance`; equipped slots reference `instanceId`.
 * Each class has one catalog id per slot; instance `rarity` selects the tier row in `statsByRarity`.
 */
export const items: Record<string, Item> = {
  ...buildClassGear("warrior", {
    weapon: "Warrior Blade",
    armor: "Battle Plate",
    helmet: "Soldier Helm",
    ring: "Brawler Ring",
  }, WARRIOR_TIERS),
  ...buildClassGear("mage", {
    weapon: "Arcane Rod",
    armor: "Scholar Robes",
    helmet: "Mage Circlet",
    ring: "Focus Ring",
  }, MAGE_TIERS),
  ...buildClassGear("ranger", {
    weapon: "Ranger Longbow",
    armor: "Scout Vest",
    helmet: "Hawkeye Hood",
    ring: "Precision Ring",
  }, RANGER_TIERS),
  ...buildClassGear("paladin", {
    weapon: "Sanctified Mace",
    armor: "Aegis Mail",
    helmet: "Templar Helm",
    ring: "Sanctuary Band",
  }, PALADIN_TIERS),
};

/** Weapon + armor granted per hero class (matches onboarding / empty-inventory fill). */
const STARTER_INVENTORY_BY_CLASS: Record<string, readonly [string, string]> = {
  warrior: ["warrior_weapon", "warrior_armor"],
  mage: ["mage_weapon", "mage_armor"],
  ranger: ["ranger_weapon", "ranger_armor"],
  paladin: ["paladin_weapon", "paladin_armor"],
};

/** Default starter ids when class is unknown (pre-onboarding). */
export const STARTER_INVENTORY_IDS: readonly string[] =
  STARTER_INVENTORY_BY_CLASS.warrior;

/** Catalog ids for a class’s starter weapon + armor; falls back to warrior. */
export function starterInventoryIdsForClass(
  classId: string | null | undefined,
): readonly string[] {
  const key = (classId ?? "").toLowerCase();
  const pair = STARTER_INVENTORY_BY_CLASS[key];
  return pair ?? STARTER_INVENTORY_BY_CLASS.warrior;
}

/** Map legacy stored ids to current catalog ids. */
const LEGACY_ITEM_ID_MAP: Record<string, string> = {
  sword_1: "warrior_weapon",
  armor_1: "warrior_armor",
  warrior_sword_1: "warrior_weapon",
  warrior_armor_1: "warrior_armor",
  warrior_helmet_1: "warrior_helmet",
  warrior_ring_1: "warrior_ring",
  mage_staff_1: "mage_weapon",
  mage_robes_1: "mage_armor",
  mage_circlet_1: "mage_helmet",
  mage_ring_1: "mage_ring",
  ranger_bow_1: "ranger_weapon",
  ranger_tunic_1: "ranger_armor",
  ranger_hood_1: "ranger_helmet",
  ranger_ring_1: "ranger_ring",
  paladin_mace_1: "paladin_weapon",
  paladin_mail_1: "paladin_armor",
  paladin_helm_1: "paladin_helmet",
  paladin_ring_1: "paladin_ring",
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

/** Stable synthetic id for legacy rows until `ensureInventoryDefaults` assigns UUIDs. */
export function legacyInventoryInstanceId(index: number, itemId: string): string {
  return `legacy:${index}:${itemId}`;
}

export function isLegacyInventoryInstanceId(instanceId: string): boolean {
  return instanceId.startsWith("legacy:");
}

export function generateInstanceId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `inst_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * New user / empty-inventory starter rows (call when persisting to Firestore).
 * Pass hero `classId` when known; otherwise uses warrior-equivalent default.
 */
export function createStarterInventory(
  classId?: string | null,
): InventoryInstance[] {
  return starterInventoryIdsForClass(classId).map((itemId) => ({
    instanceId: generateInstanceId(),
    itemId,
  }));
}

/** One resolved row for UI (catalog item + display rarity). */
export type ResolvedInventoryRow = {
  item: Item;
  displayRarity: ItemRarity;
  instance: InventoryInstance;
};

/**
 * Parse Firestore `inventory`: `{ instanceId, itemId, rarity? }`, or legacy string / `{ id, rarity? }`.
 * Legacy rows use deterministic `legacy:index:itemId` until migrated.
 */
export function parseInventory(raw: unknown): InventoryInstance[] {
  if (!Array.isArray(raw)) return [];
  const out: InventoryInstance[] = [];
  for (let i = 0; i < raw.length; i++) {
    const el = raw[i];
    if (typeof el === "string") {
      const c = canonicalItemId(el);
      if (c) {
        out.push({
          instanceId: legacyInventoryInstanceId(i, c),
          itemId: c,
        });
      }
    } else if (el && typeof el === "object") {
      const o = el as Record<string, unknown>;
      const iid = o.instanceId;
      const tid = o.itemId;
      if (typeof iid === "string" && typeof tid === "string") {
        const c = canonicalItemId(tid);
        if (!c) continue;
        const r = o.rarity;
        out.push(
          isValidItemRarity(r)
            ? { instanceId: iid, itemId: c, rarity: r }
            : { instanceId: iid, itemId: c },
        );
        continue;
      }
      if (typeof o.id === "string") {
        const c = canonicalItemId(o.id);
        if (!c) continue;
        const r = o.rarity;
        out.push(
          isValidItemRarity(r)
            ? {
                instanceId: legacyInventoryInstanceId(i, c),
                itemId: c,
                rarity: r,
              }
            : {
                instanceId: legacyInventoryInstanceId(i, c),
                itemId: c,
              },
        );
      }
    }
  }
  return out;
}

/** Firestore object shape (never store full `Item`). */
export function serializeInventoryInstance(
  inst: InventoryInstance,
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    instanceId: inst.instanceId,
    itemId: inst.itemId,
  };
  if (inst.rarity) row.rarity = inst.rarity;
  return row;
}

export function inventoryToFirestore(
  instances: InventoryInstance[],
): Record<string, unknown>[] {
  return instances.map(serializeInventoryInstance);
}

export function resolveInventoryEntries(
  instances: InventoryInstance[],
): ResolvedInventoryRow[] {
  return instances
    .map((instance) => {
      const item = resolveItem(instance.itemId);
      if (!item) return null;
      const displayRarity = instance.rarity ?? item.rarity;
      return { item, displayRarity, instance };
    })
    .filter((x): x is ResolvedInventoryRow => x != null);
}

const SLOT_TYPE_SORT_INDEX = new Map<ItemType, number>(
  SLOT_ORDER.map((t, i) => [t, i]),
);

/**
 * Inventory UI order: weapon → armor → helmet → ring, then name, then instance id.
 */
export function sortInventoryRowsBySlotOrder(
  rows: ResolvedInventoryRow[],
): ResolvedInventoryRow[] {
  return [...rows].sort((a, b) => {
    const oa = SLOT_TYPE_SORT_INDEX.get(a.item.type) ?? 99;
    const ob = SLOT_TYPE_SORT_INDEX.get(b.item.type) ?? 99;
    if (oa !== ob) return oa - ob;
    const byName = a.item.name.localeCompare(b.item.name);
    if (byName !== 0) return byName;
    return a.instance.instanceId.localeCompare(b.instance.instanceId);
  });
}

/** All catalog entries (for shop fallbacks by type). */
export function allCatalogItems(): Item[] {
  return Object.values(items);
}

/** Items eligible for a hero class shop (class-specific pools). */
export function itemsForClass(classId: string | null): Item[] {
  if (!classId) return allCatalogItems().filter((i) => !i.classes?.length);
  return allCatalogItems().filter(
    (i) => !i.classes?.length || i.classes.includes(classId),
  );
}

/**
 * True if this hero may equip the item (universal items, or class list includes hero class).
 * No class on hero → cannot equip class-restricted gear.
 */
export function canUserEquipItem(
  item: Item,
  userClassId: string | null,
): boolean {
  if (!item.classes?.length) return true;
  if (!userClassId) return false;
  return item.classes.includes(userClassId);
}

/** Group catalog items by equipment slot. */
export function groupItemsByType(catalog: Item[]): Record<ItemType, Item[]> {
  const empty: Record<ItemType, Item[]> = {
    weapon: [],
    armor: [],
    helmet: [],
    ring: [],
  };
  for (const it of catalog) {
    empty[it.type].push(it);
  }
  return empty;
}

/**
 * Unique catalog ids present in inventory (order not preserved).
 * For full rows with duplicates and rarity, use `parseInventory`.
 */
export function parseInventoryIds(raw: unknown): string[] {
  return [...new Set(parseInventory(raw).map((e) => e.itemId))];
}
