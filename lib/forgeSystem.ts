import type { InventoryInstance, ItemRarity } from "@/types/item";
import { resolveItem } from "@/lib/items";

export const RARITY_FORGE_ORDER: readonly ItemRarity[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
];

export function effectiveInstanceRarity(
  inst: InventoryInstance,
  catalogFallback: ItemRarity,
): ItemRarity {
  return inst.rarity ?? catalogFallback;
}

export function nextForgeRarity(current: ItemRarity): ItemRarity | null {
  const i = RARITY_FORGE_ORDER.indexOf(current);
  if (i < 0 || i >= RARITY_FORGE_ORDER.length - 1) return null;
  return RARITY_FORGE_ORDER[i + 1]!;
}

/** Gold charged per forge attempt (paid even if the forge fails). */
export const FORGE_GOLD_COST: Record<ItemRarity, number> = {
  common: 30,
  uncommon: 90,
  rare: 240,
  epic: 600,
  legendary: 0,
};

/**
 * Chance (0–1) that the forge destroys all three inputs with no upgraded item.
 * Success = keep cost paid, consume three, receive one next-tier item.
 */
export const FORGE_DESTROY_CHANCE: Record<ItemRarity, number> = {
  common: 0.18,
  uncommon: 0.24,
  rare: 0.32,
  epic: 0.42,
  legendary: 0,
};

export function forgeGoldCostForRarity(rarity: ItemRarity): number {
  return FORGE_GOLD_COST[rarity] ?? 0;
}

/** Probability the forge fails and items are lost (no output). */
export function forgeDestroyChanceForRarity(rarity: ItemRarity): number {
  return FORGE_DESTROY_CHANCE[rarity] ?? 0;
}

export type ForgeValidation =
  | {
      ok: true;
      instances: InventoryInstance[];
      nextRarity: ItemRarity;
      sourceRarity: ItemRarity;
    }
  | { ok: false; reason: string };

/**
 * Validates exactly three selected inventory instances for a forge merge.
 */
export function validateForgeSelection(
  inventory: InventoryInstance[],
  selectedInstanceIds: string[],
): ForgeValidation {
  if (selectedInstanceIds.length !== 3) {
    return { ok: false, reason: "Select exactly three items." };
  }

  const unique = new Set(selectedInstanceIds);
  if (unique.size !== 3) {
    return { ok: false, reason: "Select three different copies." };
  }

  const byId = new Map(inventory.map((i) => [i.instanceId, i]));
  const instances: InventoryInstance[] = [];
  for (const id of selectedInstanceIds) {
    const inst = byId.get(id);
    if (!inst) {
      return { ok: false, reason: "One or more items are missing." };
    }
    instances.push(inst);
  }

  const itemId = instances[0]!.itemId;
  if (!instances.every((i) => i.itemId === itemId)) {
    return { ok: false, reason: "All three must be the same item." };
  }

  const catalogItem = resolveItem(itemId);
  if (!catalogItem) {
    return { ok: false, reason: "Unknown item." };
  }

  const r0 = effectiveInstanceRarity(instances[0]!, catalogItem.rarity);
  if (
    !instances.every(
      (i) =>
        effectiveInstanceRarity(i, catalogItem.rarity) === r0,
    )
  ) {
    return { ok: false, reason: "All three must share the same rarity." };
  }

  if (r0 === "legendary") {
    return { ok: false, reason: "Legendary items cannot be forged further." };
  }

  const nextR = nextForgeRarity(r0);
  if (!nextR) {
    return { ok: false, reason: "Cannot upgrade this rarity." };
  }

  return { ok: true, instances, nextRarity: nextR, sourceRarity: r0 };
}

/**
 * Deterministic roll in [0, 1) for forge outcome so Firestore transaction retries
 * stay consistent. Uses uid, sorted instance ids, and a salt from current gold.
 */
export function forgeOutcomeRoll(
  uid: string,
  selectedInstanceIds: string[],
  goldSalt: number,
): number {
  const sorted = [...selectedInstanceIds].sort().join(",");
  const str = `${uid}\0${sorted}\0${goldSalt}`;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h % 1_000_000) / 1_000_000;
}

/** True = upgraded item created; false = all three items destroyed, no output. */
export function forgeAttemptSucceeds(
  roll01: number,
  sourceRarity: ItemRarity,
): boolean {
  const pDestroy = forgeDestroyChanceForRarity(sourceRarity);
  return roll01 >= pDestroy;
}
