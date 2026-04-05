"use client";

import Link from "next/link";
import { serverTimestamp, updateDoc } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SLOT_ORDER } from "@/types/item";
import { getUserProfileDocRef } from "@/lib/userProfileFirestore";
import { getOrCreateUser, type UserDocument } from "@/lib/getOrCreateUser";
import { HERO_CLASSES } from "@/lib/heroClasses";
import { persistEffectiveCombatStats } from "@/lib/inventoryUtils";
import { resolveItem } from "@/lib/items";
import {
  ShopGoldError,
  ShopOfferError,
  transactionManualRefreshShop,
  transactionPurchaseShopSlot,
} from "@/lib/shopFirestore";
import {
  formatRefreshCountdown,
  generateShop,
  isShopStale,
  MANUAL_REFRESH_COST,
  msUntilShopRefresh,
  serializeShopOffers,
  shopNeedsRegeneration,
} from "@/lib/shopSystem";
import { ItemCard } from "@/components/ItemCard";
import { rarityLabelClass } from "@/lib/itemRarityStyles";
import { useAuth } from "@/hooks/useAuth";

const SLOT_LABEL: Record<string, string> = {
  weapon: "Weapon",
  armor: "Armor",
  helmet: "Helmet",
  ring: "Ring",
};

function classLabel(classId: string | null): string {
  if (!classId) return "Adventurer";
  return HERO_CLASSES.find((c) => c.id === classId)?.name ?? classId;
}

