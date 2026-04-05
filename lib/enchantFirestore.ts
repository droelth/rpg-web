import { runTransaction } from "firebase/firestore";
import {
  ENCHANT_BY_ID,
  isValidEnchantId,
  type EnchantId,
} from "@/lib/enchantCatalog";
import { getDb } from "./firebase";
import { getUserProfileDocRef } from "./userProfileFirestore";
import { inventoryToFirestore, parseInventory, resolveItem } from "./items";

export class EnchantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnchantError";
  }
}

function readGold(data: Record<string, unknown>): number {
  const g = data.gold;
  if (typeof g === "number" && Number.isFinite(g)) {
    return Math.max(0, Math.floor(g));
  }
  return 0;
}

/**
 * Deduct gold and set `enchant` on one inventory row (weapons only).
 * Replaces any existing enchant on that instance.
 */
export async function transactionApplyEnchant(
  uid: string,
  instanceId: string,
  enchantId: EnchantId,
): Promise<void> {
  if (!isValidEnchantId(enchantId)) {
    throw new EnchantError("Invalid enchant.");
  }
  const def = ENCHANT_BY_ID[enchantId];
  const db = getDb();
  const ref = await getUserProfileDocRef(uid);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new EnchantError("User not found.");

    const data = snap.data() as Record<string, unknown>;
    const inventory = parseInventory(data.inventory);
    const idx = inventory.findIndex((r) => r.instanceId === instanceId);
    if (idx < 0) throw new EnchantError("Item not in inventory.");

    const row = inventory[idx]!;
    const item = resolveItem(row.itemId);
    if (!item || item.type !== "weapon") {
      throw new EnchantError("Only weapons can be enchanted.");
    }

    if (row.enchant === enchantId) {
      throw new EnchantError("This weapon already has that enchant.");
    }

    const gold = readGold(data);
    if (gold < def.goldCost) {
      throw new EnchantError("Not enough gold.");
    }

    const nextInv = inventory.map((r, i) =>
      i === idx ? { ...r, enchant: enchantId } : r,
    );

    transaction.update(ref, {
      gold: gold - def.goldCost,
      inventory: inventoryToFirestore(nextInv),
    });
  });
}
