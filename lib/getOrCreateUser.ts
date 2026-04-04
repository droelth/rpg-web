import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from "firebase/firestore";
import type { EquippedState } from "@/types/item";
import { EMPTY_EQUIPPED } from "@/types/item";
import { parseInventoryIds, STARTER_INVENTORY_IDS } from "@/lib/items";
import { getDb } from "./firebase";
import type { CombatTotals } from "./inventoryUtils";
import {
  getEffectiveCombatTotals,
  parseEquipped,
  parseStoredEffectiveStats,
} from "./inventoryUtils";

export const INITIAL_USER_GOLD = 100;
export const INITIAL_USER_ENERGY = 20;

export type UserDocument = {
  username: string | null;
  class: string | null;
  stats: unknown | null;
  gold: number;
  energy: number;
  /** Item ids only; definitions live in `@/lib/items`. */
  inventory: string[];
  equipped: EquippedState;
  /** Denormalized base + equipment; kept in sync via persistEffectiveCombatStats. */
  effectiveStats: CombatTotals;
  createdAt: Timestamp | null;
};

function readGoldEnergy(data: Record<string, unknown> | undefined) {
  const gold = data?.gold;
  const energy = data?.energy;
  return {
    gold: typeof gold === "number" ? gold : INITIAL_USER_GOLD,
    energy: typeof energy === "number" ? energy : INITIAL_USER_ENERGY,
  };
}

function resolveEffectiveStats(
  ref: ReturnType<typeof doc>,
  data: Record<string, unknown>,
  equipped: EquippedState,
  stats: unknown,
): CombatTotals {
  const stored = parseStoredEffectiveStats(data.effectiveStats);
  const computed = getEffectiveCombatTotals({ stats, equipped });
  if (!stored) {
    void updateDoc(ref, { effectiveStats: computed });
    return computed;
  }
  return stored;
}

export async function getOrCreateUser(uid: string): Promise<UserDocument> {
  const ref = doc(getDb(), "users", uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data() as Record<string, unknown>;
    const { gold, energy } = readGoldEnergy(data);
    const inventory = parseInventoryIds(data.inventory);
    const equipped = parseEquipped(data.equipped);
    const stats = data.stats ?? null;
    const effectiveStats = resolveEffectiveStats(ref, data, equipped, stats);
    return {
      username: (data.username as string | undefined) ?? null,
      class: (data.class as string | undefined) ?? null,
      stats,
      gold,
      energy,
      inventory,
      equipped,
      effectiveStats,
      createdAt: (data.createdAt as Timestamp | undefined) ?? null,
    };
  }

  const equippedNew: EquippedState = { ...EMPTY_EQUIPPED };
  const starterIds = [...STARTER_INVENTORY_IDS];
  const effectiveStats = getEffectiveCombatTotals({
    stats: null,
    equipped: equippedNew,
  });

  const newUser: Omit<UserDocument, "createdAt"> & {
    createdAt: ReturnType<typeof serverTimestamp>;
  } = {
    username: null,
    class: null,
    stats: null,
    gold: INITIAL_USER_GOLD,
    energy: INITIAL_USER_ENERGY,
    inventory: starterIds,
    equipped: equippedNew,
    effectiveStats,
    createdAt: serverTimestamp(),
  };

  await setDoc(ref, newUser);

  const created = await getDoc(ref);
  const d = created.data() as Record<string, unknown>;
  const { gold, energy } = readGoldEnergy(d);
  const inventory = parseInventoryIds(d.inventory);
  const equipped = parseEquipped(d.equipped);
  const stats = d.stats ?? null;
  return {
    username: (d.username as string | undefined) ?? null,
    class: (d.class as string | undefined) ?? null,
    stats,
    gold,
    energy,
    inventory,
    equipped,
    effectiveStats: parseStoredEffectiveStats(d.effectiveStats) ?? effectiveStats,
    createdAt: (d.createdAt as Timestamp | undefined) ?? null,
  };
}
