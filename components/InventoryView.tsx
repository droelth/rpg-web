"use client";

import Image from "next/image";
import Link from "next/link";
import { updateDoc } from "firebase/firestore";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { EquippedState, Item, ItemType } from "@/types/item";
import { SLOT_ORDER } from "@/types/item";
import { getInventoryPortraitPath } from "@/lib/classPortrait";
import { getUserProfileDocRef } from "@/lib/userProfileFirestore";
import { getOrCreateUser, type UserDocument } from "@/lib/getOrCreateUser";
import type { CombatTotals } from "@/lib/inventoryUtils";
import {
  EquipClassMismatchError,
  ensureInventoryDefaults,
  equipItem,
  findInventoryInstance,
  getEffectiveCombatTotals,
  parseBaseStats,
  persistEffectiveCombatStats,
  simulateEquip,
} from "@/lib/inventoryUtils";
import { describeItemStats } from "@/lib/itemDisplay";
import { rarityLabelClass } from "@/lib/itemRarityStyles";
import {
  canUserEquipItem,
  resolveInventoryEntries,
  resolveItem,
  sortInventoryRowsBySlotOrder,
} from "@/lib/items";
import { EmptyEquipSlot, ItemCard } from "@/components/ItemCard";
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
    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-zinc-900/70 via-black/50 to-black/70 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
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

const PREVIEW_STAT_ROWS: { key: keyof CombatTotals; label: string }[] = [
  { key: "atk", label: "ATK" },
  { key: "def", label: "DEF" },
  { key: "hp", label: "HP" },
  { key: "crit", label: "CRIT" },
];

