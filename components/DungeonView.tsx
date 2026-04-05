"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatedCombatPortrait } from "@/components/combat/AnimatedCombatPortrait";
import { AnimatedHpBar } from "@/components/combat/AnimatedHpBar";
import { CombatAnimatedLog } from "@/components/combat/CombatAnimatedLog";
import {
  advanceHpStagnationAfterStep,
  createHpStagnationState,
  decideFirstTurn,
  MAX_COMBAT_RESOLUTION_STEPS,
  runCombatStep,
  simulateCombatToWinner,
  STALEMATE_LOG_LINE,
  type CombatAnimationCue,
  type Fighter,
  type HpStagnationState,
  type Stats,
} from "@/lib/combat";
import {
  appendCombatLogLines,
  initialCombatLogLines,
  type CombatLogLine,
} from "@/lib/combatLog";
import type { DungeonDefinition } from "@/lib/dungeons";
import { DUNGEONS } from "@/lib/dungeons";
import { persistDungeonClaim } from "@/lib/dungeonFirestore";
import type { DungeonDrop } from "@/lib/dungeonRewards";
import { rollDungeonDrop } from "@/lib/dungeonRewards";
import { getInventoryPortraitPath } from "@/lib/classPortrait";
import { getOrCreateUser, type UserDocument } from "@/lib/getOrCreateUser";
import { INITIAL_USER_ENERGY } from "@/lib/getOrCreateUser";
import { ensureInventoryDefaults } from "@/lib/inventoryUtils";
import type { CombatTotals } from "@/lib/inventoryUtils";
import { generateInstanceId } from "@/lib/items";
import {
  buildMobFighter,
  getMobPortraitPath,
  MOB_DISPLAY_NAME,
  randomMobType,
  type MobType,
} from "@/lib/mobs";
import { rarityLabelClass } from "@/lib/itemRarityStyles";
import { useAuth } from "@/hooks/useAuth";
import { TopBar } from "@/components/TopBar";

type Phase =
  | "loading"
  | "select"
  | "combat"
  | "reward"
  | "failed"
  | "stalemate"
  | "claiming";

type PendingReward = {
  gold: number;
  xp: number;
  drop: DungeonDrop;
};

