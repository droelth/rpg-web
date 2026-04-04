import { doc, runTransaction } from "firebase/firestore";
import type { EquippedState } from "@/types/item";
import { EMPTY_EQUIPPED, SLOT_ORDER } from "@/types/item";
import {
  generateInstanceId,
  inventoryToFirestore,
  parseInventory,
} from "@/lib/items";
import { getDb } from "./firebase";
import { parseEquipped } from "./inventoryUtils";
import {
  forgeAttemptSucceeds,
  forgeGoldCostForRarity,
  forgeOutcomeRoll,
  validateForgeSelection,
} from "./forgeSystem";

export class ForgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForgeError";
  }
}

export type ForgeMergeOutcome = "upgraded" | "shattered";

function readGold(data: Record<string, unknown>): number {
  const g = data.gold;
  if (typeof g === "number" && Number.isFinite(g)) {
    return Math.max(0, Math.floor(g));
  }
  return 0;
}

function clearEquippedIfConsumed(
  equipped: EquippedState,
  consumed: Set<string>,
): EquippedState {
  const next: EquippedState = { ...EMPTY_EQUIPPED };
  for (const slot of SLOT_ORDER) {
    const v = equipped[slot];
    next[slot] = v && consumed.has(v) ? null : v;
  }
  return next;
}

/**
 * Atomically charges forge gold, removes three matching instances, then either
 * adds one upgraded item (success) or nothing (shatter). Clears equipped slots
 * for consumed instances. Roll is deterministic per read so transaction retries match.
 */
export async function transactionForgeMerge(
  uid: string,
  selectedInstanceIds: string[],
): Promise<{ outcome: ForgeMergeOutcome }> {
  const db = getDb();
  const ref = doc(db, "users", uid);

  let outcome: ForgeMergeOutcome = "upgraded";

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new ForgeError("User not found");

    const data = snap.data() as Record<string, unknown>;
    const inventory = parseInventory(data.inventory);
    const validation = validateForgeSelection(inventory, selectedInstanceIds);

    if (!validation.ok) {
      throw new ForgeError(validation.reason);
    }

    const { instances, nextRarity, sourceRarity } = validation;
    const itemId = instances[0]!.itemId;
    const remove = new Set(selectedInstanceIds);

    const cost = forgeGoldCostForRarity(sourceRarity);
    const prevGold = readGold(data);
    if (prevGold < cost) {
      throw new ForgeError("Not enough gold to forge.");
    }

    const roll = forgeOutcomeRoll(uid, selectedInstanceIds, prevGold);
    const succeed = forgeAttemptSucceeds(roll, sourceRarity);
    outcome = succeed ? "upgraded" : "shattered";

    const nextGold = prevGold - cost;
    const nextInventory = inventory.filter((i) => !remove.has(i.instanceId));

    if (succeed) {
      nextInventory.push({
        instanceId: generateInstanceId(),
        itemId,
        rarity: nextRarity,
      });
    }

    const equipped = parseEquipped(data.equipped);
    const nextEquipped = clearEquippedIfConsumed(equipped, remove);

    transaction.update(ref, {
      inventory: inventoryToFirestore(nextInventory),
      equipped: nextEquipped,
      gold: nextGold,
    });
  });

  return { outcome };
}
