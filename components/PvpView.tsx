"use client";

import Link from "next/link";
import { AnimatedCombatPortrait } from "@/components/combat/AnimatedCombatPortrait";
import { AnimatedHpBar } from "@/components/combat/AnimatedHpBar";
import { CombatAnimatedLog } from "@/components/combat/CombatAnimatedLog";
import { CombatantPortrait } from "@/components/CombatantPortrait";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  advanceHpStagnationAfterStep,
  createHpStagnationState,
  decideFirstTurn,
  initialCombatEnchantState,
  MAX_COMBAT_RESOLUTION_STEPS,
  runCombatStep,
  STALEMATE_LOG_LINE,
  type CombatAnimationCue,
  type CombatEnchantState,
  type Fighter,
  type HpStagnationState,
  type Stats,
} from "@/lib/combat";
import { resolveEquippedWeaponEnchant } from "@/lib/enchantCatalog";
import {
  appendCombatLogLines,
  initialCombatLogLines,
  type CombatLogLine,
} from "@/lib/combatLog";
import { getInventoryPortraitPath } from "@/lib/classPortrait";
import { MAX_ENERGY } from "@/lib/energySystem";
import { getOrCreateUser, type UserDocument } from "@/lib/getOrCreateUser";
import { ensureInventoryDefaults } from "@/lib/inventoryUtils";
import {
  buildPvpRewards,
  buildPvpStalemateRewards,
  getRandomOpponent,
  type PvpOpponentSnapshot,
  type PvpRewardBreakdown,
} from "@/lib/pvpSystem";
import {
  persistPvpBattleResult,
  PvpEnergyError,
  transactionConsumePvpEnergy,
} from "@/lib/pvpFirestore";
import { useAuth } from "@/hooks/useAuth";
import type { CombatTotals } from "@/lib/inventoryUtils";

type Phase = "hub" | "preview" | "battle" | "result";

function PvpCombatStatsDl({
  stats,
  currentHp,
  hpAccentClass,
}: {
  stats: CombatTotals;
  currentHp?: number;
  hpAccentClass: string;
}) {
  const hpLine =
    currentHp != null ? `${currentHp} / ${stats.hp}` : String(stats.hp);
  return (
    <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-zinc-300">
      <dt className="text-zinc-500">HP</dt>
      <dd className={`text-right font-mono tabular-nums ${hpAccentClass}`}>
        {hpLine}
      </dd>
      <dt className="text-zinc-500">ATK</dt>
      <dd className="text-right font-mono tabular-nums">{stats.atk}</dd>
      <dt className="text-zinc-500">DEF</dt>
      <dd className="text-right font-mono tabular-nums">{stats.def}</dd>
      <dt className="text-zinc-500">CRIT</dt>
      <dd className="text-right font-mono tabular-nums">{stats.crit}</dd>
    </dl>
  );
}

function VersusNames({ left, right }: { left: string; right: string }) {
  return (
    <div
      className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/35 px-3 py-3 sm:gap-4"
      aria-label={`${left} versus ${right}`}
    >
      <span className="min-w-0 flex-1 truncate text-right text-sm font-semibold text-sky-200 sm:text-base">
        {left}
      </span>
      <span className="shrink-0 rounded-md bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
        vs
      </span>
      <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-rose-200 sm:text-base">
        {right}
      </span>
    </div>
  );
}

function cloneFighter(f: Fighter): Fighter {
  return {
    ...f,
    stats: { ...f.stats },
  };
}

