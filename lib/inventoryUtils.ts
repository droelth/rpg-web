import { doc, getDoc, updateDoc } from "firebase/firestore";
import type { EquippedState, Item, ItemStats, ItemType } from "@/types/item";
import { EMPTY_EQUIPPED, SLOT_ORDER } from "@/types/item";
import {
  canonicalItemId,
  parseInventoryIds,
  resolveItem,
  STARTER_INVENTORY_IDS,
} from "@/lib/items";
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

/** Normalize equipped slot values to canonical catalog ids. */
export function normalizeEquippedIds(equipped: EquippedState): EquippedState {
  const next: EquippedState = { ...EMPTY_EQUIPPED };
  for (const slot of SLOT_ORDER) {
    const raw = equipped[slot];
    if (!raw) continue;
    const cid = canonicalItemId(raw);
    if (cid) next[slot] = cid;
  }
  return next;
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

/** Resolve equipped slot ids through the item catalog (single source of truth). */
export function getEquippedItemsFromCatalog(equipped: EquippedState): Item[] {
  const out: Item[] = [];
  for (const slot of SLOT_ORDER) {
    const id = equipped[slot];
    if (!id) continue;
    const it = resolveItem(id);
    if (it) out.push(it);
  }
  return out;
}

function addItemStats(a: CombatTotals, s: ItemStats): CombatTotals {
  return {
    hp: a.hp + (s.hp ?? 0),
    atk: a.atk + (s.atk ?? 0),
    def: a.def + (s.def ?? 0),
    crit: a.crit + (s.crit ?? 0),
  };
}

/** Base character stats plus all bonuses from equipped items. */
export function calculateTotalStats(
  base: CombatTotals,
  equippedItems: Item[],
): CombatTotals {
  return equippedItems.reduce(
    (acc, item) => addItemStats(acc, item.stats),
    { ...base },
  );
}

/** Shape needed to derive effective combat stats (base + equipped catalog items). */
export type UserCombatSource = {
  stats: unknown;
  equipped: EquippedState;
};

/** Total stats = parseBaseStats + equipped items resolved from `items` catalog. */
export function getEffectiveCombatTotals(user: UserCombatSource): CombatTotals {
  const base = parseBaseStats(user.stats);
  const equippedItems = getEquippedItemsFromCatalog(user.equipped);
  return calculateTotalStats(base, equippedItems);
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
    throw new Error("User document not found");
  }
  const data = snap.data() as Record<string, unknown>;
  const totals = getEffectiveCombatTotals({
    stats: data.stats,
    equipped: parseEquipped(data.equipped),
  });
  await updateDoc(ref, { effectiveStats: totals });
  return totals;
}

/** Current vs totals if `newItem` is equipped in its slot (replaces previous in that slot). */
export function simulateEquip(
  base: CombatTotals,
  equipped: EquippedState,
  newItem: Item,
): { current: CombatTotals; after: CombatTotals } {
  const normalized = normalizeEquippedIds(equipped);
  const currentEquipped = getEquippedItemsFromCatalog(normalized);
  const current = calculateTotalStats(base, currentEquipped);

  const nextEquipped: EquippedState = {
    ...normalized,
    [newItem.type]: newItem.id,
  };
  const afterEquipped = getEquippedItemsFromCatalog(nextEquipped);
  const after = calculateTotalStats(base, afterEquipped);

  return { current, after };
}

function inventoryNeedsMigration(raw: unknown): boolean {
  if (!Array.isArray(raw)) return false;
  return raw.some((x) => x && typeof x === "object");
}

function inventoryIdsDifferFromRaw(
  raw: unknown,
  normalized: string[],
): boolean {
  if (!Array.isArray(raw)) return normalized.length > 0;
  if (JSON.stringify(raw) === JSON.stringify(normalized)) return false;
  return true;
}

/** Persist default inventory + equipped; migrate legacy object[] inventory to id[]. */
export async function ensureInventoryDefaults(uid: string): Promise<void> {
  const ref = doc(getDb(), "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const d = snap.data();
  const patches: Record<string, unknown> = {};

  const normalizedInv = parseInventoryIds(d.inventory);
  if (normalizedInv.length === 0) {
    patches.inventory = [...STARTER_INVENTORY_IDS];
  } else if (
    inventoryNeedsMigration(d.inventory) ||
    inventoryIdsDifferFromRaw(d.inventory, normalizedInv)
  ) {
    patches.inventory = normalizedInv;
  }

  const rawEq = d.equipped;
  const parsedEq = parseEquipped(rawEq);
  const normalizedEq = normalizeEquippedIds(parsedEq);

  if (!rawEq || typeof rawEq !== "object") {
    patches.equipped = { ...EMPTY_EQUIPPED };
  } else {
    const o = rawEq as Record<string, unknown>;
    const allSlots = SLOT_ORDER.every((k) => k in o);
    if (!allSlots) {
      patches.equipped = { ...EMPTY_EQUIPPED, ...normalizedEq };
    } else if (JSON.stringify(parsedEq) !== JSON.stringify(normalizedEq)) {
      patches.equipped = normalizedEq;
    }
  }

  if (Object.keys(patches).length > 0) {
    await updateDoc(ref, patches);
  }
}

export function formatStatDelta(before: number, after: number): string {
  const d = after - before;
  if (d === 0) return "±0";
  return d > 0 ? `+${d}` : `${d}`;
}
