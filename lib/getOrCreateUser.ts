import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import type { EquippedState, InventoryInstance } from "@/types/item";
import { EMPTY_EQUIPPED } from "@/types/item";
import { createStarterInventory, parseInventory } from "@/lib/items";
import { parseUserLevelFields, xpToNextForCurrentLevel } from "@/lib/levelSystem";
import { parseShop, type ParsedShop } from "@/lib/shopSystem";
import {
  calculateEnergyState,
  MAX_ENERGY,
  timestampToMillis,
} from "@/lib/energySystem";
import { getDb } from "./firebase";
import type { CombatTotals } from "./inventoryUtils";
import {
  getEffectiveCombatTotals,
  parseEquipped,
  parseStoredEffectiveStats,
  sanitizeEquippedToHeroClass,
  sanitizeEquippedToInventory,
} from "./inventoryUtils";

export const INITIAL_USER_GOLD = 100;
export const INITIAL_USER_ENERGY = MAX_ENERGY;

export type UserDocument = {
  username: string | null;
  class: string | null;
  stats: unknown | null;
  level: number;
  xp: number;
  xpToNext: number;
  gold: number;
  energy: number;
  rankPoints: number;
  wins: number;
  losses: number;
  lastEnergyUpdate: Timestamp | null;
  /** One row per owned instance; equipped slots reference `instanceId`. */
  inventory: InventoryInstance[];
  equipped: EquippedState;
  /** Denormalized base + equipment; kept in sync via persistEffectiveCombatStats. */
  effectiveStats: CombatTotals;
  /** Rotating offers; items reference `items` catalog ids only. */
  shop: ParsedShop;
  createdAt: Timestamp | null;
};

function readGold(data: Record<string, unknown> | undefined) {
  const gold = data?.gold;
  return {
    gold: typeof gold === "number" ? gold : INITIAL_USER_GOLD,
  };
}

function readRankPoints(data: Record<string, unknown> | undefined): number {
  const r = data?.rankPoints;
  if (typeof r === "number" && Number.isFinite(r)) {
    return Math.max(0, Math.floor(r));
  }
  return 0;
}

function readWinLoss(
  data: Record<string, unknown> | undefined,
  key: "wins" | "losses",
): number {
  const v = data?.[key];
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.max(0, Math.floor(v));
  }
  return 0;
}

function parseLastEnergyTs(
  data: Record<string, unknown>,
): Timestamp | null {
  const v = data.lastEnergyUpdate;
  if (v && typeof v === "object" && "toMillis" in v) {
    return v as Timestamp;
  }
  return null;
}

