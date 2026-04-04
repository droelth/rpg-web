"use client";

import Image from "next/image";
import Link from "next/link";
import { doc, updateDoc } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { EquippedState, Item, ItemType } from "@/types/item";
import { SLOT_ORDER } from "@/types/item";
import { getDb } from "@/lib/firebase";
import { getOrCreateUser, type UserDocument } from "@/lib/getOrCreateUser";
import {
  calculateTotalStats,
  ensureInventoryDefaults,
  formatStatDelta,
  getEquippedItems,
  parseBaseStats,
  persistEffectiveCombatStats,
  simulateEquip,
} from "@/lib/inventoryUtils";
import { useAuth } from "@/hooks/useAuth";

const SLOT_LABEL: Record<ItemType, string> = {
  weapon: "Weapon",
  armor: "Armor",
  helmet: "Helmet",
  ring: "Ring",
};

function StatBlock({
  title,
  totals,
}: {
  title: string;
  totals: { hp: number; atk: number; def: number; crit: number };
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-zinc-200">
        <dt className="text-zinc-500">HP</dt>
        <dd className="text-right font-mono tabular-nums">{totals.hp}</dd>
        <dt className="text-zinc-500">ATK</dt>
        <dd className="text-right font-mono tabular-nums">{totals.atk}</dd>
        <dt className="text-zinc-500">DEF</dt>
        <dd className="text-right font-mono tabular-nums">{totals.def}</dd>
        <dt className="text-zinc-500">CRIT</dt>
        <dd className="text-right font-mono tabular-nums">{totals.crit}</dd>
      </dl>
    </div>
  );
}

function itemStatHint(item: Item): string {
  const p: string[] = [];
  if (item.stats.atk) p.push(`ATK +${item.stats.atk}`);
  if (item.stats.def) p.push(`DEF +${item.stats.def}`);
  if (item.stats.hp) p.push(`HP +${item.stats.hp}`);
  if (item.stats.crit) p.push(`CRIT +${item.stats.crit}`);
  return p.length ? p.join(" · ") : "—";
}

