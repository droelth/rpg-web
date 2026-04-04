"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  applyDamage,
  calculateDamage,
  decideFirstTurn,
  isDead,
  type Fighter,
  type Stats,
} from "@/lib/combat";
import { getOrCreateUser } from "@/lib/getOrCreateUser";
import { ensureInventoryDefaults } from "@/lib/inventoryUtils";
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
  const [log, setLog] = useState<string[]>([]);
  const [winner, setWinner] = useState<"player" | "enemy" | null>(null);

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
        setPlayer(p);
        setEnemy(e);
        setTurn(first);
        setLog([
          first === "player"
            ? "Player goes first!"
            : "Training Dummy goes first!",
        ]);
        setWinner(null);
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

  const nextTurn = useCallback(() => {
    if (!player || !enemy || winner) return;

    if (turn === "player") {
      const { damage, isCrit } = calculateDamage(player, enemy);
      const nextEnemy = cloneFighter(enemy);
      applyDamage(nextEnemy, damage);
      setLog((prev) => {
        const next = [...prev];
        if (isCrit) next.push("CRITICAL HIT!");
        next.push(`Player hits for ${damage} damage.`);
        return next;
      });
      setEnemy(nextEnemy);
      if (isDead(nextEnemy)) {
        setWinner("player");
        setLog((prev) => [...prev, "Training Dummy is defeated!"]);
        return;
      }
      setTurn("enemy");
    } else {
      const { damage, isCrit } = calculateDamage(enemy, player);
      const nextPlayer = cloneFighter(player);
      applyDamage(nextPlayer, damage);
      setLog((prev) => {
        const next = [...prev];
        if (isCrit) next.push("CRITICAL HIT!");
        next.push(`${enemy.name} hits for ${damage} damage.`);
        return next;
      });
      setPlayer(nextPlayer);
      if (isDead(nextPlayer)) {
        setWinner("enemy");
        setLog((prev) => [...prev, "You are defeated!"]);
        return;
      }
      setTurn("player");
    }
  }, [player, enemy, turn, winner]);

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

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">{player.name}</span>
          <span className="font-mono tabular-nums">
            {player.currentHp} / {player.stats.hp} HP
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-emerald-600 transition-[width]"
            style={{
              width: `${Math.max(0, (player.currentHp / player.stats.hp) * 100)}%`,
            }}
          />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">{enemy.name}</span>
          <span className="font-mono tabular-nums">
            {enemy.currentHp} / {enemy.stats.hp} HP
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-rose-600 transition-[width]"
            style={{
              width: `${Math.max(0, (enemy.currentHp / enemy.stats.hp) * 100)}%`,
            }}
          />
        </div>
      </div>

      <p className="text-center text-sm text-zinc-400">
        Turn:{" "}
        <span className="font-medium text-zinc-200">
          {winner
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

      <button
        type="button"
        onClick={nextTurn}
        disabled={!!winner}
        className="rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next Turn
      </button>

      <div className="flex min-h-0 flex-1 flex-col">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Log
        </p>
        <ul className="max-h-64 overflow-y-auto rounded-lg border border-zinc-800 bg-black/40 p-3 text-sm text-zinc-300">
          {log.map((line, i) => (
            <li key={i} className="border-b border-zinc-800/80 py-1.5 last:border-0">
              {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