export function DungeonView() {
  const { user, loading: authLoading, authError } = useAuth();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [profile, setProfile] = useState<UserDocument | null>(null);

  const [activeDungeon, setActiveDungeon] = useState<DungeonDefinition | null>(
    null,
  );
  const [stageIndex, setStageIndex] = useState(0);
  const statsSnapshotRef = useRef<Stats | null>(null);
  const classIdRef = useRef<string | null>(null);

  const [player, setPlayer] = useState<Fighter | null>(null);
  const [enemy, setEnemy] = useState<Fighter | null>(null);
  const [turn, setTurn] = useState<"player" | "enemy">("player");
  const [log, setLog] = useState<CombatLogLine[]>([]);
  const [strikeSeq, setStrikeSeq] = useState(0);
  const [lastCue, setLastCue] = useState<CombatAnimationCue | null>(null);
  const [winner, setWinner] = useState<"player" | "enemy" | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [pendingReward, setPendingReward] = useState<PendingReward | null>(
    null,
  );
  const [claimError, setClaimError] = useState<string | null>(null);
  const [activeMobType, setActiveMobType] = useState<MobType | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logScrollRef = useRef<HTMLUListElement | null>(null);
  /** Per-stage HP stagnation tracker; resets when dungeon or stage changes. */
  const stagnationRef = useRef<HpStagnationState | null>(null);
  /** Safety cap if stagnation logic ever fails to fire. */
  const autoCombatStepCountRef = useRef(0);

  const activeDungeonRef = useRef<DungeonDefinition | null>(null);
  const stageIndexRef = useRef(0);
  activeDungeonRef.current = activeDungeon;
  stageIndexRef.current = stageIndex;

  const isFinished = winner !== null;

  const clearCombatTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (authError) {
      setPhase("select");
      setLoadError(authError);
      return;
    }
    if (!user) {
      setPhase("select");
      setLoadError(null);
      setProfile(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await ensureInventoryDefaults(user.uid);
        const doc = await getOrCreateUser(user.uid);
        if (cancelled) return;
        setProfile(doc);
        setLoadError(null);
        setPhase("select");
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setLoadError("Could not load your profile.");
          setPhase("select");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, authError, user]);

  function spawnEnemyForStage(
    dungeon: DungeonDefinition,
    stage: number,
    snapshot: Stats,
  ): { fighter: Fighter; mobType: MobType } {
    const mult = dungeon.stageMultipliers[stage] ?? 1;
    const mob = randomMobType();
    const label = MOB_DISPLAY_NAME[mob];
    const name = `${label} · Stage ${stage + 1}/${dungeon.numberOfStages}`;
    return {
      fighter: buildMobFighter(name, snapshot, mult, mob),
      mobType: mob,
    };
  }

  const beginDungeon = useCallback(
    (dungeon: DungeonDefinition) => {
      if (!profile || !user) return;
      const snap: Stats = { ...profile.effectiveStats };
      statsSnapshotRef.current = snap;
      classIdRef.current = profile.class;

      const name = profile.username?.trim() || "Hero";
      const p: Fighter = {
        name,
        stats: { ...snap },
        currentHp: snap.hp,
      };
      const { fighter: e, mobType } = spawnEnemyForStage(dungeon, 0, snap);
      const first = decideFirstTurn();

      setActiveDungeon(dungeon);
      setStageIndex(0);
      setPendingReward(null);
      setClaimError(null);
      setWinner(null);
      setActiveMobType(mobType);
      setPlayer(p);
      setEnemy(e);
      setTurn(first);
      setStrikeSeq(0);
      setLastCue(null);
      setLog(
        initialCombatLogLines([
          `Entering ${dungeon.name}…`,
          first === "player" ? "You take the first turn!" : `${e.name} moves first!`,
        ]),
      );
      stagnationRef.current = createHpStagnationState(p, e);
      autoCombatStepCountRef.current = 0;
      setPhase("combat");
      setIsRunning(true);
    },
    [profile, user],
  );

  const handlePlayerWonStage = useCallback(
    (survivingPlayer: Fighter) => {
      const dungeon = activeDungeonRef.current;
      const s = stageIndexRef.current;
      if (!dungeon) return;

      if (s >= dungeon.numberOfStages - 1) {
        const drop = rollDungeonDrop(classIdRef.current);
        setPendingReward({
          gold: dungeon.goldReward,
          xp: dungeon.xpReward,
          drop,
        });
        setPhase("reward");
        setWinner("player");
        setIsRunning(false);
        return;
      }

      const next = s + 1;
      setStageIndex(next);
      const snap = statsSnapshotRef.current;
      if (!snap) return;
      const { fighter: nextEnemy, mobType } = spawnEnemyForStage(
        dungeon,
        next,
        snap,
      );
      const first = decideFirstTurn();
      setActiveMobType(mobType);
      setPlayer(survivingPlayer);
      setEnemy(nextEnemy);
      setWinner(null);
      setTurn(first);
      setStrikeSeq(0);
      setLastCue(null);
      setLog((prev) =>
        appendCombatLogLines(prev, [
          `Stage ${s + 1} cleared!`,
          `--- Stage ${next + 1} ---`,
          first === "player"
            ? "You take the first turn!"
            : `${nextEnemy.name} moves first!`,
        ]),
      );
      stagnationRef.current = createHpStagnationState(
        survivingPlayer,
        nextEnemy,
      );
      autoCombatStepCountRef.current = 0;
      setIsRunning(true);
    },
    [],
  );

  const handleCombatLoss = useCallback(() => {
    setPhase("failed");
    setIsRunning(false);
  }, []);

  useEffect(() => {
    if (phase !== "combat" || !isRunning || isFinished || !player || !enemy) {
      return;
    }

    const delayMs = 1000 / speed;
    const id = setTimeout(() => {
      timerRef.current = null;
      autoCombatStepCountRef.current += 1;
      if (autoCombatStepCountRef.current > MAX_COMBAT_RESOLUTION_STEPS) {
        setLog((prev) =>
          appendCombatLogLines(prev, [STALEMATE_LOG_LINE]),
        );
        setLastCue(null);
        setPlayer(player);
        setEnemy(enemy);
        setTurn(turn);
        setIsRunning(false);
        setPhase("stalemate");
        return;
      }

      const step = runCombatStep({ player, enemy, turn });

      setStrikeSeq((n) => n + 1);
      setLastCue(step.animationCue);
      setLog((prev) => appendCombatLogLines(prev, step.logEntries));
      setPlayer(step.player);
      setEnemy(step.enemy);
      setTurn(step.turn);

      if (step.winner === "player") {
        setWinner("player");
        setIsRunning(false);
        handlePlayerWonStage(step.player);
      } else if (step.winner === "enemy") {
        setWinner("enemy");
        setIsRunning(false);
        handleCombatLoss();
      } else {
        const stRef = stagnationRef.current;
        if (stRef) {
          const adv = advanceHpStagnationAfterStep(
            step.player,
            step.enemy,
            stRef,
          );
          stagnationRef.current = adv.next;
          if (adv.stalemate) {
            setLog((prev) =>
              appendCombatLogLines(prev, [adv.logLine]),
            );
            setLastCue(null);
            setIsRunning(false);
            setPhase("stalemate");
          }
        }
      }
    }, delayMs);

    timerRef.current = id;
    return () => {
      clearTimeout(id);
      if (timerRef.current === id) timerRef.current = null;
    };
  }, [
    phase,
    isRunning,
    isFinished,
    speed,
    turn,
    player,
    enemy,
    handlePlayerWonStage,
    handleCombatLoss,
  ]);

  const handleSkipCombat = useCallback(() => {
    if (!player || !enemy || isFinished || phase !== "combat") return;
    clearCombatTimer();

    const result = simulateCombatToWinner({ player, enemy, turn });

    setLog((prev) => appendCombatLogLines(prev, result.logEntries));
    setLastCue(null);
    setPlayer(result.player);
    setEnemy(result.enemy);
    setTurn(result.turn);
    setIsRunning(false);

    if (result.kind === "stalemate") {
      setWinner(null);
      setPhase("stalemate");
      return;
    }

    setWinner(result.winner);
    if (result.winner === "player") {
      handlePlayerWonStage(result.player);
    } else {
      handleCombatLoss();
    }
  }, [
    player,
    enemy,
    turn,
    isFinished,
    phase,
    clearCombatTimer,
    handlePlayerWonStage,
    handleCombatLoss,
  ]);

  const resetToHub = useCallback(() => {
    clearCombatTimer();
    setActiveDungeon(null);
    setStageIndex(0);
    setPlayer(null);
    setEnemy(null);
    setWinner(null);
    setLog([]);
    setStrikeSeq(0);
    setLastCue(null);
    setPendingReward(null);
    setClaimError(null);
    setPhase("select");
    setIsRunning(false);
    setActiveMobType(null);
    statsSnapshotRef.current = null;
    stagnationRef.current = null;
    autoCombatStepCountRef.current = 0;
  }, [clearCombatTimer]);

  const handleClaimReward = useCallback(async () => {
    if (!user || !pendingReward) return;
    setClaimError(null);
    setPhase("claiming");
    try {
      const newInstance = {
        instanceId: generateInstanceId(),
        itemId: pendingReward.drop.itemId,
        rarity: pendingReward.drop.rarity,
      };
      await persistDungeonClaim(user.uid, {
        goldDelta: pendingReward.gold,
        xpDelta: pendingReward.xp,
        newInstance,
      });
      const fresh = await getOrCreateUser(user.uid);
      setProfile(fresh);
      resetToHub();
    } catch (e) {
      console.error(e);
      setClaimError("Could not claim rewards. Try again.");
      setPhase("reward");
    }
  }, [user, pendingReward, resetToHub]);

  useLayoutEffect(() => {
    const el = logScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [log]);

  const topBarTotals: CombatTotals = profile?.effectiveStats ?? {
    hp: 0,
    atk: 0,
    def: 0,
    crit: 0,
  };

  if (authError) {
    return (
      <div className="p-6 text-center text-red-400">
        <p>{authError}</p>
        <Link href="/" className="mt-4 inline-block text-amber-400 underline">
          Home
        </Link>
      </div>
    );
  }

  if (authLoading || phase === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-950 text-zinc-400">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 text-center text-zinc-400">
        <p>Sign in required.</p>
        <Link href="/" className="mt-4 inline-block text-amber-400 underline">
          Home
        </Link>
      </div>
    );
  }

  if (loadError && !profile) {
    return (
      <div className="p-6 text-center text-red-400">
        <p>{loadError}</p>
        <Link href="/" className="mt-4 inline-block text-amber-400 underline">
          Home
        </Link>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="relative flex min-h-dvh w-full justify-center overflow-hidden bg-black">
      <div
        className="pointer-events-none absolute inset-0 scale-105 bg-[url('/images/menu-bg.svg')] bg-cover bg-center opacity-40"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-black/60 backdrop-blur-[1px]" aria-hidden />

      <div className="relative z-10 flex min-h-dvh w-full max-w-md flex-col">
        <TopBar
          level={profile.level}
          xp={profile.xp}
          xpToNext={profile.xpToNext}
          username={profile.username?.trim() || "Adventurer"}
          gold={profile.gold}
          energy={profile.energy}
          energyMax={INITIAL_USER_ENERGY}
          combatTotals={topBarTotals}
        />

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-8 pt-2 text-zinc-100">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="text-sm text-amber-500/90 hover:text-amber-400"
            >
              ← Main menu
            </Link>
            <h1 className="text-lg font-semibold text-amber-100/95">Dungeons</h1>
            <span className="w-16" aria-hidden />
          </div>

          {phase === "select" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-zinc-400">
                Multi-stage runs: your HP carries between fights. Rewards drop only
                after the final stage.
              </p>
              <ul className="flex flex-col gap-3">
                {DUNGEONS.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => beginDungeon(d)}
                      className="w-full rounded-2xl border border-violet-500/35 bg-zinc-900/90 px-4 py-4 text-left shadow-lg transition hover:border-violet-400/50 hover:bg-zinc-900"
                    >
                      <span className="block text-base font-semibold text-violet-200">
                        {d.name}
                      </span>
                      <span className="mt-1 block text-xs text-zinc-400">
                        {d.numberOfStages} stage
                        {d.numberOfStages > 1 ? "s" : ""} · +{d.goldReward} gold,
                        +{d.xpReward} XP &amp; item on clear
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {phase === "combat" && player && enemy && activeDungeon && (
            <>
              <p className="text-center text-xs text-violet-300/90">
                {activeDungeon.name} · Stage {stageIndex + 1}/
                {activeDungeon.numberOfStages}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <AnimatedCombatPortrait
                    src={getInventoryPortraitPath(profile?.class)}
                    alt={player.name}
                    layoutSide="left"
                    role="player"
                    strikeSeq={strikeSeq}
                    lastCue={lastCue}
                  />
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3">
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="truncate text-zinc-400">{player.name}</span>
                      <span className="shrink-0 font-mono tabular-nums text-emerald-200/90">
                        {player.currentHp} / {player.stats.hp}
                      </span>
                    </div>
                    <AnimatedHpBar
                      fraction={player.stats.hp > 0 ? player.currentHp / player.stats.hp : 0}
                      colorClass="bg-emerald-600"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <AnimatedCombatPortrait
                    src={getMobPortraitPath(activeMobType)}
                    alt={enemy.name}
                    layoutSide="right"
                    role="enemy"
                    strikeSeq={strikeSeq}
                    lastCue={lastCue}
                  />
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3">
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="truncate text-zinc-400">{enemy.name}</span>
                      <span className="shrink-0 font-mono tabular-nums text-rose-200/90">
                        {enemy.currentHp} / {enemy.stats.hp}
                      </span>
                    </div>
                    <AnimatedHpBar
                      fraction={enemy.stats.hp > 0 ? enemy.currentHp / enemy.stats.hp : 0}
                      colorClass="bg-rose-600"
                    />
                  </div>
                </div>
              </div>

              <p className="text-center text-sm text-zinc-400">
                Turn:{" "}
                <span className="font-medium text-zinc-200">
                  {!isRunning && !isFinished
                    ? "—"
                    : turn === "player"
                      ? player.name
                      : enemy.name}
                </span>
              </p>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <div className="flex rounded-xl border border-zinc-700 bg-zinc-900/60 p-0.5">
                  <button
                    type="button"
                    disabled={isFinished}
                    onClick={() => setSpeed(1)}
                    className={[
                      "rounded-lg px-3 py-2 text-xs font-semibold transition",
                      speed === 1
                        ? "bg-violet-600 text-white"
                        : "text-zinc-400 hover:text-zinc-200",
                    ].join(" ")}
                  >
                    1x
                  </button>
                  <button
                    type="button"
                    disabled={isFinished}
                    onClick={() => setSpeed(2)}
                    className={[
                      "rounded-lg px-3 py-2 text-xs font-semibold transition",
                      speed === 2
                        ? "bg-violet-600 text-white"
                        : "text-zinc-400 hover:text-zinc-200",
                    ].join(" ")}
                  >
                    2x
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleSkipCombat}
                  disabled={isFinished}
                  className="rounded-xl border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Skip
                </button>
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Log
                </p>
                <CombatAnimatedLog ref={logScrollRef} entries={log} />
              </div>
            </>
          )}

          {(phase === "reward" || phase === "claiming") &&
            pendingReward &&
            activeDungeon && (
            <div className="flex flex-col gap-4 rounded-2xl border border-amber-500/40 bg-zinc-900/95 p-5 shadow-xl">
              <h2 className="text-center text-xl font-bold text-amber-200">
                Dungeon cleared!
              </h2>
              <p className="text-center text-sm text-zinc-400">
                {activeDungeon.name}
              </p>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between rounded-lg bg-black/30 px-3 py-2">
                  <span className="text-zinc-400">Gold</span>
                  <span className="font-mono text-amber-300">
                    +{pendingReward.gold}
                  </span>
                </div>
                <div className="flex justify-between rounded-lg bg-black/30 px-3 py-2">
                  <span className="text-zinc-400">XP</span>
                  <span className="font-mono text-cyan-300">
                    +{pendingReward.xp}
                  </span>
                </div>
                <div className="rounded-lg border border-zinc-700 bg-black/30 px-3 py-3">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    Item dropped
                  </p>
                  <p className="mt-1 font-semibold text-zinc-100">
                    {pendingReward.drop.item.name}
                  </p>
                  <p
                    className={`text-sm capitalize ${rarityLabelClass[pendingReward.drop.rarity]}`}
                  >
                    {pendingReward.drop.rarity}
                  </p>
                </div>
              </div>
              {claimError ? (
                <p className="text-center text-sm text-red-400">{claimError}</p>
              ) : null}
              <button
                type="button"
                onClick={handleClaimReward}
                disabled={phase === "claiming"}
                className="rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 py-3.5 text-center text-sm font-bold text-zinc-950 shadow-lg transition hover:from-amber-500 hover:to-orange-500 disabled:opacity-50"
              >
                {phase === "claiming" ? "Claiming…" : "Claim Reward"}
              </button>
            </div>
          )}

          {phase === "failed" && (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-rose-500/35 bg-zinc-900/95 p-8">
              <h2 className="text-xl font-bold text-rose-300">Dungeon Failed</h2>
              <p className="text-center text-sm text-zinc-400">
                You were defeated. No rewards.
              </p>
              <button
                type="button"
                onClick={resetToHub}
                className="rounded-xl border border-zinc-600 bg-zinc-800 px-6 py-3 text-sm font-semibold text-zinc-100 hover:bg-zinc-700"
              >
                Back to dungeons
              </button>
            </div>
          )}

          {phase === "stalemate" && activeDungeon && (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-amber-500/40 bg-zinc-900/95 p-8">
              <h2 className="text-xl font-bold text-amber-200">Stalemate</h2>
              <p className="text-center text-sm text-zinc-400">
                Neither side could finish the fight. The run ends with no rewards.
              </p>
              <p className="text-center text-xs text-zinc-500">
                {activeDungeon.name}
              </p>
              <button
                type="button"
                onClick={resetToHub}
                className="rounded-xl border border-zinc-600 bg-zinc-800 px-6 py-3 text-sm font-semibold text-zinc-100 hover:bg-zinc-700"
              >
                Back to dungeons
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