function resolveEffectiveStats(
  ref: ReturnType<typeof doc>,
  data: Record<string, unknown>,
  equipped: EquippedState,
  inventory: InventoryInstance[],
  stats: unknown,
): CombatTotals {
  const heroClass =
    typeof data.class === "string" && data.class.trim().length > 0
      ? data.class.trim()
      : null;
  const stored = parseStoredEffectiveStats(data.effectiveStats);
  const computed = getEffectiveCombatTotals({
    stats,
    equipped,
    inventory,
    heroClass,
  });
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
    if (!("wins" in data) || !("losses" in data)) {
      void updateDoc(ref, {
        wins: readWinLoss(data, "wins"),
        losses: readWinLoss(data, "losses"),
      });
    }
    const { gold } = readGold(data);
    const nowMs = Date.now();
    let storedEnergy =
      typeof data.energy === "number" && Number.isFinite(data.energy)
        ? Math.floor(data.energy)
        : MAX_ENERGY;
    if (storedEnergy > MAX_ENERGY) {
      storedEnergy = MAX_ENERGY;
      await updateDoc(ref, { energy: MAX_ENERGY });
    }
    const lastMs = timestampToMillis(data.lastEnergyUpdate) ?? nowMs;
    const regen = calculateEnergyState(storedEnergy, lastMs, nowMs);
    let displayEnergy = regen.energy;
    let lastEnergyOut = parseLastEnergyTs(data);
    if (regen.regenTicks > 0) {
      await updateDoc(ref, {
        energy: regen.energy,
        lastEnergyUpdate: Timestamp.fromMillis(regen.lastEnergyUpdateMs),
      });
      displayEnergy = regen.energy;
      lastEnergyOut = Timestamp.fromMillis(regen.lastEnergyUpdateMs);
    } else if (!lastEnergyOut) {
      await updateDoc(ref, {
        lastEnergyUpdate: Timestamp.fromMillis(nowMs),
      });
      lastEnergyOut = Timestamp.fromMillis(nowMs);
    }

    const inventory = parseInventory(data.inventory);
    let equipped = sanitizeEquippedToInventory(
      parseEquipped(data.equipped),
      inventory,
    );
    const heroClass =
      typeof data.class === "string" && data.class.trim().length > 0
        ? data.class.trim()
        : null;
    const classSafeEquipped = sanitizeEquippedToHeroClass(
      equipped,
      inventory,
      heroClass,
    );
    if (JSON.stringify(classSafeEquipped) !== JSON.stringify(equipped)) {
      void updateDoc(ref, { equipped: classSafeEquipped });
    }
    equipped = classSafeEquipped;
    const stats = data.stats ?? null;
    const effectiveStats = resolveEffectiveStats(
      ref,
      data,
      equipped,
      inventory,
      stats,
    );
    const lf = parseUserLevelFields(data);
    const rankPoints = readRankPoints(data);
    const wins = readWinLoss(data, "wins");
    const losses = readWinLoss(data, "losses");
    return {
      username: (data.username as string | undefined) ?? null,
      class: (data.class as string | undefined) ?? null,
      stats,
      level: lf.level,
      xp: lf.xp,
      xpToNext: lf.xpToNext,
      gold,
      energy: displayEnergy,
      rankPoints,
      wins,
      losses,
      lastEnergyUpdate: lastEnergyOut,
      inventory,
      equipped,
      effectiveStats,
      shop: parseShop(data.shop),
      createdAt: (data.createdAt as Timestamp | undefined) ?? null,
    };
  }

  const equippedNew: EquippedState = { ...EMPTY_EQUIPPED };
  const starterInventory = createStarterInventory(null);
  const effectiveStats = getEffectiveCombatTotals({
    stats: null,
    equipped: equippedNew,
    inventory: starterInventory,
    heroClass: null,
  });

  const newUser: Omit<UserDocument, "createdAt" | "lastEnergyUpdate"> & {
    createdAt: ReturnType<typeof serverTimestamp>;
    lastEnergyUpdate: ReturnType<typeof serverTimestamp>;
  } = {
    username: null,
    class: null,
    stats: null,
    level: 1,
    xp: 0,
    xpToNext: xpToNextForCurrentLevel(1),
    gold: INITIAL_USER_GOLD,
    energy: MAX_ENERGY,
    rankPoints: 0,
    wins: 0,
    losses: 0,
    lastEnergyUpdate: serverTimestamp(),
    inventory: starterInventory,
    equipped: equippedNew,
    effectiveStats,
    shop: { items: [], lastRefresh: null },
    createdAt: serverTimestamp(),
  };

  await setDoc(ref, newUser);

  const created = await getDoc(ref);
  const d = created.data() as Record<string, unknown>;
  const { gold } = readGold(d);
  const energy =
    typeof d.energy === "number" && Number.isFinite(d.energy)
      ? Math.floor(d.energy)
      : MAX_ENERGY;
  const inventory = parseInventory(d.inventory);
  const equipped = sanitizeEquippedToInventory(
    parseEquipped(d.equipped),
    inventory,
  );
  const stats = d.stats ?? null;
  const lf = parseUserLevelFields(d);
  return {
    username: (d.username as string | undefined) ?? null,
    class: (d.class as string | undefined) ?? null,
    stats,
    level: lf.level,
    xp: lf.xp,
    xpToNext: lf.xpToNext,
    gold,
    energy,
    rankPoints: readRankPoints(d),
    wins: readWinLoss(d, "wins"),
    losses: readWinLoss(d, "losses"),
    lastEnergyUpdate: parseLastEnergyTs(d),
    inventory,
    equipped,
    effectiveStats: parseStoredEffectiveStats(d.effectiveStats) ?? effectiveStats,
    shop: parseShop(d.shop),
    createdAt: (d.createdAt as Timestamp | undefined) ?? null,
  };
}

/**
 * Read another user's document for public profile views. Does not create
 * documents or write back migrations (unlike {@link getOrCreateUser}).
 */
export async function fetchUserPublicProfile(
  uid: string,
): Promise<UserDocument | null> {
  const ref = doc(getDb(), "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const data = snap.data() as Record<string, unknown>;
  const inventory = parseInventory(data.inventory);
  let equipped = sanitizeEquippedToInventory(
    parseEquipped(data.equipped),
    inventory,
  );
  const heroClass =
    typeof data.class === "string" && data.class.trim().length > 0
      ? data.class.trim()
      : null;
  equipped = sanitizeEquippedToHeroClass(equipped, inventory, heroClass);

  const stats = data.stats ?? null;
  const storedEff = parseStoredEffectiveStats(data.effectiveStats);
  const effectiveStats =
    storedEff ??
    getEffectiveCombatTotals({
      stats,
      equipped,
      inventory,
      heroClass,
    });

  const { gold } = readGold(data);
  const energy =
    typeof data.energy === "number" && Number.isFinite(data.energy)
      ? Math.floor(Math.min(data.energy, MAX_ENERGY))
      : MAX_ENERGY;
  const lf = parseUserLevelFields(data);

  return {
    username: (data.username as string | undefined) ?? null,
    class: (data.class as string | undefined) ?? null,
    stats,
    level: lf.level,
    xp: lf.xp,
    xpToNext: lf.xpToNext,
    gold,
    energy,
    rankPoints: readRankPoints(data),
    wins: readWinLoss(data, "wins"),
    losses: readWinLoss(data, "losses"),
    lastEnergyUpdate: parseLastEnergyTs(data),
    inventory,
    equipped,
    effectiveStats,
    shop: parseShop(data.shop),
    createdAt: (data.createdAt as Timestamp | undefined) ?? null,
  };
}
