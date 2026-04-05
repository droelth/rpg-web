import { getDoc, updateDoc } from "firebase/firestore";
import type { InventoryInstance } from "@/types/item";
import { INITIAL_USER_GOLD } from "@/lib/getOrCreateUser";
import { getDb } from "@/lib/firebase";
import { getUserProfileDocRef } from "@/lib/userProfileFirestore";
import { inventoryToFirestore, parseInventory } from "@/lib/items";
import { persistEffectiveCombatStats } from "@/lib/inventoryUtils";
import { applyLevelUp, parseUserLevelFields } from "@/lib/levelSystem";

export type DungeonClaimPayload = {
  goldDelta: number;
  xpDelta: number;
  newInstance: InventoryInstance;
};

/**
 * Apply dungeon rewards: gold, XP (with level-ups on base stats), new inventory row, then refresh effectiveStats.
 */
export async function persistDungeonClaim(
  uid: string,
  payload: DungeonClaimPayload,
): Promise<void> {
  const ref = await getUserProfileDocRef(uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error("User document not found");
  }
  const data = snap.data() as Record<string, unknown>;
  const base = parseUserLevelFields(data);
  const inventory = parseInventory(data.inventory);
  const goldRaw = data.gold;
  const prevGold =
    typeof goldRaw === "number" && Number.isFinite(goldRaw)
      ? goldRaw
      : INITIAL_USER_GOLD;
  const gold = prevGold + payload.goldDelta;

  const afterXp = { ...base, xp: base.xp + payload.xpDelta };
  const finalState = applyLevelUp(afterXp);
  const nextInventory = [...inventory, payload.newInstance];

  await updateDoc(ref, {
    gold,
    level: finalState.level,
    xp: finalState.xp,
    xpToNext: finalState.xpToNext,
    stats: finalState.stats,
    inventory: inventoryToFirestore(nextInventory),
  });
  await persistEffectiveCombatStats(uid);
}
