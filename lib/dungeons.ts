/**
 * Dungeon definitions: multi-stage runs, per-stage difficulty, end rewards.
 * Only the final stage awards gold / XP / item (handled in dungeon UI + claim).
 */

export type DungeonDefinition = {
  id: string;
  name: string;
  numberOfStages: number;
  /** Length must match `numberOfStages`. */
  stageMultipliers: number[];
  goldReward: number;
  xpReward: number;
};

export const DUNGEONS: readonly DungeonDefinition[] = [
  {
    id: "forgotten_crypt",
    name: "Forgotten Crypt",
    numberOfStages: 1,
    stageMultipliers: [1.05],
    goldReward: 28,
    xpReward: 40,
  },
  {
    id: "shadow_forest",
    name: "Shadow Forest",
    numberOfStages: 2,
    stageMultipliers: [1.12, 1.44],
    goldReward: 56,
    xpReward: 70,
  },
  {
    id: "infernal_depths",
    name: "Infernal Depths",
    numberOfStages: 3,
    stageMultipliers: [1.12, 1.44, 1.8],
    goldReward: 84,
    xpReward: 100,
  },
] as const;

export function getDungeonById(id: string): DungeonDefinition | undefined {
  return DUNGEONS.find((d) => d.id === id);
}

export function assertDungeonShape(d: DungeonDefinition): void {
  if (d.stageMultipliers.length !== d.numberOfStages) {
    throw new Error(
      `Dungeon ${d.id}: stageMultipliers length must equal numberOfStages`,
    );
  }
}

for (const d of DUNGEONS) {
  assertDungeonShape(d);
}
