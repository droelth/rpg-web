import type { Timestamp } from "firebase/firestore";

/** Max energy cap for PvP and UI. */
export const MAX_ENERGY = 10;

/** Regenerate one energy per interval (30 minutes). */
export const ENERGY_REGEN_MS = 30 * 60 * 1000;

export function timestampToMillis(ts: unknown): number | null {
  if (
    ts &&
    typeof ts === "object" &&
    "toMillis" in ts &&
    typeof (ts as Timestamp).toMillis === "function"
  ) {
    return (ts as Timestamp).toMillis();
  }
  return null;
}

export type EnergyCalculationResult = {
  energy: number;
  /** Anchor time for the next regen tick (ms since epoch). */
  lastEnergyUpdateMs: number;
  /** Number of full 30m intervals applied. */
  regenTicks: number;
};

/**
 * Apply passive regen: `floor((now - last) / 30m)` ticks, cap at MAX_ENERGY,
 * advance `lastEnergyUpdate` by `regenTicks * 30m` (not to `now`).
 */
export function calculateEnergyState(
  currentEnergy: number,
  lastEnergyUpdateMs: number,
  nowMs: number,
): EnergyCalculationResult {
  const e0 = Math.min(MAX_ENERGY, Math.max(0, Math.floor(currentEnergy)));
  const last = lastEnergyUpdateMs;
  const diff = Math.max(0, nowMs - last);
  const regenTicks = Math.floor(diff / ENERGY_REGEN_MS);
  if (regenTicks <= 0) {
    return { energy: e0, lastEnergyUpdateMs: last, regenTicks: 0 };
  }
  const newEnergy = Math.min(MAX_ENERGY, e0 + regenTicks);
  const newLast = last + regenTicks * ENERGY_REGEN_MS;
  return { energy: newEnergy, lastEnergyUpdateMs: newLast, regenTicks };
}

/** After regen, spend one energy if possible. Returns null if below 1. */
export function consumeOneEnergy(
  state: EnergyCalculationResult,
): { energy: number; lastEnergyUpdateMs: number } | null {
  if (state.energy < 1) return null;
  return {
    energy: state.energy - 1,
    lastEnergyUpdateMs: state.lastEnergyUpdateMs,
  };
}
