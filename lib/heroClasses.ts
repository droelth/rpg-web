export type HeroStats = {
  hp: number;
  def: number;
  atk: number;
  crit: number;
};

export type HeroClassDef = {
  id: string;
  name: string;
  description: string;
  image: string;
  stats: HeroStats;
};

/**
 * Each `image` path is served from this app’s `public/` folder (not the repo root).
 * Example: `/images/warrior.png` → `rpg-web/public/images/warrior.png`.
 * File names and extensions must match exactly (case-sensitive on Linux/Vercel).
 */
export const HERO_CLASSES: HeroClassDef[] = [
  {
    id: "warrior",
    name: "Warrior",
    description:
      "A balanced melee fighter with strong defense and reliable attacks.",
    image: "/images/warrior.png",
    stats: { hp: 30, def: 4, atk: 6, crit: 10 },
  },
  {
    id: "mage",
    name: "Mage",
    description:
      "A fragile but powerful spellcaster with high critical damage.",
    image: "/images/mage.png",
    stats: { hp: 15, def: 1, atk: 9, crit: 18 },
  },
  {
    id: "ranger",
    name: "Ranger",
    description:
      "A fast and precise ranged attacker with balanced offense.",
    image: "/images/ranger.png",
    stats: { hp: 20, def: 2, atk: 7, crit: 15 },
  },
  {
    id: "paladin",
    name: "Paladin",
    description:
      "A durable protector with high health and defensive strength.",
    image: "/images/paladin.png",
    stats: { hp: 35, def: 5, atk: 5, crit: 6 },
  },
];

/** Default hero when the slider loads (first card is centered). */
export const DEFAULT_HERO_ID = HERO_CLASSES[0]!.id;
