"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getOrCreateUser, type UserDocument } from "@/lib/getOrCreateUser";
import {
  ensureInventoryDefaults,
  persistEffectiveCombatStats,
} from "@/lib/inventoryUtils";
import { validateForgeSelection } from "@/lib/forgeSystem";
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

  const canForge = forgeCheck.ok;

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
    try {
      await transactionForgeMerge(user.uid, selectedIds);
      await persistEffectiveCombatStats(user.uid);
      await refresh(user.uid);
      setSelectedIds([]);
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
          of the next tier. Max three selections.
        </p>

        {err ? (
          <p className="mb-4 text-center text-sm text-red-400">{err}</p>
        ) : null}

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-zinc-900/50 px-4 py-3">
          <p className="text-sm text-zinc-300">
            Selected:{" "}
            <span className="font-mono tabular-nums text-orange-200">
              {selectedIds.length}
            </span>
            /3
          </p>
          {selectedIds.length === 3 && !canForge ? (
            <p className="text-xs text-amber-400/90">{forgeCheck.reason}</p>
          ) : null}
          {forgeCheck.ok ? (
            <p className="text-xs text-emerald-400/90">
              Forges to{" "}
              <span className="font-semibold capitalize">
                {forgeCheck.nextRarity}
              </span>
            </p>
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
            {forging ? "Forging…" : "Forge"}
          </button>
          <button
            type="button"
            disabled={forging || selectedIds.length === 0}
            onClick={() => setSelectedIds([])}
            className="text-xs text-zinc-500 underline decoration-zinc-600 underline-offset-2 hover:text-zinc-400 disabled:opacity-40"
          >
            Clear selection
          </button>
        </div>
      </div>
    </div>
  );
}
