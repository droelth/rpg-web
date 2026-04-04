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

export type ForgeValidation =
  | { ok: true; instances: InventoryInstance[]; nextRarity: ItemRarity }
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

  return { ok: true, instances, nextRarity: nextR };
}
