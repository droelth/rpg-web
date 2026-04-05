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

/** One combat strike for UI (attack lunge, hit shake, crit flair). */
export type CombatAnimationCue = {
  attacker: CombatTurn;
  damage: number;
  isCrit: boolean;
};

export type RunCombatStepResult = RunCombatStepState & {
  winner: CombatTurn | null;
  logEntries: string[];
  animationCue: CombatAnimationCue;
};

/** One turn: damage, logs, death check, turn switch. Pure aside from RNG in calculateDamage. */
export function runCombatStep(state: RunCombatStepState): RunCombatStepResult {
  const { player, enemy, turn } = state;
  const logEntries: string[] = [];

  if (turn === "player") {
    const { damage, isCrit } = calculateDamage(player, enemy);
    const nextEnemy = cloneFighter(enemy);
    applyDamage(nextEnemy, damage);
    const animationCue: CombatAnimationCue = {
      attacker: "player",
      damage,
      isCrit,
    };
    if (isCrit) logEntries.push("CRITICAL HIT!");
    logEntries.push(`Player hits for ${damage} damage.`);
    if (isDead(nextEnemy)) {
      logEntries.push(`${enemy.name} is defeated!`);
      return {
        player,
        enemy: nextEnemy,
        turn,
        winner: "player",
        logEntries,
        animationCue,
      };
    }
    return {
      player,
      enemy: nextEnemy,
      turn: "enemy",
      winner: null,
      logEntries,
      animationCue,
    };
  }

  const { damage, isCrit } = calculateDamage(enemy, player);
  const nextPlayer = cloneFighter(player);
  applyDamage(nextPlayer, damage);
  const animationCue: CombatAnimationCue = {
    attacker: "enemy",
    damage,
    isCrit,
  };
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
      animationCue,
    };
  }
  return {
    player: nextPlayer,
    enemy,
    turn: "player",
    winner: null,
    logEntries,
    animationCue,
  };
}

/**
 * When both sides deal 0 damage every turn (e.g. def ≥ atk for both), combat never ends.
 * Skip-to-end runs this many steps synchronously; auto-combat uses the same cap per stage.
 */
export const MAX_COMBAT_RESOLUTION_STEPS = 12_000;

/** Break a damage stalemate: higher current HP wins; tie is random. */
export function resolveStalemateWinner(
  player: Fighter,
  enemy: Fighter,
): CombatTurn {
  if (player.currentHp > enemy.currentHp) return "player";
  if (player.currentHp < enemy.currentHp) return "enemy";
  return Math.random() < 0.5 ? "player" : "enemy";
}

/** Appended to the log when {@link MAX_COMBAT_RESOLUTION_STEPS} is hit or skip resolves a stalemate. */
export const STALEMATE_LOG_LINE =
  "Neither side can break the defense—fate declares a victor.";

export type SimulateCombatToWinnerResult = {
  player: Fighter;
  enemy: Fighter;
  turn: CombatTurn;
  winner: CombatTurn;
  /** All combat lines from simulated steps, plus {@link STALEMATE_LOG_LINE} when applicable. */
  logEntries: string[];
  /** True when no normal KO occurred within the step budget. */
  resolvedByStalemate: boolean;
};

/**
 * Fast-forward combat until a KO or until {@link MAX_COMBAT_RESOLUTION_STEPS}, then
 * {@link resolveStalemateWinner}. Use for Skip.
 */
export function simulateCombatToWinner(
  state: RunCombatStepState,
): SimulateCombatToWinnerResult {
  let p = state.player;
  let e = state.enemy;
  let t = state.turn;
  const logEntries: string[] = [];
  let w: CombatTurn | null = null;
  let steps = 0;

  while (!w && steps < MAX_COMBAT_RESOLUTION_STEPS) {
    steps += 1;
    const step = runCombatStep({ player: p, enemy: e, turn: t });
    logEntries.push(...step.logEntries);
    p = step.player;
    e = step.enemy;
    t = step.turn;
    w = step.winner;
  }

  let resolvedByStalemate = false;
  if (!w) {
    w = resolveStalemateWinner(p, e);
    logEntries.push(STALEMATE_LOG_LINE);
    resolvedByStalemate = true;
  }

  return {
    player: p,
    enemy: e,
    turn: t,
    winner: w,
    logEntries,
    resolvedByStalemate,
  };
}

/**
 * After real-time combat hits {@link MAX_COMBAT_RESOLUTION_STEPS} without a KO,
 * declare a victor without re-simulating (same rule as skip stalemate).
 */
export function resolveCombatStalemateFromState(
  state: RunCombatStepState,
): { winner: CombatTurn; logEntries: string[] } {
  return {
    winner: resolveStalemateWinner(state.player, state.enemy),
    logEntries: [STALEMATE_LOG_LINE],
  };
}
