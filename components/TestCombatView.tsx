"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatedHpBar } from "@/components/combat/AnimatedHpBar";
import { CombatAnimatedLog } from "@/components/combat/CombatAnimatedLog";
import {
  decideFirstTurn,
  runCombatStep,
  simulateCombatToWinner,
  type Fighter,
  type Stats,
} from "@/lib/combat";
import {
  appendCombatLogLines,
  initialCombatLogLines,
  type CombatLogLine,
} from "@/lib/combatLog";
import { getOrCreateUser } from "@/lib/getOrCreateUser";
import { ensureInventoryDefaults } from "@/lib/inventoryUtils";
import { persistCombatProgression } from "@/lib/levelSystem";
import { useAuth } from "@/hooks/useAuth";

const DUMMY_TEMPLATE: Fighter = {
  name: "Training Dummy",
  stats: { hp: 50, atk: 5, def: 2, crit: 0 },
  currentHp: 50,
};

function cloneFighter(f: Fighter): Fighter {
  return {
    ...f,
    stats: { ...f.stats },
  };
}

export function TestCombatView() {
  const { user, loading: authLoading, authError } = useAuth();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [docLoading, setDocLoading] = useState(true);
  const [player, setPlayer] = useState<Fighter | null>(null);
  const [enemy, setEnemy] = useState<Fighter | null>(null);
  const [turn, setTurn] = useState<"player" | "enemy">("player");
  const [log, setLog] = useState<CombatLogLine[]>([]);
  const [winner, setWinner] = useState<"player" | "enemy" | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [levelProgress, setLevelProgress] = useState<{
    level: number;
    xp: number;
    xpToNext: number;
  } | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logScrollRef = useRef<HTMLUListElement | null>(null);

  const isFinished = winner !== null;

  const clearCombatTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const finalizeCombat = useCallback(
    (w: "player" | "enemy") => {
      setWinner(w);
      setIsRunning(false);
      if (!user) return;
      void (async () => {
        try {
          await persistCombatProgression(
            user.uid,
            w === "player" ? "win" : "loss",
          );
          const doc = await getOrCreateUser(user.uid);
          setLevelProgress({
            level: doc.level,
            xp: doc.xp,
            xpToNext: doc.xpToNext,
          });
          setPlayer((prev) => {
            if (!prev) return prev;
            const nextMax = doc.effectiveStats.hp;
            return {
              ...prev,
              stats: { ...doc.effectiveStats },
              currentHp: Math.min(prev.currentHp, nextMax),
            };
          });
        } catch (e) {
          console.error(e);
        }
      })();
    },
    [user],
  );

  useEffect(() => {
    if (authLoading) return;
    if (authError) {
      setDocLoading(false);
      return;
    }
    if (!user) {
      setDocLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await ensureInventoryDefaults(user.uid);
        const userDoc = await getOrCreateUser(user.uid);
        if (cancelled) return;
        const stats: Stats = { ...userDoc.effectiveStats };
        const name = userDoc.username?.trim() || "Player";
        const p: Fighter = {
          name,
          stats,
          currentHp: stats.hp,
        };
        const e = cloneFighter(DUMMY_TEMPLATE);
        const first = decideFirstTurn();
        setLevelProgress({
          level: userDoc.level,
          xp: userDoc.xp,
          xpToNext: userDoc.xpToNext,
        });
        setPlayer(p);
        setEnemy(e);
        setTurn(first);
        setLog(
          initialCombatLogLines([
            first === "player"
              ? "Player goes first!"
              : "Training Dummy goes first!",
          ]),
        );
        setWinner(null);
        setIsRunning(true);
      } catch (e) {
        console.error(e);
        if (!cancelled) setLoadError("Could not load your profile.");
      } finally {
        if (!cancelled) setDocLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, authError, user]);

  useEffect(() => {
    if (!isRunning || isFinished || !player || !enemy) return;

    const delayMs = 1000 / speed;
    const id = setTimeout(() => {
      timerRef.current = null;
      const step = runCombatStep({ player, enemy, turn });
      setPlayer(step.player);
      setEnemy(step.enemy);
      setTurn(step.turn);
      setLog((prev) => appendCombatLogLines(prev, step.logEntries));
      if (step.winner) {
        finalizeCombat(step.winner);
      }
    }, delayMs);

    timerRef.current = id;
    return () => {
      clearTimeout(id);
      if (timerRef.current === id) timerRef.current = null;
    };
  }, [isRunning, isFinished, speed, turn, player, enemy, finalizeCombat]);

  useLayoutEffect(() => {
    const el = logScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [log]);

  const handleSkip = useCallback(() => {
    if (!player || !enemy || isFinished) return;
    clearCombatTimer();

    const result = simulateCombatToWinner({ player, enemy, turn });

    setPlayer(result.player);
    setEnemy(result.enemy);
    setTurn(result.turn);
    setLog((prev) => appendCombatLogLines(prev, result.logEntries));
    finalizeCombat(result.winner);
  }, [player, enemy, turn, isFinished, clearCombatTimer, finalizeCombat]);

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

  if (authLoading || docLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-zinc-400">
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

  if (loadError || !player || !enemy) {
    return (
      <div className="p-6 text-center text-red-400">
        <p>{loadError ?? "Failed to start combat."}</p>
        <Link href="/" className="mt-4 inline-block text-amber-400 underline">
          Home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 bg-zinc-950 p-4 pb-8 text-zinc-100">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="text-sm text-amber-500/90 hover:text-amber-400"
        >
          ← Main menu
        </Link>
        <h1 className="text-lg font-semibold">Combat test</h1>
        <span className="w-16" aria-hidden />
      </div>

      {levelProgress && levelProgress.xpToNext > 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 py-3">
          <div className="flex justify-between text-xs text-zinc-400">
            <span>
              Level{" "}
              <span className="font-semibold text-amber-200">
                {levelProgress.level}
              </span>
            </span>
            <span className="font-mono tabular-nums text-zinc-300">
              {levelProgress.xp} / {levelProgress.xpToNext} XP
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-amber-500 transition-[width]"
              style={{
                width: `${Math.min(100, (levelProgress.xp / levelProgress.xpToNext) * 100)}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">{player.name}</span>
          <span className="font-mono tabular-nums">
            {player.currentHp} / {player.stats.hp} HP
          </span>
        </div>
        <AnimatedHpBar
          fraction={
            player.stats.hp > 0 ? player.currentHp / player.stats.hp : 0
          }
          colorClass="bg-emerald-600"
          className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-800"
        />
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">{enemy.name}</span>
          <span className="font-mono tabular-nums">
            {enemy.currentHp} / {enemy.stats.hp} HP
          </span>
        </div>
        <AnimatedHpBar
          fraction={enemy.stats.hp > 0 ? enemy.currentHp / enemy.stats.hp : 0}
          colorClass="bg-rose-600"
          className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-800"
        />
      </div>

      <p className="text-center text-sm text-zinc-400">
        Turn:{" "}
        <span className="font-medium text-zinc-200">
          {isFinished
            ? "—"
            : turn === "player"
              ? `${player.name}`
              : enemy.name}
        </span>
      </p>

      {winner ? (
        <p className="text-center text-base font-semibold text-amber-400">
          {winner === "player" ? "You win!" : "You lose!"}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <div className="flex rounded-xl border border-zinc-700 bg-zinc-900/60 p-0.5">
          <button
            type="button"
            disabled={isFinished}
            onClick={() => setSpeed(1)}
            className={[
              "rounded-lg px-3 py-2 text-xs font-semibold transition",
              speed === 1
                ? "bg-amber-600 text-zinc-950"
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
                ? "bg-amber-600 text-zinc-950"
                : "text-zinc-400 hover:text-zinc-200",
            ].join(" ")}
          >
            2x
          </button>
        </div>
        <button
          type="button"
          onClick={handleSkip}
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
        <CombatAnimatedLog
          ref={logScrollRef}
          entries={log}
          className="max-h-64 overflow-y-auto rounded-lg border border-zinc-800 bg-black/40 p-3 text-sm text-zinc-300"
        />
      </div>
    </div>
  );
}
