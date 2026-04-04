import type { Fighter, Stats } from "@/lib/combat";

export type MobType = "bruiser" | "assassin" | "caster" | "guardian";

const MOB_TYPES: readonly MobType[] = [
  "bruiser",
  "assassin",
  "caster",
  "guardian",
];

/**
 * Global tuning: all dungeon enemies are multiplied by this (lower = easier).
 * Applied after role profile + stage + variation.
 */
const DUNGEON_ENEMY_POWER = 0.86;

/** Per-role stat weights vs player snapshot (before stage multiplier & variation). */
const MOB_PROFILE: Record<
  MobType,
  { hp: number; atk: number; def: number; crit: number }
> = {
  bruiser: { hp: 1.08, atk: 0.9, def: 1.02, crit: 0.5 },
  assassin: { hp: 0.78, atk: 1.1, def: 0.78, crit: 1.2 },
  caster: { hp: 0.74, atk: 1.12, def: 0.68, crit: 0.95 },
  guardian: { hp: 1.05, atk: 0.82, def: 1.22, crit: 0.45 },
};

export const MOB_DISPLAY_NAME: Record<MobType, string> = {
  bruiser: "Crypt Bruiser",
  assassin: "Shadow Assassin",
  caster: "Abyss Caster",
  guardian: "Stone Guardian",
};

const MOB_PORTRAIT: Record<MobType, string> = {
  bruiser: "/images/mobs/bruiser.png",
  assassin: "/images/mobs/assassin.png",
  caster: "/images/mobs/caster.png",
  guardian: "/images/mobs/guardian.png",
};

/** Public path under `public/images/mobs/` for dungeon mob art. */
export function getMobPortraitPath(
  mobType: MobType | null | undefined,
): string {
  const key = mobType ?? "bruiser";
  return MOB_PORTRAIT[key];
}

/** Uniform multiplier in [0.9, 1.1] (~±10%). */
export function rollStatVariation(): number {
  return 0.9 + Math.random() * 0.2;
}

export function randomMobType(): MobType {
  return MOB_TYPES[Math.floor(Math.random() * MOB_TYPES.length)]!;
}

/**
 * Enemy stats scale from the player's combat snapshot (effective stats at run start),
 * dungeon stage multiplier, mob role, and a single ±10% roll.
 */
export function buildMobFighter(
  name: string,
  playerSnapshot: Stats,
  stageMultiplier: number,
  mobType: MobType,
): Fighter {
  const profile = MOB_PROFILE[mobType];
  const v = rollStatVariation();
  const scale = stageMultiplier * v * DUNGEON_ENEMY_POWER;

  const hp = Math.max(
    1,
    Math.floor(playerSnapshot.hp * profile.hp * scale),
  );
  const atk = Math.max(
    1,
    Math.floor(playerSnapshot.atk * profile.atk * scale),
  );
  const def = Math.max(
    0,
    Math.floor(playerSnapshot.def * profile.def * scale),
  );
  const crit = Math.max(
    0,
    Math.floor(playerSnapshot.crit * profile.crit * scale),
  );

  return {
    name,
    stats: { hp, atk, def, crit },
    currentHp: hp,
  };
}
