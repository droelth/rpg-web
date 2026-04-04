import { doc, getDoc, updateDoc } from "firebase/firestore";
import type { EquippedState, InventoryInstance, Item, ItemStats, ItemType } from "@/types/item";
import { EMPTY_EQUIPPED, SLOT_ORDER } from "@/types/item";
import {
  canonicalItemId,
  generateInstanceId,
  inventoryToFirestore,
  isLegacyInventoryInstanceId,
  parseInventory,
  resolveItem,
  createStarterInventory,
} from "@/lib/items";
import { effectiveItemStatsForInstance } from "@/lib/itemRarityStats";
import { getDb } from "./firebase";

export type CombatTotals = {
  hp: number;
  atk: number;
  def: number;
  crit: number;
};

export function parseEquipped(raw: unknown): EquippedState {
  if (!raw || typeof raw !== "object") return { ...EMPTY_EQUIPPED };
  const e = raw as Record<string, unknown>;
  const id = (v: unknown) => (typeof v === "string" ? v : null);
  return {
    weapon: id(e.weapon),
    armor: id(e.armor),
    helmet: id(e.helmet),
    ring: id(e.ring),
  };
}

/** Drop equipped refs that are not present in `inventory`. */
export function sanitizeEquippedToInventory(
  equipped: EquippedState,
  inventory: InventoryInstance[],
): EquippedState {
  const ids = new Set(inventory.map((i) => i.instanceId));
  const next: EquippedState = { ...EMPTY_EQUIPPED };
  for (const slot of SLOT_ORDER) {
    const v = equipped[slot];
    next[slot] = v && ids.has(v) ? v : null;
  }
  return next;
}

/** Resolve equipped slots to catalog items via inventory instances. */
export function getEquippedItemsFromInventory(
  equipped: EquippedState,
  inventory: InventoryInstance[],
): Item[] {
  const byId = new Map(inventory.map((i) => [i.instanceId, i]));
  const out: Item[] = [];
  for (const slot of SLOT_ORDER) {
    const iid = equipped[slot];
    if (!iid) continue;
    const inst = byId.get(iid);
    if (!inst) continue;
    const it = resolveItem(inst.itemId);
    if (it) out.push(it);
  }
  return out;
}

export function findInventoryInstance(
  inventory: InventoryInstance[],
  instanceId: string,
): InventoryInstance | undefined {
  return inventory.find((i) => i.instanceId === instanceId);
}

/**
 * Equip by instance: sets `equipped[item.type] = instanceId` (replaces whatever was in that slot).
 */
export async function equipItem(uid: string, instanceId: string): Promise<void> {
  const ref = doc(getDb(), "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("User not found");
  const data = snap.data() as Record<string, unknown>;
  const inventory = parseInventory(data.inventory);
  const inst = findInventoryInstance(inventory, instanceId);
  if (!inst) throw new Error("Item instance not in inventory");
  const item = resolveItem(inst.itemId);
  if (!item) throw new Error("Unknown item catalog entry");
  const equipped = sanitizeEquippedToInventory(
    parseEquipped(data.equipped),
    inventory,
  );
  const next: EquippedState = {
    ...equipped,
    [item.type]: instanceId,
  };
  await updateDoc(ref, { equipped: next });
}

export function parseBaseStats(raw: unknown): CombatTotals {
  if (!raw || typeof raw !== "object") {
    return { hp: 30, atk: 6, def: 4, crit: 10 };
  }
  const s = raw as Record<string, unknown>;
  const n = (v: unknown, d: number) => (typeof v === "number" ? v : d);
  return {
    hp: n(s.hp, 30),
    atk: n(s.atk, 6),
    def: n(s.def, 4),
    crit: n(s.crit, 10),
  };
}

function addItemStats(a: CombatTotals, s: ItemStats): CombatTotals {
  return {
    hp: a.hp + (s.hp ?? 0),
    atk: a.atk + (s.atk ?? 0),
    def: a.def + (s.def ?? 0),
    crit: a.crit + (s.crit ?? 0),
  };
}

/**
 * Base character stats plus equipped items, using per-instance rarity to scale catalog stats.
 */
export function calculateCombatTotalsWithEquippedInventory(
  base: CombatTotals,
  equipped: EquippedState,
  inventory: InventoryInstance[],
): CombatTotals {
  const sanitized = sanitizeEquippedToInventory(equipped, inventory);
  const byId = new Map(inventory.map((i) => [i.instanceId, i]));
  let acc: CombatTotals = { ...base };
  for (const slot of SLOT_ORDER) {
    const iid = sanitized[slot];
    if (!iid) continue;
    const inst = byId.get(iid);
    if (!inst) continue;
    const it = resolveItem(inst.itemId);
    if (!it) continue;
    acc = addItemStats(acc, effectiveItemStatsForInstance(it, inst));
  }
  return acc;
}

/** Shape needed to derive effective combat stats (base + equipped catalog items). */
export type UserCombatSource = {
  stats: unknown;
  equipped: EquippedState;
  inventory: InventoryInstance[];
};

/** Total stats = parseBaseStats + equipped items (catalog stats × instance rarity). */
export function getEffectiveCombatTotals(user: UserCombatSource): CombatTotals {
  const base = parseBaseStats(user.stats);
  const sanitized = sanitizeEquippedToInventory(user.equipped, user.inventory);
  return calculateCombatTotalsWithEquippedInventory(
    base,
    sanitized,
    user.inventory,
  );
}

/** Read `effectiveStats` from Firestore (written by persistEffectiveCombatStats). */
export function parseStoredEffectiveStats(raw: unknown): CombatTotals | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" ? v : null);
  const hp = n(o.hp);
  const atk = n(o.atk);
  const def = n(o.def);
  const crit = n(o.crit);
  if (hp == null || atk == null || def == null || crit == null) return null;
  return { hp, atk, def, crit };
}

