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
 * Last-resort cap for skip simulation only (HP rules should end combat first).
 */
export const MAX_COMBAT_RESOLUTION_STEPS = 50_000;

/** Rounds 1–10: if neither HP changed from fight start → stalemate. */
export const STAGNATION_CHECK_AFTER_STEP = 10;

/** Rounds 10–20: if neither HP changed since end of round 10 → stalemate. */
export const STAGNATION_SECOND_CHECK_AFTER_STEP = 20;

/** Ten consecutive strikes where both fighters’ HP match the rolling baseline. */
export const STAGNATION_CONSECUTIVE_STEPS = 10;

export const STALEMATE_LOG_LINE =
  "The fight stops here—neither side can force a result.";

export const STALEMATE_LOG_CONSECUTIVE =
  "Ten blows in a row leave both fighters unchanged—a stalemate.";

export const STALEMATE_LOG_ROUND10 =
  "After ten rounds no one has lost ground—a stalemate.";

export const STALEMATE_LOG_ROUND20 =
  "Ten more rounds pass with no change—a stalemate.";

export type HpStagnationState = {
  initialPlayerHp: number;
  initialEnemyHp: number;
  hpAfterRound10Player: number | null;
  hpAfterRound10Enemy: number | null;
  rollingBaselinePlayerHp: number;
  rollingBaselineEnemyHp: number;
  consecutiveStagnantSteps: number;
  totalSteps: number;
};

export function createHpStagnationState(
  player: Fighter,
  enemy: Fighter,
): HpStagnationState {
  return {
    initialPlayerHp: player.currentHp,
    initialEnemyHp: enemy.currentHp,
    hpAfterRound10Player: null,
    hpAfterRound10Enemy: null,
    rollingBaselinePlayerHp: player.currentHp,
    rollingBaselineEnemyHp: enemy.currentHp,
    consecutiveStagnantSteps: 0,
    totalSteps: 0,
  };
}

export type StagnationAdvanceResult =
  | { next: HpStagnationState; stalemate: false }
  | { next: HpStagnationState; stalemate: true; logLine: string };

/**
 * Call once per {@link runCombatStep} with fighters **after** that step.
 * Stalemate if: 10 strikes in a row with no HP change, or no HP change over rounds 1–10,
 * or no HP change over rounds 10–20 (vs HP snapshot after round 10).
 */
export function advanceHpStagnationAfterStep(
  afterPlayer: Fighter,
  afterEnemy: Fighter,
  prev: HpStagnationState,
): StagnationAdvanceResult {
  const totalSteps = prev.totalSteps + 1;

  const sameRolling =
    afterPlayer.currentHp === prev.rollingBaselinePlayerHp &&
    afterEnemy.currentHp === prev.rollingBaselineEnemyHp;

  let rollingBaselinePlayerHp = prev.rollingBaselinePlayerHp;
  let rollingBaselineEnemyHp = prev.rollingBaselineEnemyHp;
  let consecutiveStagnantSteps = prev.consecutiveStagnantSteps;

  if (!sameRolling) {
    rollingBaselinePlayerHp = afterPlayer.currentHp;
    rollingBaselineEnemyHp = afterEnemy.currentHp;
    consecutiveStagnantSteps = 0;
  } else {
    consecutiveStagnantSteps = prev.consecutiveStagnantSteps + 1;
  }

  let hpAfterRound10Player = prev.hpAfterRound10Player;
  let hpAfterRound10Enemy = prev.hpAfterRound10Enemy;

  if (totalSteps === STAGNATION_CHECK_AFTER_STEP) {
    hpAfterRound10Player = afterPlayer.currentHp;
    hpAfterRound10Enemy = afterEnemy.currentHp;
  }

  const next: HpStagnationState = {
    initialPlayerHp: prev.initialPlayerHp,
    initialEnemyHp: prev.initialEnemyHp,
    totalSteps,
    rollingBaselinePlayerHp,
    rollingBaselineEnemyHp,
    consecutiveStagnantSteps,
    hpAfterRound10Player,
    hpAfterRound10Enemy,
  };

  if (consecutiveStagnantSteps >= STAGNATION_CONSECUTIVE_STEPS) {
    return { next, stalemate: true, logLine: STALEMATE_LOG_CONSECUTIVE };
  }

  if (totalSteps === STAGNATION_CHECK_AFTER_STEP) {
    if (
      afterPlayer.currentHp === prev.initialPlayerHp &&
      afterEnemy.currentHp === prev.initialEnemyHp
    ) {
      return { next, stalemate: true, logLine: STALEMATE_LOG_ROUND10 };
    }
  }

  if (
    totalSteps === STAGNATION_SECOND_CHECK_AFTER_STEP &&
    prev.hpAfterRound10Player != null &&
    prev.hpAfterRound10Enemy != null
  ) {
    if (
      afterPlayer.currentHp === prev.hpAfterRound10Player &&
      afterEnemy.currentHp === prev.hpAfterRound10Enemy
    ) {
      return { next, stalemate: true, logLine: STALEMATE_LOG_ROUND20 };
    }
  }

  return { next, stalemate: false };
}

export type SimulateCombatToWinnerResult =
  | {
      kind: "ko";
      player: Fighter;
      enemy: Fighter;
      turn: CombatTurn;
      winner: CombatTurn;
      logEntries: string[];
    }
  | {
      kind: "stalemate";
      player: Fighter;
      enemy: Fighter;
      turn: CombatTurn;
      logEntries: string[];
    };

/**
 * Fast-forward combat until a KO or HP-based stalemate. Use for Skip.
 */
export function simulateCombatToWinner(
  state: RunCombatStepState,
): SimulateCombatToWinnerResult {
  let p = state.player;
  let e = state.enemy;
  let t = state.turn;
  const logEntries: string[] = [];
  let stagnation = createHpStagnationState(p, e);
  let steps = 0;

  while (steps < MAX_COMBAT_RESOLUTION_STEPS) {
    steps += 1;
    const step = runCombatStep({ player: p, enemy: e, turn: t });
    logEntries.push(...step.logEntries);
    p = step.player;
    e = step.enemy;
    t = step.turn;

    if (step.winner) {
      return {
        kind: "ko",
        player: p,
        enemy: e,
        turn: t,
        winner: step.winner,
        logEntries,
      };
    }

    const st = advanceHpStagnationAfterStep(p, e, stagnation);
    stagnation = st.next;
    if (st.stalemate) {
      logEntries.push(st.logLine);
      return {
        kind: "stalemate",
        player: p,
        enemy: e,
        turn: t,
        logEntries,
      };
    }
  }

  logEntries.push(STALEMATE_LOG_LINE);
  return {
    kind: "stalemate",
    player: p,
    enemy: e,
    turn: t,
    logEntries,
  };
}
