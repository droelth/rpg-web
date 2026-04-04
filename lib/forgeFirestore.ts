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
import { validateForgeSelection } from "./forgeSystem";

export class ForgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForgeError";
  }
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
 * Atomically removes three matching instances and adds one upgraded instance.
 * Clears equipped slots that referenced any consumed instance.
 */
export async function transactionForgeMerge(
  uid: string,
  selectedInstanceIds: string[],
): Promise<void> {
  const db = getDb();
  const ref = doc(db, "users", uid);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new ForgeError("User not found");

    const data = snap.data() as Record<string, unknown>;
    const inventory = parseInventory(data.inventory);
    const validation = validateForgeSelection(inventory, selectedInstanceIds);

    if (!validation.ok) {
      throw new ForgeError(validation.reason);
    }

    const { instances, nextRarity } = validation;
    const itemId = instances[0]!.itemId;
    const remove = new Set(selectedInstanceIds);

    const nextInventory = inventory.filter((i) => !remove.has(i.instanceId));
    nextInventory.push({
      instanceId: generateInstanceId(),
      itemId,
      rarity: nextRarity,
    });

    const equipped = parseEquipped(data.equipped);
    const nextEquipped = clearEquippedIfConsumed(equipped, remove);

    transaction.update(ref, {
      inventory: inventoryToFirestore(nextInventory),
      equipped: nextEquipped,
    });
  });
}
