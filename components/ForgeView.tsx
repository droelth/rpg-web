"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getOrCreateUser, type UserDocument } from "@/lib/getOrCreateUser";
import {
  ensureInventoryDefaults,
  persistEffectiveCombatStats,
} from "@/lib/inventoryUtils";
import {
  forgeDestroyChanceForRarity,
  forgeGoldCostForRarity,
  validateForgeSelection,
} from "@/lib/forgeSystem";
import { ForgeError, transactionForgeMerge } from "@/lib/forgeFirestore";
import { resolveInventoryEntries } from "@/lib/items";
import { ItemCard } from "@/components/ItemCard";
import { useAuth } from "@/hooks/useAuth";

export function ForgeView() {
  const { user, loading: authLoading, authError } = useAuth();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [userDoc, setUserDoc] = useState<UserDocument | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [forging, setForging] = useState(false);
  const [forgeNotice, setForgeNotice] = useState<{
    tone: "ok" | "bad";
    text: string;
  } | null>(null);

  const refresh = useCallback(async (uid: string) => {
    await getOrCreateUser(uid);
    await ensureInventoryDefaults(uid);
    await persistEffectiveCombatStats(uid);
    const d = await getOrCreateUser(uid);
    setUserDoc(d);
  }, []);

  useEffect(() => {
    if (authLoading || authError) return;
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await refresh(user.uid);
      } catch (e) {
        console.error(e);
        if (!cancelled) setErr("Failed to load forge.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, authError, user, refresh]);

  const rows = useMemo(
    () => (userDoc ? resolveInventoryEntries(userDoc.inventory) : []),
    [userDoc],
  );

  const forgeCheck = useMemo(() => {
    if (!userDoc) {
      return validateForgeSelection([], selectedIds);
    }
    return validateForgeSelection(userDoc.inventory, selectedIds);
  }, [userDoc, selectedIds]);

  const forgeCost =
    forgeCheck.ok ? forgeGoldCostForRarity(forgeCheck.sourceRarity) : 0;
  const destroyChancePct =
    forgeCheck.ok
      ? Math.round(forgeDestroyChanceForRarity(forgeCheck.sourceRarity) * 100)
      : 0;
  const canForge =
    forgeCheck.ok &&
    userDoc != null &&
    userDoc.gold >= forgeCost;

  function toggleInstance(instanceId: string) {
    setSelectedIds((prev) => {
      if (prev.includes(instanceId)) {
        return prev.filter((id) => id !== instanceId);
      }
      if (prev.length >= 3) return prev;
      return [...prev, instanceId];
    });
  }

  async function handleForge() {
    if (!user || !canForge || forging) return;
    setForging(true);
    setErr(null);
    setForgeNotice(null);
    try {
      const { outcome } = await transactionForgeMerge(user.uid, selectedIds);
      await persistEffectiveCombatStats(user.uid);
      await refresh(user.uid);
      setSelectedIds([]);
      setForgeNotice(
        outcome === "upgraded"
          ? {
              tone: "ok",
              text: "Forge succeeded — you received a higher rarity item.",
            }
          : {
              tone: "bad",
              text: "Forge failed — all three items were lost. Gold was still spent.",
            },
      );
    } catch (e) {
      console.error(e);
      if (e instanceof ForgeError) {
        setErr(e.message);
      } else {
        setErr("Forge failed. Try again.");
      }
    } finally {
      setForging(false);
    }
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

  if (authLoading || loading) {
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
        {err ?? "Could not load forge."}
        <Link href="/" className="mt-4 block text-amber-400 underline">
          Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-zinc-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-950/30 via-zinc-950 to-black text-zinc-100">
      <div className="mx-auto max-w-3xl px-4 py-6 pb-12">
        <header className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-orange-300/90 hover:text-orange-200"
          >
            ← Main menu
          </Link>
          <h1 className="text-lg font-semibold tracking-tight">Forge</h1>
          <span className="w-20" aria-hidden />
        </header>

        <p className="mb-4 text-center text-sm text-zinc-400 sm:text-left">
          Select three identical items (same item and rarity) to merge into one
          of the next tier. Each attempt costs gold by rarity; there is a chance
          the forge fails and you lose all three materials (no upgraded item).
        </p>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-zinc-900/40 px-4 py-2.5 text-sm">
          <span className="text-zinc-500">Your gold</span>
          <span className="font-mono tabular-nums text-amber-200">
            {userDoc.gold}
          </span>
        </div>

        {err ? (
          <p className="mb-4 text-center text-sm text-red-400">{err}</p>
        ) : null}

        {forgeNotice ? (
          <p
            className={`mb-4 rounded-xl border px-4 py-3 text-center text-sm ${
              forgeNotice.tone === "ok"
                ? "border-emerald-500/35 bg-emerald-950/25 text-emerald-200/95"
                : "border-rose-500/35 bg-rose-950/25 text-rose-200/95"
            }`}
          >
            {forgeNotice.text}
          </p>
        ) : null}

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-zinc-900/50 px-4 py-3">
          <p className="text-sm text-zinc-300">
            Selected:{" "}
            <span className="font-mono tabular-nums text-orange-200">
              {selectedIds.length}
            </span>
            /3
          </p>
          {selectedIds.length === 3 && !forgeCheck.ok ? (
            <p className="text-xs text-amber-400/90">{forgeCheck.reason}</p>
          ) : null}
          {forgeCheck.ok ? (
            <div className="flex flex-col items-end gap-1 text-right text-xs sm:flex-row sm:items-center sm:gap-3">
              <p className="text-zinc-400">
                Cost{" "}
                <span className="font-mono font-semibold text-amber-200">
                  {forgeCost}
                </span>{" "}
                gold
                {userDoc.gold < forgeCost ? (
                  <span className="ml-1 text-rose-400">(not enough)</span>
                ) : null}
              </p>
              <p className="text-zinc-400">
                Fail risk{" "}
                <span className="font-semibold text-rose-300/90">
                  {destroyChancePct}%
                </span>
              </p>
              <p className="text-emerald-400/90">
                →{" "}
                <span className="font-semibold capitalize">
                  {forgeCheck.nextRarity}
                </span>
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex justify-center sm:justify-start">
          <div className="grid w-full max-w-3xl grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 justify-items-center">
            {rows.map((row, i) => {
              const selected = selectedIds.includes(row.instance.instanceId);
              const atCap = selectedIds.length >= 3 && !selected;
              return (
                <ItemCard
                  key={`forge-${row.instance.instanceId}-${i}`}
                  item={row.item}
                  displayRarity={row.displayRarity}
                  size="md"
                  layout="stack"
                  selected={selected}
                  disabled={forging || atCap}
                  onClick={() => toggleInstance(row.instance.instanceId)}
                  className="mx-auto w-full max-w-[168px]"
                />
              );
            })}
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="mt-8 text-center text-sm text-zinc-500">
            Your inventory is empty.
          </p>
        ) : null}

        <div className="mt-8 flex flex-col items-center gap-2">
          <button
            type="button"
            disabled={!canForge || forging}
            onClick={handleForge}
            className="w-full max-w-sm rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-900/40 transition hover:from-orange-500 hover:to-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {forging
              ? "Forging…"
              : forgeCheck.ok
                ? `Forge (${forgeCost} gold)`
                : "Forge"}
          </button>
          <button
            type="button"
            disabled={forging || selectedIds.length === 0}
            onClick={() => {
              setSelectedIds([]);
              setForgeNotice(null);
            }}
            className="text-xs text-zinc-500 underline decoration-zinc-600 underline-offset-2 hover:text-zinc-400 disabled:opacity-40"
          >
            Clear selection
          </button>
        </div>
      </div>
    </div>
  );
}
