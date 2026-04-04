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

function cloneFighter(f: Fighter): Fighter {
  return {
    ...f,
    stats: { ...f.stats },
  };
}

export type CombatTurn = "player" | "enemy";

export type RunCombatStepState = {
  player: Fighter;
  enemy: Fighter;
  turn: CombatTurn;
};

export type RunCombatStepResult = RunCombatStepState & {
  winner: CombatTurn | null;
  logEntries: string[];
};

/** One turn: damage, logs, death check, turn switch. Pure aside from RNG in calculateDamage. */
export function runCombatStep(state: RunCombatStepState): RunCombatStepResult {
  const { player, enemy, turn } = state;
  const logEntries: string[] = [];

  if (turn === "player") {
    const { damage, isCrit } = calculateDamage(player, enemy);
    const nextEnemy = cloneFighter(enemy);
    applyDamage(nextEnemy, damage);
    if (isCrit) logEntries.push("CRITICAL HIT!");
    logEntries.push(`Player hits for ${damage} damage.`);
    if (isDead(nextEnemy)) {
      logEntries.push("Training Dummy is defeated!");
      return {
        player,
        enemy: nextEnemy,
        turn,
        winner: "player",
        logEntries,
      };
    }
    return {
      player,
      enemy: nextEnemy,
      turn: "enemy",
      winner: null,
      logEntries,
    };
  }

  const { damage, isCrit } = calculateDamage(enemy, player);
  const nextPlayer = cloneFighter(player);
  applyDamage(nextPlayer, damage);
  if (isCrit) logEntries.push("CRITICAL HIT!");
  logEntries.push(`${enemy.name} hits for ${damage} damage.`);
  if (isDead(nextPlayer)) {
    logEntries.push("You are defeated!");
    return {
      player: nextPlayer,
      enemy,
      turn,
      winner: "enemy",
      logEntries,
    };
  }
  return {
    player: nextPlayer,
    enemy,
    turn: "player",
    winner: null,
    logEntries,
  };
}
