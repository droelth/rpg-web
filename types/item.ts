export type ItemType = "weapon" | "armor" | "helmet" | "ring";

export type ItemStats = {
  atk?: number;
  def?: number;
  hp?: number;
  crit?: number;
};

export type Item = {
  id: string;
  name: string;
  type: ItemType;
  stats: ItemStats;
};

export type EquippedState = {
  weapon: string | null;
  armor: string | null;
  helmet: string | null;
  ring: string | null;
};

export const EMPTY_EQUIPPED: EquippedState = {
  weapon: null,
  armor: null,
  helmet: null,
  ring: null,
};

export const SLOT_ORDER: ItemType[] = ["weapon", "armor", "helmet", "ring"];
