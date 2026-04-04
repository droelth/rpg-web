import type { InventoryInstance, Item, ItemRarity, ItemType } from "@/types/item";

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

/**
 * Single source of truth for item definitions.
 * Inventory rows are `InventoryInstance`; equipped slots reference `instanceId`.
 */
export const items: Record<string, Item> = {
  warrior_sword_1: {
    id: "warrior_sword_1",
    name: "Iron Sword",
    type: "weapon",
    rarity: "common",
    classes: ["warrior"],
    stats: { atk: 3 },
  },
  warrior_armor_1: {
    id: "warrior_armor_1",
    name: "Leather Armor",
    type: "armor",
    rarity: "common",
    classes: ["warrior"],
    stats: { def: 2 },
  },
  warrior_helmet_1: {
    id: "warrior_helmet_1",
    name: "Iron Helm",
    type: "helmet",
    rarity: "common",
    classes: ["warrior"],
    stats: { def: 1, hp: 2 },
  },
  warrior_ring_1: {
    id: "warrior_ring_1",
    name: "Ring of Might",
    type: "ring",
    rarity: "common",
    classes: ["warrior"],
    stats: { atk: 1 },
  },

  mage_staff_1: {
    id: "mage_staff_1",
    name: "Oak Staff",
    type: "weapon",
    rarity: "common",
    classes: ["mage"],
    stats: { atk: 4 },
  },
  mage_robes_1: {
    id: "mage_robes_1",
    name: "Apprentice Robes",
    type: "armor",
    rarity: "common",
    classes: ["mage"],
    stats: { def: 1 },
  },
  mage_circlet_1: {
    id: "mage_circlet_1",
    name: "Scholar’s Circlet",
    type: "helmet",
    rarity: "common",
    classes: ["mage"],
    stats: { crit: 2 },
  },
  mage_ring_1: {
    id: "mage_ring_1",
    name: "Ring of Focus",
    type: "ring",
    rarity: "common",
    classes: ["mage"],
    stats: { atk: 1, crit: 1 },
  },

  ranger_bow_1: {
    id: "ranger_bow_1",
    name: "Hunter’s Bow",
    type: "weapon",
    rarity: "common",
    classes: ["ranger"],
    stats: { atk: 3, crit: 1 },
  },
  ranger_tunic_1: {
    id: "ranger_tunic_1",
    name: "Forest Tunic",
    type: "armor",
    rarity: "common",
    classes: ["ranger"],
    stats: { def: 2 },
  },
  ranger_hood_1: {
    id: "ranger_hood_1",
    name: "Leather Hood",
    type: "helmet",
    rarity: "common",
    classes: ["ranger"],
    stats: { def: 1 },
  },
  ranger_ring_1: {
    id: "ranger_ring_1",
    name: "Ring of Precision",
    type: "ring",
    rarity: "common",
    classes: ["ranger"],
    stats: { crit: 2 },
  },

  paladin_mace_1: {
    id: "paladin_mace_1",
    name: "Blessed Mace",
    type: "weapon",
    rarity: "common",
    classes: ["paladin"],
    stats: { atk: 2, def: 1 },
  },
  paladin_mail_1: {
    id: "paladin_mail_1",
    name: "Chain Mail",
    type: "armor",
    rarity: "common",
    classes: ["paladin"],
    stats: { def: 3 },
  },
  paladin_helm_1: {
    id: "paladin_helm_1",
    name: "Aegis Helm",
    type: "helmet",
    rarity: "common",
    classes: ["paladin"],
    stats: { hp: 3, def: 1 },
  },
  paladin_ring_1: {
    id: "paladin_ring_1",
    name: "Ring of Warding",
    type: "ring",
    rarity: "common",
    classes: ["paladin"],
    stats: { def: 1, hp: 2 },
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

/** New user / empty-inventory starter rows (call when persisting to Firestore). */
export function createStarterInventory(): InventoryInstance[] {
  return STARTER_INVENTORY_IDS.map((itemId) => ({
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