/** Recompute from base + equipped and save `effectiveStats` on the user doc. */
export async function persistEffectiveCombatStats(uid: string): Promise<CombatTotals> {
  const ref = doc(getDb(), "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return getEffectiveCombatTotals({
      stats: null,
      equipped: { ...EMPTY_EQUIPPED },
      inventory: [],
    });
  }
  const data = snap.data() as Record<string, unknown>;
  const inventory = parseInventory(data.inventory);
  const equipped = sanitizeEquippedToInventory(
    parseEquipped(data.equipped),
    inventory,
  );
  const totals = getEffectiveCombatTotals({
    stats: data.stats,
    equipped,
    inventory,
  });
  await updateDoc(ref, { effectiveStats: totals });
  return totals;
}

/** Current vs totals if `instanceId` is equipped in its item slot (replaces previous in that slot). */
export function simulateEquip(
  base: CombatTotals,
  equipped: EquippedState,
  inventory: InventoryInstance[],
  instanceId: string,
  newItem: Item,
): { current: CombatTotals; after: CombatTotals } {
  const sanitized = sanitizeEquippedToInventory(equipped, inventory);
  const current = calculateCombatTotalsWithEquippedInventory(
    base,
    sanitized,
    inventory,
  );

  const nextEquipped: EquippedState = {
    ...sanitized,
    [newItem.type]: instanceId,
  };
  const after = calculateCombatTotalsWithEquippedInventory(
    base,
    nextEquipped,
    inventory,
  );

  return { current, after };
}

/**
 * Remap equipped after inventory id migration: keep valid instance ids,
 * map old row instance ids to new ones by index, or treat value as catalog id.
 */
function remapEquippedAfterInventoryMigration(
  oldEquipped: EquippedState,
  oldInv: InventoryInstance[],
  newInv: InventoryInstance[],
): EquippedState {
  if (oldInv.length !== newInv.length) {
    return { ...EMPTY_EQUIPPED };
  }
  const next: EquippedState = { ...EMPTY_EQUIPPED };
  const usedRowIdx = new Set<number>();

  for (const slot of SLOT_ORDER) {
    const v = oldEquipped[slot];
    if (!v) {
      next[slot] = null;
      continue;
    }

    if (newInv.some((n) => n.instanceId === v)) {
      next[slot] = v;
      const idx = oldInv.findIndex((o) => o.instanceId === v);
      if (idx >= 0) usedRowIdx.add(idx);
      continue;
    }

    const idxByOld = oldInv.findIndex((o) => o.instanceId === v);
    if (idxByOld >= 0) {
      next[slot] = newInv[idxByOld].instanceId;
      usedRowIdx.add(idxByOld);
      continue;
    }

    let cid = canonicalItemId(v);
    if (!cid) {
      const legacy = /^legacy:\d+:(.+)$/.exec(v);
      if (legacy) cid = canonicalItemId(legacy[1]);
    }
    if (!cid) {
      next[slot] = null;
      continue;
    }

    const idx = oldInv.findIndex(
      (o, i) => o.itemId === cid && !usedRowIdx.has(i),
    );
    if (idx >= 0) {
      usedRowIdx.add(idx);
      next[slot] = newInv[idx].instanceId;
    } else {
      next[slot] = null;
    }
  }

  return next;
}

