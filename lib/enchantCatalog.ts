import type { EnchantId, EquippedState, InventoryInstance } from "@/types/item";

export type { EnchantId } from "@/types/item";

export type EnchantKind =
  | "dot_poison"
  | "stat_crit"
  | "lifesteal"
  | "enemy_next_hit_penalty";

export type EnchantDefinition = {
  id: EnchantId;
  name: string;
  description: string;
  goldCost: number;
  kind: EnchantKind;
};

export const ENCHANTS: readonly EnchantDefinition[] = [
  {
    id: "poison",
    name: "Poison",
    description:
      "After your first damaging hit, poison ticks at the start of each of your turns for 1–5 damage (rises each turn, caps at 5).",
    goldCost: 80,
    kind: "dot_poison",
  },
  {
    id: "keen",
    name: "Keen",
    description: "+5 crit for this fight only.",
    goldCost: 60,
    kind: "stat_crit",
  },
  {
    id: "vampiric",
    name: "Vampiric",
    description: "Heal for 15% of damage dealt on your weapon strikes.",
    goldCost: 100,
    kind: "lifesteal",
  },
  {
    id: "frost",
    name: "Frost",
    description: "Your weapon hits reduce the enemy’s next attack by 2 damage.",
    goldCost: 70,
    kind: "enemy_next_hit_penalty",
  },
] as const;

const ENCHANT_IDS = new Set<string>(ENCHANTS.map((e) => e.id));

export function isValidEnchantId(v: unknown): v is EnchantId {
  return typeof v === "string" && ENCHANT_IDS.has(v);
}

export const ENCHANT_BY_ID: Record<EnchantId, EnchantDefinition> =
  ENCHANTS.reduce(
    (acc, e) => {
      acc[e.id] = e;
      return acc;
    },
    {} as Record<EnchantId, EnchantDefinition>,
  );

/** Maps stored enchant id to combat runtime key (1:1 for these enchants). */
export type WeaponEnchantRuntime = EnchantId | null;

export function weaponEnchantForCombat(
  enchant?: EnchantId,
): WeaponEnchantRuntime {
  if (!enchant || !isValidEnchantId(enchant)) return null;
  return enchant;
}

export function resolveEquippedWeaponEnchant(
  inventory: InventoryInstance[],
  equipped: EquippedState,
): WeaponEnchantRuntime {
  const wid = equipped.weapon;
  if (!wid) return null;
  const row = inventory.find((r) => r.instanceId === wid);
  return weaponEnchantForCombat(row?.enchant);
}
