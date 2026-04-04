export type Stats = {
  hp: number;
  atk: number;
  def: number;
  crit: number;
};

export type Fighter = {
  name: string;
  stats: Stats;
  currentHp: number;
};

export function decideFirstTurn(): "player" | "enemy" {
  return Math.random() < 0.5 ? "player" : "enemy";
}

export function calculateDamage(
  attacker: Fighter,
  defender: Fighter,
): { damage: number; isCrit: boolean } {
  const isCrit = Math.random() < attacker.stats.crit / 100;
  const attack = isCrit ? attacker.stats.atk * 1.5 : attacker.stats.atk;
  const damage = Math.max(0, Math.floor(attack - defender.stats.def));
  return { damage, isCrit };
}

export function applyDamage(defender: Fighter, damage: number): void {
  defender.currentHp = Math.max(0, defender.currentHp - damage);
}

export function isDead(fighter: Fighter): boolean {
  return fighter.currentHp <= 0;
}
