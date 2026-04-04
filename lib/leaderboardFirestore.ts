import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";

export const LEADERBOARD_LIMIT = 50;

export type LeaderboardEntry = {
  id: string;
  username: string;
  rankPoints: number;
  wins: number;
  losses: number;
};

/** Win rate 0–100 with one decimal, or null if no PvP games recorded. */
export function winRatePercent(wins: number, losses: number): number | null {
  const total = wins + losses;
  if (total === 0) return null;
  return Math.round((wins / total) * 1000) / 10;
}

function readNonNegInt(d: Record<string, unknown>, key: string): number {
  const v = d[key];
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.max(0, Math.floor(v));
  }
  return 0;
}

/**
 * Top players by `rankPoints` (server-side limit only; does not scan whole collection).
 */
export async function fetchLeaderboardTop(
  maxRows = LEADERBOARD_LIMIT,
): Promise<LeaderboardEntry[]> {
  const db = getDb();
  const q = query(
    collection(db, "users"),
    orderBy("rankPoints", "desc"),
    limit(Math.min(100, Math.max(1, maxRows))),
  );
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => {
    const d = docSnap.data() as Record<string, unknown>;
    const rawName = d.username;
    const username =
      typeof rawName === "string" && rawName.trim().length > 0
        ? rawName.trim()
        : "Adventurer";
    return {
      id: docSnap.id,
      username,
      rankPoints: readNonNegInt(d, "rankPoints"),
      wins: readNonNegInt(d, "wins"),
      losses: readNonNegInt(d, "losses"),
    };
  });
}