function StatEquipPreview({
  current,
  after,
}: {
  current: CombatTotals;
  after: CombatTotals;
}) {
  return (
    <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        Stat preview
      </p>
      <div className="space-y-4">
        {PREVIEW_STAT_ROWS.map(({ key, label }) => {
          const before = current[key];
          const next = after[key];
          const delta = next - before;
          const deltaCls =
            delta > 0
              ? "text-emerald-400"
              : delta < 0
                ? "text-red-400"
                : "text-zinc-500";
          const deltaStr =
            delta === 0 ? "(±0)" : `(${delta > 0 ? "+" : ""}${delta})`;
          return (
            <div
              key={key}
              className="rounded-lg border border-white/5 bg-black/25 px-3 py-2.5 backdrop-blur-sm"
            >
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Current
              </p>
              <p className="mt-0.5 font-mono text-sm text-zinc-200">
                {label}: {before}
              </p>
              <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                After equip
              </p>
              <p className="mt-0.5 font-mono text-sm text-zinc-100">
                {label}: {next}{" "}
                <span className={`text-xs font-semibold ${deltaCls}`}>
                  {deltaStr}
                </span>
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function rarityDisplayName(rarity: string): string {
  return rarity.charAt(0).toUpperCase() + rarity.slice(1);
}

export function InventoryView() {
  const { user, loading: authLoading, authError } = useAuth();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [userDoc, setUserDoc] = useState<UserDocument | null>(null);
  const [selectedInvIndex, setSelectedInvIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

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

  const inventoryRows = useMemo(
    () => (userDoc ? resolveInventoryEntries(userDoc.inventory) : []),
    [userDoc],
  );

  const { sortedInventoryRows, sortedIndexByInstanceId } = useMemo(() => {
    const sorted = sortInventoryRowsBySlotOrder(inventoryRows);
    const m = new Map<string, number>();
    sorted.forEach((r, i) => m.set(r.instance.instanceId, i));
    return { sortedInventoryRows: sorted, sortedIndexByInstanceId: m };
  }, [inventoryRows]);

  const selectedRow =
    selectedInvIndex !== null &&
    selectedInvIndex >= 0 &&
    selectedInvIndex < sortedInventoryRows.length
      ? sortedInventoryRows[selectedInvIndex]
      : null;
  const selected = selectedRow?.item ?? null;

  const preview = useMemo(() => {
    if (!userDoc || !base || !selected || !selectedRow) return null;
    return simulateEquip(
      base,
      userDoc.equipped,
      userDoc.inventory,
      selectedRow.instance.instanceId,
      selected,
      userDoc.class,
    );
  }, [userDoc, base, selected, selectedRow]);

  const currentTotals = useMemo(
    () =>
      userDoc
        ? getEffectiveCombatTotals({
            stats: userDoc.stats,
            equipped: userDoc.equipped,
            inventory: userDoc.inventory,
            heroClass: userDoc.class,
          })
        : null,
    [userDoc],
  );

  const selectedStatLines = useMemo(
    () =>
      selected && selectedRow
        ? describeItemStats(selected, selectedRow.instance)
        : [],
    [selected, selectedRow],
  );

  const portraitSrc = useMemo(
    () => (userDoc ? getInventoryPortraitPath(userDoc.class) : "/images/inventory-hero.png"),
    [userDoc],
  );

  const equippedInstanceIdForSelectedSlot =
    selected && userDoc ? userDoc.equipped[selected.type] : null;
  const isSelectedEquipped =
    selectedRow != null &&
    equippedInstanceIdForSelectedSlot === selectedRow.instance.instanceId;

  const selectedUsableByClass =
    selected != null && canUserEquipItem(selected, userDoc?.class ?? null);

  const shouldOfferSwap =
    equippedInstanceIdForSelectedSlot != null &&
    selectedRow != null &&
    equippedInstanceIdForSelectedSlot !== selectedRow.instance.instanceId;

  const equippedItemToReplace =
    shouldOfferSwap && equippedInstanceIdForSelectedSlot != null && userDoc
      ? (() => {
          const inst = findInventoryInstance(
            userDoc.inventory,
            equippedInstanceIdForSelectedSlot,
          );
          return inst ? resolveItem(inst.itemId) : undefined;
        })()
      : undefined;

  async function handleEquip() {
    if (!user || !userDoc || !selectedRow || saving) return;
    const iid = selectedRow.instance.instanceId;
    if (!userDoc.inventory.some((e) => e.instanceId === iid)) {
      setErr("Item is not in your inventory.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await equipItem(user.uid, iid);
      await refresh(user.uid);
    } catch (e) {
      console.error(e);
      if (e instanceof EquipClassMismatchError) {
        setErr(e.message);
      } else {
        setErr(shouldOfferSwap ? "Could not swap item." : "Could not equip item.");
      }
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
      const ref = await getUserProfileDocRef(user.uid);
      await updateDoc(ref, { equipped: next });
      await refresh(user.uid);
      setSelectedInvIndex(null);
    } catch (e) {
      console.error(e);
      setErr("Could not unequip.");
    } finally {
      setSaving(false);
    }
  }

  function slotItem(slot: ItemType): Item | undefined {
    if (!userDoc) return;
    const iid = userDoc.equipped[slot];
    if (!iid) return;
    const inst = findInventoryInstance(userDoc.inventory, iid);
    if (!inst) return;
    return resolveItem(inst.itemId);
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
                key={portraitSrc}
                src={portraitSrc}
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
            <div className="w-full space-y-2.5">
              <p className="text-center text-xs font-medium uppercase tracking-widest text-zinc-500">
                Equipped
              </p>
              {SLOT_ORDER.map((slot) => {
                const iid = userDoc.equipped[slot];
                const equippedRow = iid
                  ? sortedInventoryRows.find((r) => r.instance.instanceId === iid)
                  : undefined;
                const it = equippedRow?.item ?? slotItem(slot);
                return (
                  <div key={slot} className="space-y-1">
                    <p className="px-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                      {SLOT_LABEL[slot]}
                    </p>
                    {it ? (
                      <ItemCard
                        item={it}
                        displayRarity={equippedRow?.displayRarity}
                        size="sm"
                        layout="row"
                        selected={
                          selectedRow != null &&
                          iid === selectedRow.instance.instanceId
                        }
                        disabled={saving}
                        onClick={() => {
                          if (!iid) return;
                          const idx = sortedIndexByInstanceId.get(iid);
                          setSelectedInvIndex(idx !== undefined ? idx : null);
                        }}
                        className="w-full"
                      />
                    ) : (
                      <EmptyEquipSlot
                        slotLabel={SLOT_LABEL[slot]}
                        disabled={saving}
                        onClick={() => setSelectedInvIndex(null)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Right: grid + panel */}
          <section className="min-w-0 flex-1 space-y-4">
            <p className="text-center text-xs font-medium uppercase tracking-widest text-zinc-500 sm:text-left">
              Items
            </p>
            <div className="flex justify-center sm:justify-start">
              <div className="grid w-full max-w-3xl grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 justify-items-center">
                {SLOT_ORDER.map((slot) => {
                  const rowsForSlot = sortedInventoryRows.filter(
                    (r) => r.item.type === slot,
                  );
                  if (rowsForSlot.length === 0) return null;

                  return (
                    <Fragment key={slot}>
                      <div className="col-span-3 mt-1 border-t border-white/5 pt-3 sm:col-span-4 [&:first-child]:mt-0 [&:first-child]:border-t-0 [&:first-child]:pt-0">
                        <p className="w-full text-left text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                          {SLOT_LABEL[slot]}
                          <span className="ml-2 font-normal normal-case tracking-normal text-zinc-600">
                            ({rowsForSlot.length})
                          </span>
                        </p>
                      </div>
                      {rowsForSlot.map((row) => {
                        const i = sortedIndexByInstanceId.get(
                          row.instance.instanceId,
                        )!;
                        return (
                          <ItemCard
                            key={row.instance.instanceId}
                            item={row.item}
                            displayRarity={row.displayRarity}
                            size="md"
                            layout="stack"
                            selected={selectedInvIndex === i}
                            disabled={saving}
                            onClick={() => setSelectedInvIndex(i)}
                            className="mx-auto w-full max-w-[168px]"
                          />
                        );
                      })}
                    </Fragment>
                  );
                })}
              </div>
            </div>

            {/* Selected panel */}
            <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/85 via-zinc-950/90 to-black/80 p-5 shadow-[0_0_48px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
              {selected && selectedRow ? (
                <>
                  <h2 className="text-xl font-bold tracking-tight text-zinc-50">
                    {selected.name}
                  </h2>
                  <p
                    className={`mt-1 text-sm font-semibold ${rarityLabelClass[selectedRow.displayRarity]}`}
                  >
                    {rarityDisplayName(selectedRow.displayRarity)}
                  </p>
                  <p className="mt-0.5 text-xs capitalize text-violet-300/70">
                    {selected.type}
                  </p>
                  <ul className="mt-4 space-y-1.5 border-t border-white/10 pt-4 text-sm text-zinc-200">
                    {selectedStatLines.length ? (
                      selectedStatLines.map((line) => (
                        <li key={line} className="font-mono text-[13px]">
                          {line}
                        </li>
                      ))
                    ) : (
                      <li className="text-zinc-500">No stat bonuses</li>
                    )}
                  </ul>

                  {preview && selectedUsableByClass ? (
                    <StatEquipPreview
                      current={preview.current}
                      after={preview.after}
                    />
                  ) : null}

                  {!selectedUsableByClass ? (
                    <p className="mt-4 text-sm text-amber-400/90">
                      This item is for another class. You cannot equip it.
                    </p>
                  ) : null}

                  {shouldOfferSwap ? (
                    <p className="mt-4 text-xs text-zinc-500">
                      Replaces current {SLOT_LABEL[selected.type]}
                      {equippedItemToReplace
                        ? `: ${equippedItemToReplace.name}`
                        : ""}
                      .
                    </p>
                  ) : null}

                  <div className="mt-5 flex flex-wrap gap-2">
                    {!isSelectedEquipped ? (
                      <button
                        type="button"
                        disabled={saving || !selectedUsableByClass}
                        onClick={handleEquip}
                        className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:bg-violet-500 disabled:opacity-40"
                      >
                        {shouldOfferSwap ? "Swap" : "Equip"}
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