export function ShopView() {
  const { user, loading: authLoading, authError } = useAuth();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [userDoc, setUserDoc] = useState<UserDocument | null>(null);
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [buyBusy, setBuyBusy] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  const refreshUser = useCallback(async (uid: string) => {
    const d = await getOrCreateUser(uid);
    setUserDoc(d);
    return d;
  }, []);

  const ensureShopFilled = useCallback(
    async (uid: string, docSnap: UserDocument) => {
      const shop = docSnap.shop;
      const needs =
        isShopStale(shop.lastRefresh) || shopNeedsRegeneration(shop);
      if (!needs) return docSnap;
      const offers = generateShop(docSnap.class);
      const userRef = await getUserProfileDocRef(uid);
      await updateDoc(userRef, {
        shop: {
          items: serializeShopOffers(offers),
          lastRefresh: serverTimestamp(),
        },
      });
      return getOrCreateUser(uid);
    },
    [],
  );

  useEffect(() => {
    if (authLoading || authError) return;
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        let d = await refreshUser(user.uid);
        if (cancelled) return;
        d = await ensureShopFilled(user.uid, d);
        if (cancelled) return;
        setUserDoc(d);
      } catch (e) {
        console.error(e);
        if (!cancelled) setErr("Failed to load shop.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, authError, user, refreshUser, ensureShopFilled]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const countdownMs = useMemo(() => {
    void tick;
    return userDoc ? msUntilShopRefresh(userDoc.shop.lastRefresh) : 0;
  }, [userDoc, tick]);

  async function handleManualRefresh() {
    if (!user || !userDoc || refreshBusy) return;
    setErr(null);
    setRefreshBusy(true);
    try {
      await transactionManualRefreshShop(user.uid, userDoc.class);
      await refreshUser(user.uid);
    } catch (e) {
      if (e instanceof ShopGoldError) {
        setErr("Not enough gold for refresh.");
      } else {
        console.error(e);
        setErr("Could not refresh shop.");
      }
    } finally {
      setRefreshBusy(false);
    }
  }

  async function handleBuy(slotIndex: number) {
    if (!user || !userDoc || buyBusy !== null) return;
    setErr(null);
    setBuyBusy(slotIndex);
    try {
      await transactionPurchaseShopSlot(user.uid, slotIndex);
      await persistEffectiveCombatStats(user.uid);
      await refreshUser(user.uid);
    } catch (e) {
      if (e instanceof ShopGoldError) {
        setErr("Not enough gold.");
      } else if (e instanceof ShopOfferError) {
        setErr("Cannot buy this item.");
      } else {
        console.error(e);
        setErr("Purchase failed.");
      }
    } finally {
      setBuyBusy(null);
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
        {err ?? "Could not load shop."}
        <Link href="/" className="mt-4 block text-amber-400 underline">
          Home
        </Link>
      </div>
    );
  }

  const offers = userDoc.shop.items;

  return (
    <div className="min-h-dvh bg-zinc-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-950/25 via-zinc-950 to-black text-zinc-100">
      <div className="mx-auto max-w-2xl px-4 py-6 pb-12">
        <header className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-amber-300/90 hover:text-amber-200"
          >
            ← Main menu
          </Link>
          <h1 className="text-lg font-semibold tracking-tight">Shop</h1>
          <span className="w-20" aria-hidden />
        </header>

        <div className="mb-6 rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/80 to-black/70 p-4 shadow-[0_0_32px_rgba(0,0,0,0.35)] backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-zinc-500">Gold</p>
              <p className="text-2xl font-bold tabular-nums text-amber-200">
                {userDoc.gold}
              </p>
            </div>
            <div className="text-right text-xs text-zinc-500">
              <p>Class offers · {classLabel(userDoc.class)}</p>
              <p className="mt-1 text-zinc-400">
                Free refresh in{" "}
                <span className="font-mono text-zinc-300">
                  {formatRefreshCountdown(countdownMs)}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={
              refreshBusy || userDoc.gold < MANUAL_REFRESH_COST
            }
            onClick={handleManualRefresh}
            className="mt-4 w-full rounded-xl border border-amber-500/35 bg-amber-950/40 py-3 text-sm font-semibold text-amber-100 shadow-[0_0_20px_rgba(251,191,36,0.12)] transition hover:bg-amber-900/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {refreshBusy
              ? "Refreshing…"
              : `Refresh Shop (${MANUAL_REFRESH_COST} gold)`}
          </button>
        </div>

        {err ? (
          <p className="mb-4 text-center text-sm text-red-400">{err}</p>
        ) : null}

        <div className="grid grid-cols-2 gap-4 sm:gap-5">
          {SLOT_ORDER.map((slot, index) => {
            const offer = offers[index];
            const item = offer ? resolveItem(offer.id) : undefined;
            const busy = buyBusy === index;
            if (!offer || !item) {
              return (
                <div
                  key={slot}
                  className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-black/30 p-4 text-center text-sm text-zinc-500"
                >
                  {SLOT_LABEL[slot] ?? slot}
                  <span className="mt-2">No offer</span>
                </div>
              );
            }
            const canAfford = userDoc.gold >= offer.price;
            const purchaseLocked = buyBusy !== null;
            return (
              <div
                key={`${slot}-${offer.id}-${index}`}
                className="flex flex-col items-center gap-3"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {SLOT_LABEL[slot]}
                </p>
                <div className="flex w-full flex-col items-center">
                  <ItemCard
                    item={item}
                    displayRarity={offer.rarity}
                    disabled
                    size="md"
                    layout="stack"
                    className="mx-auto max-w-[168px]"
                  />
                  <p
                    className={`mt-2 text-xs font-semibold capitalize ${rarityLabelClass[offer.rarity]}`}
                  >
                    {offer.rarity}
                  </p>
                  <p className="mt-1 font-mono text-sm text-amber-200/90">
                    {offer.price} g
                  </p>
                </div>
                {offer.sold ? (
                  <span className="text-xs font-medium text-zinc-500">
                    Sold
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={
                      offer.sold ||
                      busy ||
                      purchaseLocked ||
                      !canAfford
                    }
                    onClick={() => handleBuy(index)}
                    className="w-full max-w-[168px] rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busy ? "…" : canAfford ? "Buy" : "Not enough gold"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