export function PvpView() {
  const { user, loading: authLoading, authError } = useAuth();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [docLoading, setDocLoading] = useState(true);
  const [userDoc, setUserDoc] = useState<UserDocument | null>(null);
  const [phase, setPhase] = useState<Phase>("hub");
  const [opponent, setOpponent] = useState<PvpOpponentSnapshot | null>(null);
  const [findBusy, setFindBusy] = useState(false);
  const [startBusy, setStartBusy] = useState(false);
  const [player, setPlayer] = useState<Fighter | null>(null);
  const [enemy, setEnemy] = useState<Fighter | null>(null);
  const [turn, setTurn] = useState<"player" | "enemy">("player");
  const [log, setLog] = useState<CombatLogLine[]>([]);
  const [strikeSeq, setStrikeSeq] = useState(0);
  const [lastCue, setLastCue] = useState<CombatAnimationCue | null>(null);
  const [winner, setWinner] = useState<"player" | "enemy" | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [rewards, setRewards] = useState<PvpRewardBreakdown | null>(null);
  const [playerLevelAtMatch, setPlayerLevelAtMatch] = useState(1);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logScrollRef = useRef<HTMLUListElement | null>(null);
  const pvpStagnationRef = useRef<HpStagnationState | null>(null);
  const pvpAutoStepCountRef = useRef(0);
  const pvpCombatEnchantRef = useRef<CombatEnchantState>(
    initialCombatEnchantState(null),
  );
  const isFinished = winner !== null;

  const refreshUser = useCallback(async (uid: string) => {
    await getOrCreateUser(uid);
    await ensureInventoryDefaults(uid);
    const d = await getOrCreateUser(uid);
    setUserDoc(d);
    return d;
  }, []);

  useEffect(() => {
    if (authLoading || authError) return;
    if (!user) {
      setDocLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await refreshUser(user.uid);
      } catch (e) {
        console.error(e);
        if (!cancelled) setLoadError("Could not load profile.");
      } finally {
        if (!cancelled) setDocLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, authError, user, refreshUser]);

  const clearCombatTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const finalizeStalemate = useCallback(() => {
    setWinner(null);
    setIsRunning(false);
    setRewards(buildPvpStalemateRewards());
    setPhase("result");
  }, []);

  const finalizeCombat = useCallback(
    (w: "player" | "enemy", opp: PvpOpponentSnapshot, pLevel: number) => {
      setWinner(w);
      setIsRunning(false);
      const uid = user?.uid;
      const won = w === "player";
      const breakdown = buildPvpRewards(won, pLevel, opp.level);
      setRewards(breakdown);
      setPhase("result");
      if (!uid) return;
      void (async () => {
        try {
          await persistPvpBattleResult(uid, {
            won,
            xpGain: breakdown.xpGain,
            goldDelta: breakdown.goldDelta,
            rankDelta: breakdown.rankDelta,
          });
          await refreshUser(uid);
        } catch (e) {
          console.error(e);
        }
      })();
    },
    [user, refreshUser],
  );

  useEffect(() => {
    if (phase !== "battle" || !isRunning || isFinished || !player || !enemy) {
      return;
    }

    const delayMs = 900;
    const id = setTimeout(() => {
      timerRef.current = null;
      pvpAutoStepCountRef.current += 1;
      if (pvpAutoStepCountRef.current > MAX_COMBAT_RESOLUTION_STEPS) {
        setLog((prev) =>
          appendCombatLogLines(prev, [STALEMATE_LOG_LINE]),
        );
        finalizeStalemate();
        return;
      }

      const step = runCombatStep({
        player,
        enemy,
        turn,
        enchant: pvpCombatEnchantRef.current,
      });
      pvpCombatEnchantRef.current = step.enchant;
      setStrikeSeq((n) => n + 1);
      setLastCue(step.animationCue);
      setPlayer(step.player);
      setEnemy(step.enemy);
      setTurn(step.turn);
      setLog((prev) => appendCombatLogLines(prev, step.logEntries));

      if (step.winner && opponent) {
        finalizeCombat(step.winner, opponent, playerLevelAtMatch);
        return;
      }

      const st = pvpStagnationRef.current;
      if (st) {
        const adv = advanceHpStagnationAfterStep(
          step.player,
          step.enemy,
          st,
        );
        pvpStagnationRef.current = adv.next;
        if (adv.stalemate) {
          setLog((prev) =>
            appendCombatLogLines(prev, [adv.logLine]),
          );
          finalizeStalemate();
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
    turn,
    player,
    enemy,
    opponent,
    playerLevelAtMatch,
    finalizeCombat,
    finalizeStalemate,
  ]);

  useLayoutEffect(() => {
    const el = logScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [log]);

  async function handleFindOpponent() {
    if (!user || findBusy) return;
    setFindBusy(true);
    setLoadError(null);
    try {
      await refreshUser(user.uid);
      const o = await getRandomOpponent(user.uid);
      if (!o) {
        setLoadError("No other adventurers found. Try again later.");
        setOpponent(null);
        return;
      }
      setOpponent(o);
      setPhase("preview");
    } catch (e) {
      console.error(e);
      setLoadError("Could not find an opponent.");
    } finally {
      setFindBusy(false);
    }
  }

  async function handleStartBattle() {
    if (!user || !userDoc || !opponent || startBusy) return;
    if (userDoc.energy < 1) {
      setLoadError("Not enough energy.");
      return;
    }
    setStartBusy(true);
    setLoadError(null);
    try {
      await transactionConsumePvpEnergy(user.uid);
      const fresh = await getOrCreateUser(user.uid);
      setUserDoc(fresh);

      const stats: Stats = { ...fresh.effectiveStats };
      const name = fresh.username?.trim() || "You";
      const p: Fighter = {
        name,
        stats,
        currentHp: stats.hp,
      };
      const e = cloneFighter(opponent.fighter);

      setPlayerLevelAtMatch(fresh.level);
      setPlayer(p);
      setEnemy(e);
      const first = decideFirstTurn();
      setTurn(first);
      setStrikeSeq(0);
      setLastCue(null);
      setLog(
        initialCombatLogLines([
          first === "player"
            ? "You take the first turn!"
            : `${e.name} moves first!`,
        ]),
      );
      setWinner(null);
      setRewards(null);
      pvpAutoStepCountRef.current = 0;
      pvpStagnationRef.current = createHpStagnationState(p, e);
      pvpCombatEnchantRef.current = initialCombatEnchantState(
        resolveEquippedWeaponEnchant(fresh.inventory, fresh.equipped),
      );
      setPhase("battle");
      setIsRunning(true);
    } catch (e) {
      if (e instanceof PvpEnergyError) {
        setLoadError(e.message);
      } else {
        console.error(e);
        setLoadError("Could not start battle.");
      }
    } finally {
      setStartBusy(false);
    }
  }

  function handleBackToHub() {
    clearCombatTimer();
    setPhase("hub");
    setOpponent(null);
    setPlayer(null);
    setEnemy(null);
    setLog([]);
    setStrikeSeq(0);
    setLastCue(null);
    setWinner(null);
    setRewards(null);
    setIsRunning(false);
    setLoadError(null);
    pvpStagnationRef.current = null;
    pvpAutoStepCountRef.current = 0;
    pvpCombatEnchantRef.current = initialCombatEnchantState(null);
  }

  if (authError) {
    return (
      <div className="p-6 text-center text-red-400">
        {authError}
        <Link href="/" className="mt-4 block text-amber-400 underline">
          Home
        </Link>
      </div>
    );
  }

  if (authLoading || docLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-950 text-zinc-400">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 text-center text-zinc-400">
        Sign in required.
        <Link href="/" className="mt-4 block text-amber-400 underline">
          Home
        </Link>
      </div>
    );
  }

  if (!userDoc) {
    return (
      <div className="p-6 text-center text-red-400">
        {loadError ?? "Could not load PvP."}
        <Link href="/" className="mt-4 block text-amber-400 underline">
          Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-zinc-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-950/35 via-zinc-950 to-black text-zinc-100">
      <div className="mx-auto max-w-lg px-4 py-6 pb-12">
        <header className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-sky-300/90 hover:text-sky-200"
          >
            ← Main menu
          </Link>
          <h1 className="text-lg font-semibold tracking-tight">PvP Arena</h1>
          <span className="w-20" aria-hidden />
        </header>

        {loadError && phase === "hub" ? (
          <p className="mb-4 text-center text-sm text-red-400">{loadError}</p>
        ) : null}
        {loadError && phase !== "hub" ? (
          <p className="mb-4 text-center text-sm text-amber-400">{loadError}</p>
        ) : null}

        {phase === "hub" ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 backdrop-blur-md">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Energy</span>
                <span className="font-mono text-cyan-200">
                  {userDoc.energy}/{MAX_ENERGY}
                </span>
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-zinc-500">Rank points</span>
                <span className="font-mono text-amber-200">
                  {userDoc.rankPoints}
                </span>
              </div>
              <p className="mt-3 text-xs text-zinc-500">
                Each match costs 1 energy. Energy refills by 1 every 30 minutes
                (up to {MAX_ENERGY}).
              </p>
            </div>
            <button
              type="button"
              disabled={findBusy || userDoc.energy < 1}
              onClick={handleFindOpponent}
              className="w-full rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-sky-900/40 transition hover:from-sky-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {findBusy ? "Searching…" : "Find opponent"}
            </button>
            {userDoc.energy < 1 ? (
              <p className="text-center text-xs text-zinc-500">
                Not enough energy to queue.
              </p>
            ) : null}
          </div>
        ) : null}

        {phase === "preview" && opponent ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <CombatantPortrait
                src={getInventoryPortraitPath(userDoc.class)}
                alt={userDoc.username?.trim() || "You"}
              />
              <CombatantPortrait
                src={getInventoryPortraitPath(opponent.class)}
                alt={opponent.fighter.name}
              />
            </div>
            <VersusNames
              left={userDoc.username?.trim() || "You"}
              right={opponent.fighter.name}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-sky-500/20 bg-zinc-900/60 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-400/80">
                  You
                </p>
                <p className="mt-1 truncate text-sm font-bold text-zinc-50">
                  {userDoc.username?.trim() || "You"}
                </p>
                <p className="text-xs text-zinc-400">
                  Lv {userDoc.level}
                  {userDoc.class ? ` · ${userDoc.class}` : ""}
                </p>
                <PvpCombatStatsDl
                  stats={userDoc.effectiveStats}
                  hpAccentClass="text-sky-300"
                />
              </div>
              <div className="rounded-2xl border border-rose-500/20 bg-zinc-900/60 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-400/80">
                  Opponent
                </p>
                <p className="mt-1 truncate text-sm font-bold text-zinc-50">
                  {opponent.fighter.name}
                </p>
                <p className="text-xs text-zinc-400">
                  Lv {opponent.level}
                  {opponent.class ? ` · ${opponent.class}` : ""}
                </p>
                <PvpCombatStatsDl
                  stats={opponent.effectiveStats}
                  hpAccentClass="text-rose-300"
                />
              </div>
            </div>
            <button
              type="button"
              disabled={startBusy || userDoc.energy < 1}
              onClick={handleStartBattle}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40"
            >
              {startBusy ? "Starting…" : "Start battle (1 energy)"}
            </button>
            <button
              type="button"
              onClick={handleBackToHub}
              className="w-full text-sm text-zinc-500 underline-offset-2 hover:text-zinc-400"
            >
              Cancel
            </button>
          </div>
        ) : null}

        {phase === "battle" && player && enemy ? (
          <div className="space-y-4">
            <VersusNames left={player.name} right={enemy.name} />
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <AnimatedCombatPortrait
                  src={getInventoryPortraitPath(userDoc.class)}
                  alt={player.name}
                  layoutSide="left"
                  role="player"
                  strikeSeq={strikeSeq}
                  lastCue={lastCue}
                />
                <div className="rounded-xl border border-emerald-500/20 bg-black/30 p-3">
                  <p className="text-[10px] uppercase text-zinc-500">You</p>
                  <p className="truncate font-semibold">{player.name}</p>
                  <PvpCombatStatsDl
                    stats={player.stats}
                    currentHp={player.currentHp}
                    hpAccentClass="text-emerald-300"
                  />
                  <AnimatedHpBar
                    fraction={
                      player.stats.hp > 0 ? player.currentHp / player.stats.hp : 0
                    }
                    colorClass="bg-emerald-600"
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800/90"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <AnimatedCombatPortrait
                  src={getInventoryPortraitPath(opponent?.class)}
                  alt={enemy.name}
                  layoutSide="right"
                  role="enemy"
                  strikeSeq={strikeSeq}
                  lastCue={lastCue}
                />
                <div className="rounded-xl border border-rose-500/20 bg-black/30 p-3">
                  <p className="text-[10px] uppercase text-zinc-500">Opponent</p>
                  <p className="truncate font-semibold">{enemy.name}</p>
                  <PvpCombatStatsDl
                    stats={enemy.stats}
                    currentHp={enemy.currentHp}
                    hpAccentClass="text-rose-300"
                  />
                  <AnimatedHpBar
                    fraction={
                      enemy.stats.hp > 0 ? enemy.currentHp / enemy.stats.hp : 0
                    }
                    colorClass="bg-rose-600"
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800/90"
                  />
                </div>
              </div>
            </div>
            <CombatAnimatedLog
              ref={logScrollRef}
              entries={log}
              className="max-h-52 overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-zinc-300"
              itemClassName="border-b border-white/5 py-1.5 last:border-0"
            />
          </div>
        ) : null}

        {phase === "result" && rewards ? (
          <div className="space-y-6 text-center">
            {opponent ? (
              <div className="mx-auto grid max-w-md grid-cols-2 gap-3">
                <CombatantPortrait
                  src={getInventoryPortraitPath(userDoc.class)}
                  alt={userDoc.username?.trim() || "You"}
                />
                <CombatantPortrait
                  src={getInventoryPortraitPath(opponent.class)}
                  alt={opponent.fighter.name}
                />
              </div>
            ) : null}
            {player && enemy ? (
              <VersusNames left={player.name} right={enemy.name} />
            ) : opponent ? (
              <VersusNames
                left={userDoc.username?.trim() || "You"}
                right={opponent.fighter.name}
              />
            ) : null}
            {player && enemy ? (
              <div className="grid grid-cols-2 gap-3 text-left">
                <div className="rounded-xl border border-emerald-500/20 bg-zinc-900/50 p-3">
                  <p className="text-[10px] font-semibold uppercase text-emerald-400/85">
                    Final · You
                  </p>
                  <PvpCombatStatsDl
                    stats={player.stats}
                    currentHp={player.currentHp}
                    hpAccentClass="text-emerald-300"
                  />
                </div>
                <div className="rounded-xl border border-rose-500/20 bg-zinc-900/50 p-3">
                  <p className="text-[10px] font-semibold uppercase text-rose-400/85">
                    Final · Opponent
                  </p>
                  <PvpCombatStatsDl
                    stats={enemy.stats}
                    currentHp={enemy.currentHp}
                    hpAccentClass="text-rose-300"
                  />
                </div>
              </div>
            ) : null}
            <h2 className="text-2xl font-bold text-zinc-50">
              {rewards.stalemate
                ? "Stalemate"
                : rewards.won
                  ? "Victory"
                  : "Defeat"}
            </h2>
            {rewards.stalemate ? (
              <p className="text-center text-sm text-zinc-400">
                No XP, gold, or rank change. Energy was still spent to enter this
                match.
              </p>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 text-left text-sm">
                <p className="text-zinc-400">Rewards</p>
                <ul className="mt-2 space-y-1 text-zinc-200">
                  <li>XP: +{rewards.xpGain}</li>
                  {rewards.goldDelta !== 0 ? (
                    <li>
                      Gold: {rewards.goldDelta > 0 ? "+" : ""}
                      {rewards.goldDelta}
                    </li>
                  ) : null}
                  <li>
                    Rank: {rewards.rankDelta > 0 ? "+" : ""}
                    {rewards.rankDelta}
                  </li>
                </ul>
              </div>
            )}
            <button
              type="button"
              onClick={handleBackToHub}
              className="w-full rounded-xl bg-zinc-700 py-3 text-sm font-semibold text-white hover:bg-zinc-600"
            >
              Back to arena
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