export function InventoryView() {
  const { user, loading: authLoading, authError } = useAuth();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [userDoc, setUserDoc] = useState<UserDocument | null>(null);
  const [selected, setSelected] = useState<Item | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async (uid: string) => {
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
        if (!cancelled) setErr("Failed to load inventory.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, authError, user, refresh]);

  const base = useMemo(
    () => (userDoc ? parseBaseStats(userDoc.stats) : null),
    [userDoc],
  );

  const preview = useMemo(() => {
    if (!userDoc || !base || !selected) return null;
    return simulateEquip(
      base,
      userDoc.equipped,
      userDoc.inventory,
      selected,
    );
  }, [userDoc, base, selected]);

  const equippedItems = useMemo(
    () =>
      userDoc
        ? getEquippedItems(userDoc.inventory, userDoc.equipped)
        : [],
    [userDoc],
  );

  const currentTotals = useMemo(
    () => (base ? calculateTotalStats(base, equippedItems) : null),
    [base, equippedItems],
  );

  const isSelectedEquipped =
    selected && userDoc
      ? userDoc.equipped[selected.type] === selected.id
      : false;

  async function handleEquip() {
    if (!user || !userDoc || !selected || saving) return;
    setSaving(true);
    setErr(null);
    try {
      const next: EquippedState = {
        ...userDoc.equipped,
        [selected.type]: selected.id,
      };
      await updateDoc(userFirestoreRef(user.uid), { equipped: next });
      await refresh(user.uid);
    } catch (e) {
      console.error(e);
      setErr("Could not equip item.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUnequip(slot: ItemType) {
    if (!user || !userDoc || saving) return;
    setSaving(true);
    setErr(null);
    try {
      const next = { ...userDoc.equipped, [slot]: null };
      await updateDoc(userFirestoreRef(user.uid), { equipped: next });
      await refresh(user.uid);
      setSelected(null);
    } catch (e) {
      console.error(e);
      setErr("Could not unequip.");
    } finally {
      setSaving(false);
    }
  }

  function userFirestoreRef(uid: string) {
    return doc(getDb(), "users", uid);
  }

  function slotItem(slot: ItemType): Item | undefined {
    if (!userDoc) return;
    const id = userDoc.equipped[slot];
    if (!id) return;
    return userDoc.inventory.find((i) => i.id === id);
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

  if (err && !userDoc) {
    return (
      <div className="p-6 text-center text-red-400">
        {err}
        <Link href="/" className="mt-4 block text-amber-400 underline">
          Home
        </Link>
      </div>
    );
  }

  if (!userDoc || !base || !currentTotals) {
    return null;
  }

  return (
    <div className="min-h-dvh bg-zinc-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-950/40 via-zinc-950 to-black text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-4 pb-10">
        <header className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-violet-300/90 hover:text-violet-200"
          >
            ← Main menu
          </Link>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">
            Inventory
          </h1>
          <span className="w-20" />
        </header>

        {err ? (
          <p className="mb-4 text-center text-sm text-red-400">{err}</p>
        ) : null}

        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <StatBlock title="Base stats (character)" totals={base} />
          <StatBlock
            title="Total (base + equipped)"
            totals={currentTotals}
          />
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
          {/* Left: hero + slots */}
          <section className="flex w-full flex-col items-center lg:max-w-sm lg:shrink-0">
            <div className="relative mb-5 aspect-[3/4] w-full max-w-[220px] overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-[0_0_40px_rgba(139,92,246,0.15)] ring-1 ring-violet-500/20 backdrop-blur-sm">
              <Image
                src="/images/inventory-hero.png"
                alt=""
                fill
                className="object-cover object-top"
                sizes="220px"
                priority
                unoptimized
              />
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30"
                aria-hidden
              />
            </div>
            <div className="w-full space-y-2">
              <p className="text-center text-xs font-medium uppercase tracking-widest text-zinc-500">
                Equipped
              </p>
              {SLOT_ORDER.map((slot) => {
                const it = slotItem(slot);
                return (
                  <button
                    key={slot}
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      if (it) setSelected(it);
                      else setSelected(null);
                    }}
                    className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left shadow-inner backdrop-blur-md transition hover:border-violet-400/30 hover:bg-white/[0.08] hover:shadow-[0_0_20px_rgba(139,92,246,0.12)] disabled:opacity-50"
                  >
                    <span className="text-xs text-zinc-500">
                      {SLOT_LABEL[slot]}
                    </span>
                    <span className="max-w-[60%] truncate text-sm font-medium text-zinc-200">
                      {it ? it.name : "— Empty —"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Right: grid + panel */}
          <section className="min-w-0 flex-1 space-y-4">
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
              Items
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {userDoc.inventory.map((item) => {
                const active = selected?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={saving}
                    onClick={() => setSelected(item)}
                    className={[
                      "rounded-xl border px-3 py-3 text-left transition",
                      "bg-white/5 backdrop-blur-md hover:border-violet-400/35 hover:shadow-[0_0_18px_rgba(139,92,246,0.15)]",
                      active
                        ? "border-violet-400/50 shadow-[0_0_24px_rgba(139,92,246,0.2)]"
                        : "border-white/10",
                    ].join(" ")}
                  >
                    <span className="line-clamp-2 text-sm font-medium text-zinc-100">
                      {item.name}
                    </span>
                    <span className="mt-1 block text-[10px] text-zinc-500">
                      {itemStatHint(item)}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected panel */}
            <div className="rounded-2xl border border-white/10 bg-black/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
              {selected ? (
                <>
                  <h2 className="text-base font-semibold text-zinc-50">
                    {selected.name}
                  </h2>
                  <p className="mt-0.5 text-xs capitalize text-violet-300/80">
                    {selected.type}
                  </p>
                  <ul className="mt-3 space-y-1 text-sm text-zinc-300">
                    {selected.stats.atk != null ? (
                      <li>ATK +{selected.stats.atk}</li>
                    ) : null}
                    {selected.stats.def != null ? (
                      <li>DEF +{selected.stats.def}</li>
                    ) : null}
                    {selected.stats.hp != null ? (
                      <li>HP +{selected.stats.hp}</li>
                    ) : null}
                    {selected.stats.crit != null ? (
                      <li>CRIT +{selected.stats.crit}</li>
                    ) : null}
                    {!selected.stats.atk &&
                    !selected.stats.def &&
                    !selected.stats.hp &&
                    !selected.stats.crit ? (
                      <li className="text-zinc-500">No stat bonuses</li>
                    ) : null}
                  </ul>

                  {preview ? (
                    <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                      <StatBlock title="Current stats" totals={preview.current} />
                      <StatBlock title="After equip" totals={preview.after} />
                      <div className="flex flex-wrap gap-2 text-[11px] text-zinc-400">
                        <span>
                          HP{" "}
                          <span className="font-mono text-amber-200/90">
                            {formatStatDelta(preview.current.hp, preview.after.hp)}
                          </span>
                        </span>
                        <span>
                          ATK{" "}
                          <span className="font-mono text-amber-200/90">
                            {formatStatDelta(
                              preview.current.atk,
                              preview.after.atk,
                            )}
                          </span>
                        </span>
                        <span>
                          DEF{" "}
                          <span className="font-mono text-amber-200/90">
                            {formatStatDelta(
                              preview.current.def,
                              preview.after.def,
                            )}
                          </span>
                        </span>
                        <span>
                          CRIT{" "}
                          <span className="font-mono text-amber-200/90">
                            {formatStatDelta(
                              preview.current.crit,
                              preview.after.crit,
                            )}
                          </span>
                        </span>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {!isSelectedEquipped ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={handleEquip}
                        className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:bg-violet-500 disabled:opacity-40"
                      >
                        Equip
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleUnequip(selected.type)}
                        className="rounded-xl border border-zinc-600 bg-zinc-800/80 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-40"
                      >
                        Unequip
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-zinc-500">
                  Select an item to preview stats and equip.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
