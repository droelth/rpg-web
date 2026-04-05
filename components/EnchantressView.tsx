"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ENCHANTS,
  ENCHANT_BY_ID,
  type EnchantId,
} from "@/lib/enchantCatalog";
import { EnchantError, transactionApplyEnchant } from "@/lib/enchantFirestore";
import { getOrCreateUser, type UserDocument } from "@/lib/getOrCreateUser";
import { INITIAL_USER_ENERGY } from "@/lib/getOrCreateUser";
import { ensureInventoryDefaults } from "@/lib/inventoryUtils";
import { resolveInventoryEntries } from "@/lib/items";
import { rarityLabelClass } from "@/lib/itemRarityStyles";
import { useAuth } from "@/hooks/useAuth";
import { TopBar } from "@/components/TopBar";

export function EnchantressView() {
  const { user, loading: authLoading, authError } = useAuth();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserDocument | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(
    null,
  );
  const [selectedEnchantId, setSelectedEnchantId] = useState<EnchantId | null>(
    null,
  );
  const [actionErr, setActionErr] = useState<string | null>(null);

  const refresh = useCallback(async (uid: string) => {
    const d = await getOrCreateUser(uid);
    setProfile(d);
    return d;
  }, []);

  useEffect(() => {
    if (authLoading || authError) return;
    if (!user) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await ensureInventoryDefaults(user.uid);
        const d = await refresh(user.uid);
        if (!cancelled && d) setLoadError(null);
      } catch (e) {
        console.error(e);
        if (!cancelled) setLoadError("Could not load your profile.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, authError, user, refresh]);

  const weapons = useMemo(() => {
    if (!profile) return [];
    return resolveInventoryEntries(profile.inventory).filter(
      (r) => r.item.type === "weapon",
    );
  }, [profile]);

  const selectedWeapon = useMemo(
    () => weapons.find((w) => w.instance.instanceId === selectedInstanceId),
    [weapons, selectedInstanceId],
  );

  async function handleApply() {
    if (!user || !selectedInstanceId || !selectedEnchantId || busy) return;
    setActionErr(null);
    setBusy(true);
    try {
      await transactionApplyEnchant(
        user.uid,
        selectedInstanceId,
        selectedEnchantId,
      );
      await refresh(user.uid);
      setSelectedEnchantId(null);
    } catch (e) {
      console.error(e);
      setActionErr(
        e instanceof EnchantError ? e.message : "Could not apply enchant.",
      );
    } finally {
      setBusy(false);
    }
  }

  const canApply =
    selectedInstanceId &&
    selectedEnchantId &&
    selectedWeapon &&
    profile &&
    profile.gold >= ENCHANT_BY_ID[selectedEnchantId].goldCost &&
    selectedWeapon.instance.enchant !== selectedEnchantId;

  if (authError) {
    return (
      <div className="p-6 text-center text-red-400">
        <p>{authError}</p>
        <Link href="/" className="mt-4 inline-block text-fuchsia-400 underline">
          Home
        </Link>
      </div>
    );
  }

  if (authLoading || (!user && !authError)) {
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
        <Link href="/" className="mt-4 block text-fuchsia-400 underline">
          Home
        </Link>
      </div>
    );
  }

  if (loadError && !profile) {
    return (
      <div className="p-6 text-center text-red-400">
        <p>{loadError}</p>
        <Link href="/" className="mt-4 inline-block text-fuchsia-400 underline">
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
        className="pointer-events-none absolute inset-0 scale-105 bg-[url('/images/menu-bg.svg')] bg-cover bg-center opacity-35"
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
          combatTotals={profile.effectiveStats}
        />

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-10 pt-2 text-zinc-100">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="text-sm text-fuchsia-400/90 hover:text-fuchsia-300"
            >
              ← Main menu
            </Link>
            <h1 className="text-lg font-semibold text-fuchsia-100/95">
              Enchantress
            </h1>
            <span className="w-16" aria-hidden />
          </div>

          <p className="text-sm text-zinc-400">
            Imbue any weapon with an enchant. Costs gold; replaces the weapon’s
            current enchant.
          </p>

          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Your weapons
            </h2>
            {weapons.length === 0 ? (
              <p className="text-sm text-zinc-500">No weapons in inventory.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {weapons.map((w) => {
                  const active =
                    w.instance.instanceId === selectedInstanceId;
                  return (
                    <li key={w.instance.instanceId}>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedInstanceId(w.instance.instanceId)
                        }
                        className={[
                          "w-full rounded-xl border px-4 py-3 text-left transition",
                          active
                            ? "border-fuchsia-500/60 bg-fuchsia-950/40"
                            : "border-zinc-700 bg-zinc-900/80 hover:border-zinc-600",
                        ].join(" ")}
                      >
                        <span className="font-medium text-zinc-100">
                          {w.item.name}
                        </span>
                        <span
                          className={`ml-2 text-xs capitalize ${rarityLabelClass[w.displayRarity]}`}
                        >
                          {w.displayRarity}
                        </span>
                        {w.instance.enchant ? (
                          <p className="mt-1 text-xs text-fuchsia-300/90">
                            Enchant:{" "}
                            {ENCHANT_BY_ID[w.instance.enchant].name}
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-zinc-500">
                            No enchant
                          </p>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Enchants
            </h2>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ENCHANTS.map((e) => {
                const sel = selectedEnchantId === e.id;
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedEnchantId(e.id)}
                      className={[
                        "h-full w-full rounded-xl border px-3 py-3 text-left transition",
                        sel
                          ? "border-pink-500/55 bg-pink-950/35"
                          : "border-zinc-700 bg-zinc-900/70 hover:border-zinc-600",
                      ].join(" ")}
                    >
                      <p className="font-semibold text-pink-100">{e.name}</p>
                      <p className="mt-1 text-xs text-zinc-400">
                        {e.description}
                      </p>
                      <p className="mt-2 font-mono text-sm text-amber-300">
                        {e.goldCost} gold
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {actionErr ? (
            <p className="text-center text-sm text-red-400">{actionErr}</p>
          ) : null}

          <button
            type="button"
            disabled={!canApply || busy}
            onClick={handleApply}
            className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 py-3.5 text-sm font-bold text-white shadow-lg transition hover:from-fuchsia-500 hover:to-pink-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy
              ? "Applying…"
              : canApply
                ? `Apply ${ENCHANT_BY_ID[selectedEnchantId!].name}`
                : "Select weapon and enchant"}
          </button>
        </div>
      </div>
    </div>
  );
}
