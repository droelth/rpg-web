import { doc, runTransaction, Timestamp } from "firebase/firestore";
import {
  calculateEnergyState,
  consumeOneEnergy,
  MAX_ENERGY,
  timestampToMillis,
} from "@/lib/energySystem";
import { getDb } from "./firebase";
import { getUserProfileDocRef } from "./userProfileFirestore";
import { applyLevelUp, parseUserLevelFields } from "./levelSystem";
import { persistEffectiveCombatStats } from "./inventoryUtils";

export class PvpEnergyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PvpEnergyError";
  }
}

function readNonNegIntField(
  data: Record<string, unknown>,
  key: "wins" | "losses",
): number {
  const v = data[key];
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.max(0, Math.floor(v));
  }
  return 0;
}

/**
 * Regen energy from `lastEnergyUpdate`, then spend 1 for a PvP match. Atomic.
 */
export async function transactionConsumePvpEnergy(uid: string): Promise<void> {
  const db = getDb();
  const ref = await getUserProfileDocRef(uid);
  const nowMs = Date.now();

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new PvpEnergyError("User not found");
    const data = snap.data() as Record<string, unknown>;

    let rawEnergy =
      typeof data.energy === "number" && Number.isFinite(data.energy)
        ? Math.floor(data.energy)
        : MAX_ENERGY;
    rawEnergy = Math.min(MAX_ENERGY, Math.max(0, rawEnergy));
    const lastMs = timestampToMillis(data.lastEnergyUpdate) ?? nowMs;

    const regen = calculateEnergyState(rawEnergy, lastMs, nowMs);
    const spent = consumeOneEnergy(regen);
    if (!spent) {
      throw new PvpEnergyError("Not enough energy");
    }

    transaction.update(ref, {
      energy: spent.energy,
      lastEnergyUpdate: Timestamp.fromMillis(spent.lastEnergyUpdateMs),
    });
  });
}

export type PersistPvpResultInput = {
  won: boolean;
  xpGain: number;
  goldDelta: number;
  rankDelta: number;
};

/**
 * Apply XP (with level-ups), gold, and rank points after a PvP battle.
 */
export async function persistPvpBattleResult(
  uid: string,
  input: PersistPvpResultInput,
): Promise<void> {
  const db = getDb();
  const ref = await getUserProfileDocRef(uid);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("User not found");
    const data = snap.data() as Record<string, unknown>;

    const base = parseUserLevelFields(data);
    const afterXp = { ...base, xp: base.xp + input.xpGain };
    const finalState = applyLevelUp(afterXp);

    const prevGold =
      typeof data.gold === "number" && Number.isFinite(data.gold)
        ? data.gold
        : 0;
    const nextGold = Math.max(0, prevGold + input.goldDelta);

    const prevRank =
      typeof data.rankPoints === "number" && Number.isFinite(data.rankPoints)
        ? Math.floor(data.rankPoints)
        : 0;
    const nextRank = Math.max(0, prevRank + input.rankDelta);

    const prevWins = readNonNegIntField(data, "wins");
    const prevLosses = readNonNegIntField(data, "losses");
    const nextWins = input.won ? prevWins + 1 : prevWins;
    const nextLosses = input.won ? prevLosses : prevLosses + 1;

    transaction.update(ref, {
      level: finalState.level,
      xp: finalState.xp,
      xpToNext: finalState.xpToNext,
      stats: finalState.stats,
      gold: nextGold,
      rankPoints: nextRank,
      wins: nextWins,
      losses: nextLosses,
    });
  });

  await persistEffectiveCombatStats(uid);
}