/** Replace only `legacy:…` synthetic ids; keep existing UUID rows stable. */
function persistInventoryInstanceIds(inv: InventoryInstance[]): InventoryInstance[] {
  return inv.map((row) =>
    isLegacyInventoryInstanceId(row.instanceId)
      ? {
          instanceId: generateInstanceId(),
          itemId: row.itemId,
          ...(row.rarity ? { rarity: row.rarity } : {}),
        }
      : row,
  );
}

/** True if inventory rows still use synthetic legacy instance ids. */
export function inventoryUsesLegacyInstanceIds(
  inv: InventoryInstance[],
): boolean {
  return inv.some((i) => isLegacyInventoryInstanceId(i.instanceId));
}

/** Legacy rows had full item blobs (`name`, `stats`, …), not just ids. */
function isLegacyInventoryBlob(el: unknown): boolean {
  if (!el || typeof el !== "object") return false;
  const o = el as Record<string, unknown>;
  if (typeof o.instanceId === "string" && typeof o.itemId === "string") {
    const extra = Object.keys(o).filter((k) => !["instanceId", "itemId", "rarity"].includes(k));
    return extra.length > 0;
  }
  if (typeof o.id === "string") {
    const allowed = new Set(["id", "rarity"]);
    return Object.keys(o).some((k) => !allowed.has(k));
  }
  return false;
}

function inventoryNeedsBlobMigration(raw: unknown): boolean {
  if (!Array.isArray(raw)) return false;
  return raw.some(isLegacyInventoryBlob);
}

/**
 * Persist default inventory + equipped; migrate legacy inventory / assign real instance UUIDs.
 */
export async function ensureInventoryDefaults(uid: string): Promise<void> {
  const ref = doc(getDb(), "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const d = snap.data();
  const patches: Record<string, unknown> = {};

  let inventory = parseInventory(d.inventory);
  let equipped = parseEquipped(d.equipped);
  let writeInv = false;
  let writeEq = false;

  if (inventory.length === 0) {
    inventory = createStarterInventory();
    equipped = { ...EMPTY_EQUIPPED };
    writeInv = true;
    writeEq = true;
  } else if (
    inventoryUsesLegacyInstanceIds(inventory) ||
    inventoryNeedsBlobMigration(d.inventory)
  ) {
    const prevInv = inventory;
    inventory = persistInventoryInstanceIds(prevInv);
    equipped = remapEquippedAfterInventoryMigration(equipped, prevInv, inventory);
    writeInv = true;
    writeEq = true;
  }

  const afterSanitize = sanitizeEquippedToInventory(equipped, inventory);
  if (JSON.stringify(afterSanitize) !== JSON.stringify(equipped)) {
    equipped = afterSanitize;
    writeEq = true;
  }

  const rawEq = d.equipped;
  const needsSlotKeys =
    !rawEq ||
    typeof rawEq !== "object" ||
    !SLOT_ORDER.every((k) => k in (rawEq as Record<string, unknown>));

  if (needsSlotKeys) {
    equipped = sanitizeEquippedToInventory(
      { ...EMPTY_EQUIPPED, ...equipped },
      inventory,
    );
    writeEq = true;
  }

  if (writeInv) patches.inventory = inventoryToFirestore(inventory);
  if (writeEq) patches.equipped = equipped;

  if (Object.keys(patches).length > 0) {
    await updateDoc(ref, patches);
  }
}

export function formatStatDelta(before: number, after: number): string {
  const d = after - before;
  if (d === 0) return "±0";
  return d > 0 ? `+${d}` : `${d}`;
}
