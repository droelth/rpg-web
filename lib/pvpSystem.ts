import { collection, getDocs, limit, query } from "firebase/firestore";
import type { Fighter } from "@/lib/combat";
import type { CombatTotals } from "@/lib/inventoryUtils";
import { parseBaseStats, parseStoredEffectiveStats } from "@/lib/inventoryUtils";
import { getDb } from "./firebase";
import { parseUserLevelFields } from "./levelSystem";

export const PVP_XP_WIN = 30;
export const PVP_GOLD_WIN = 30;
export const PVP_XP_LOSS = 10;

export type PvpOpponentSnapshot = {
  id: string;
  username: string | null;
  level: number;
  class: string | null;
  /** Frozen combat stats for this match (from opponent doc at matchmaking time). */
  effectiveStats: CombatTotals;
  /** Ready-to-run combat entity (snapshot only). */
  fighter: Fighter;
};

const OPPONENT_SAMPLE_LIMIT = 80;

function docToOpponentSnapshot(
  id: string,
  data: Record<string, unknown>,
): PvpOpponentSnapshot | null {
  const lf = parseUserLevelFields(data);
  const stored = parseStoredEffectiveStats(data.effectiveStats);
  const effectiveStats: CombatTotals = stored ?? parseBaseStats(data.stats);
  const username =
    typeof data.username === "string" ? data.username.trim() || null : null;
  const name = username && username.length > 0 ? username : "Opponent";
  const fighter: Fighter = {
    name,
    stats: { ...effectiveStats },
    currentHp: effectiveStats.hp,
  };
  return {
    id,
    username,
    level: lf.level,
    class: lf.class,
    effectiveStats,
    fighter,
  };
}

/**
 * Pick a random other user from a bounded sample. Returns null if nobody else exists.
 */
export async function getRandomOpponent(
  currentUserId: string,
): Promise<PvpOpponentSnapshot | null> {
  const db = getDb();
  const q = query(collection(db, "users"), limit(OPPONENT_SAMPLE_LIMIT));
  const snap = await getDocs(q);
  const docs = snap.docs.filter((d) => d.id !== currentUserId);
  if (docs.length === 0) return null;
  const pick = docs[Math.floor(Math.random() * docs.length)]!;
  const data = pick.data() as Record<string, unknown>;
  return docToOpponentSnapshot(pick.id, data);
}

/** `levelDiff = opponentLevel - playerLevel` */
export function computePvpRankDeltaWin(
  playerLevel: number,
  opponentLevel: number,
): number {
  const levelDiff = opponentLevel - playerLevel;
  let delta = 20;
  if (levelDiff > 0) delta += levelDiff * 5;
  if (levelDiff < 0) delta += Math.abs(levelDiff) * 3;
  return delta;
}

export function computePvpRankDeltaLoss(
  playerLevel: number,
  opponentLevel: number,
): number {
  const levelDiff = opponentLevel - playerLevel;
  let delta = -10;
  if (levelDiff > 0) delta -= 5;
  if (levelDiff < 0) delta -= Math.abs(levelDiff) * 5;
  return delta;
}

export type PvpRewardBreakdown = {
  won: boolean;
  /** Draw: no stat changes (energy was still spent to start the match). */
  stalemate?: boolean;
  xpGain: number;
  goldDelta: number;
  rankDelta: number;
};

export function buildPvpStalemateRewards(): PvpRewardBreakdown {
  return {
    won: false,
    stalemate: true,
    xpGain: 0,
    goldDelta: 0,
    rankDelta: 0,
  };
}

export function buildPvpRewards(
  won: boolean,
  playerLevel: number,
  opponentLevel: number,
): PvpRewardBreakdown {
  if (won) {
    return {
      won: true,
      xpGain: PVP_XP_WIN,
      goldDelta: PVP_GOLD_WIN,
      rankDelta: computePvpRankDeltaWin(playerLevel, opponentLevel),
    };
  }
  return {
    won: false,
    xpGain: PVP_XP_LOSS,
    goldDelta: 0,
    rankDelta: computePvpRankDeltaLoss(playerLevel, opponentLevel),
  };
}
