import { doc, getDoc, updateDoc } from "firebase/firestore";
import type { CombatTotals } from "@/lib/inventoryUtils";
import { parseBaseStats, persistEffectiveCombatStats } from "@/lib/inventoryUtils";
import { getDb } from "./firebase";

export const XP_ON_WIN = 50;
export const XP_ON_LOSS = 10;

/** Character level cannot exceed this (XP still applies but no further level-ups). */
export const MAX_LEVEL = 10;

/** Max level-ups processed in one applyLevelUp call (safety). */
const MAX_LEVEL_UPS = 500;

export type UserLevelFields = {
  level: number;
  xp: number;
  xpToNext: number;
  stats: CombatTotals;
  class: string | null;
};

/** XP needed for the current level’s bar: `100 + (level * 50)` (matches post–level-up rule). */
export function xpToNextForCurrentLevel(level: number): number {
  const L = Math.max(1, Math.floor(level));
  return 100 + L * 50;
}

function applyClassLevelBonus(stats: CombatTotals, classId: string | null): void {
  const id = (classId ?? "").toLowerCase();
  switch (id) {
    case "paladin":
      stats.hp += 2;
      stats.def += 1;
      break;
    case "warrior":
      stats.atk += 1;
      stats.def += 1;
      break;
    case "ranger":
      stats.atk += 1;
      stats.crit += 2;
      break;
    case "mage":
      stats.atk += 2;
      stats.crit += 2;
      break;
    default:
      break;
  }
}

/**
 * Process all pending level-ups: subtract thresholds, bump stats (permanent in-memory).
 * XP is clamped to >= 0. Does not write to Firebase.
 */
function clampAtMaxLevel(
  level: number,
  xp: number,
  stats: CombatTotals,
  classId: string | null,
): UserLevelFields {
  const cappedLevel = MAX_LEVEL;
  const capXpToNext = xpToNextForCurrentLevel(cappedLevel);
  const cappedXp = Math.min(Math.max(0, xp), capXpToNext);
  return {
    level: cappedLevel,
    xp: cappedXp,
    xpToNext: capXpToNext,
    stats: { ...stats },
    class: classId,
  };
}

export function applyLevelUp(user: UserLevelFields): UserLevelFields {
  let { level, xp, xpToNext, stats, class: classId } = user;
  xp = Math.max(0, xp);
  level = Math.min(Math.max(1, Math.floor(level)), MAX_LEVEL);

  if (level >= MAX_LEVEL) {
    return clampAtMaxLevel(level, xp, stats, classId);
  }

  let nextStats: CombatTotals = { ...stats };
  let guard = 0;

  while (
    xp >= xpToNext &&
    level < MAX_LEVEL &&
    guard < MAX_LEVEL_UPS
  ) {
    guard += 1;
    xp -= xpToNext;
    level += 1;
    nextStats = {
      hp: nextStats.hp + 1,
      atk: nextStats.atk + 1,
      def: nextStats.def + 1,
      crit: nextStats.crit + 1,
    };
    applyClassLevelBonus(nextStats, classId);
    xpToNext = xpToNextForCurrentLevel(level);
  }

  if (guard >= MAX_LEVEL_UPS) {
    console.error("applyLevelUp: max iterations reached");
  }

  if (level >= MAX_LEVEL) {
    return clampAtMaxLevel(level, xp, nextStats, classId);
  }

  return {
    level,
    xp,
    xpToNext,
    stats: nextStats,
    class: classId,
  };
}

export function parseUserLevelFields(data: Record<string, unknown>): UserLevelFields {
  const stats = parseBaseStats(data.stats);
  const levelRaw = data.level;
  const xpRaw = data.xp;
  const xpToNextRaw = data.xpToNext;
  const levelUncapped =
    typeof levelRaw === "number" && Number.isFinite(levelRaw) && levelRaw >= 1
      ? Math.floor(levelRaw)
      : 1;
  const level = Math.min(levelUncapped, MAX_LEVEL);
  let xp =
    typeof xpRaw === "number" && Number.isFinite(xpRaw) && xpRaw >= 0
      ? Math.floor(xpRaw)
      : 0;
  let xpToNext: number;
  if (typeof xpToNextRaw === "number" && Number.isFinite(xpToNextRaw) && xpToNextRaw > 0) {
    xpToNext = Math.floor(xpToNextRaw);
  } else {
    xpToNext = xpToNextForCurrentLevel(level);
  }
  if (level >= MAX_LEVEL) {
    xpToNext = xpToNextForCurrentLevel(MAX_LEVEL);
    xp = Math.min(xp, xpToNext);
  }
  return {
    level,
    xp,
    xpToNext,
    stats,
    class: typeof data.class === "string" ? data.class : null,
  };
}

/** Award combat XP, run level-ups, persist level/xp/xpToNext/stats and effectiveStats. */
export async function persistCombatProgression(
  uid: string,
  outcome: "win" | "loss",
): Promise<UserLevelFields> {
  const ref = doc(getDb(), "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error("User document not found");
  }
  const data = snap.data() as Record<string, unknown>;
  const base = parseUserLevelFields(data);
  const gain = outcome === "win" ? XP_ON_WIN : XP_ON_LOSS;
  const afterXp = { ...base, xp: base.xp + gain };
  const finalState = applyLevelUp(afterXp);

  await updateDoc(ref, {
    level: finalState.level,
    xp: finalState.xp,
    xpToNext: finalState.xpToNext,
    stats: finalState.stats,
  });
  await persistEffectiveCombatStats(uid);
  return finalState;
}
