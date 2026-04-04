import { doc, getDoc, updateDoc } from "firebase/firestore";
import type { EquippedState, Item, ItemStats, ItemType } from "@/types/item";
import { EMPTY_EQUIPPED, SLOT_ORDER } from "@/types/item";
import { getDb } from "./firebase";

/** Starter gear when Firestore has no inventory. */
export const STARTER_ITEMS: Item[] = [
  { id: "sword_1", name: "Iron Sword", type: "weapon", stats: { atk: 3 } },
  { id: "armor_1", name: "Leather Armor", type: "armor", stats: { def: 2 } },
];

export type CombatTotals = {
  hp: number;
  atk: number;
  def: number;
  crit: number;
};

function parseItemStats(raw: unknown): ItemStats {
  if (!raw || typeof raw !== "object") return {};
  const s = raw as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" ? v : undefined);
  return {
    atk: n(s.atk),
    def: n(s.def),
    hp: n(s.hp),
    crit: n(s.crit),
  };
}

export function parseItem(raw: unknown): Item | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.name !== "string") return null;
  const t = o.type;
  if (t !== "weapon" && t !== "armor" && t !== "helmet" && t !== "ring") {
    return null;
  }
  return {
    id: o.id,
    name: o.name,
    type: t,
    stats: parseItemStats(o.stats),
  };
}

export function parseInventory(raw: unknown): Item[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(parseItem).filter((x): x is Item => x != null);
}

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

/** Items currently equipped (one per slot, in slot order). */
export function getEquippedItems(
  allItems: Item[],
  equipped: EquippedState,
): Item[] {
  const byId = new Map(allItems.map((i) => [i.id, i]));
  const out: Item[] = [];
  for (const slot of SLOT_ORDER) {
    const id = equipped[slot];
    if (!id) continue;
    const it = byId.get(id);
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

/** Shape needed to derive effective combat stats (base + gear). Firestore `stats` stays unchanged. */
export type UserCombatSource = {
  stats: unknown;
  inventory: Item[];
  equipped: EquippedState;
};

/** Total stats = parseBaseStats(user.stats) + all equipped item bonuses. */
export function getEffectiveCombatTotals(user: UserCombatSource): CombatTotals {
  const base = parseBaseStats(user.stats);
  const equipped = getEquippedItems(user.inventory, user.equipped);
  return calculateTotalStats(base, equipped);
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

/** Recompute from base + inventory + equipped and save `effectiveStats` on the user doc. */
export async function persistEffectiveCombatStats(uid: string): Promise<CombatTotals> {
  const ref = doc(getDb(), "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error("User document not found");
  }
  const data = snap.data() as Record<string, unknown>;
  const totals = getEffectiveCombatTotals({
    stats: data.stats,
    inventory: parseInventory(data.inventory),
    equipped: parseEquipped(data.equipped),
  });
  await updateDoc(ref, { effectiveStats: totals });
  return totals;
}

/** Current totals vs totals if `newItem` is placed in its type slot (replacing previous). */
export function simulateEquip(
  base: CombatTotals,
  equipped: EquippedState,
  allItems: Item[],
  newItem: Item,
): { current: CombatTotals; after: CombatTotals } {
  const currentEquipped = getEquippedItems(allItems, equipped);
  const current = calculateTotalStats(base, currentEquipped);

  const nextEquipped: EquippedState = {
    ...equipped,
    [newItem.type]: newItem.id,
  };
  const afterEquipped = getEquippedItems(allItems, nextEquipped);
  const after = calculateTotalStats(base, afterEquipped);

  return { current, after };
}

/** Persist default inventory + equipped shape when missing or empty. */
export async function ensureInventoryDefaults(uid: string): Promise<void> {
  const ref = doc(getDb(), "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const d = snap.data();
  const patches: Record<string, unknown> = {};

  const inv = parseInventory(d.inventory);
  if (inv.length === 0) {
    patches.inventory = STARTER_ITEMS;
  }

  const rawEq = d.equipped;
  if (!rawEq || typeof rawEq !== "object") {
    patches.equipped = { ...EMPTY_EQUIPPED };
  } else {
    const o = rawEq as Record<string, unknown>;
    const allSlots = SLOT_ORDER.every((k) => k in o);
    if (!allSlots) {
      patches.equipped = { ...EMPTY_EQUIPPED, ...parseEquipped(rawEq) };
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
