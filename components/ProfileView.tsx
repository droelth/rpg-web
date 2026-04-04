"use client";

import Image from "next/image";
import Link from "next/link";
import { deleteDoc, doc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  EquippedState,
  InventoryInstance,
  Item,
  ItemRarity,
  ItemType,
} from "@/types/item";
import { SLOT_ORDER } from "@/types/item";
import { getInventoryPortraitPath } from "@/lib/classPortrait";
import {
  fetchUserPublicProfile,
  getOrCreateUser,
  type UserDocument,
} from "@/lib/getOrCreateUser";
import { HERO_CLASSES } from "@/lib/heroClasses";
import {
  findInventoryInstance,
  getEffectiveCombatTotals,
} from "@/lib/inventoryUtils";
import { resolveItem } from "@/lib/items";
import {
  getItemRarity,
  rarityLabelClass,
  rarityStyles,
} from "@/lib/itemRarityStyles";
import { useAuth } from "@/hooks/useAuth";
import { auth, getDb } from "@/lib/firebase";

const SLOT_LABEL: Record<ItemType, string> = {
  weapon: "Weapon",
  armor: "Armor",
  helmet: "Helmet",
  ring: "Ring",
};

function classDisplayName(classId: string | null): string {
  if (!classId) return "Unknown";
  const def = HERO_CLASSES.find((c) => c.id === classId);
  return def?.name ?? classId.charAt(0).toUpperCase() + classId.slice(1);
}

type EquippedSlotView = { item: Item; displayRarity: ItemRarity } | undefined;

function resolveEquippedSlots(
  equipped: EquippedState,
  inventory: InventoryInstance[],
): Record<ItemType, EquippedSlotView> {
  const row = (instanceId: string | null): EquippedSlotView => {
    if (!instanceId) return undefined;
    const inst = findInventoryInstance(inventory, instanceId);
    if (!inst) return undefined;
    const item = resolveItem(inst.itemId);
    if (!item) return undefined;
    const displayRarity = inst.rarity ?? item.rarity;
    return { item, displayRarity };
  };
  return {
    weapon: row(equipped.weapon),
    armor: row(equipped.armor),
    helmet: row(equipped.helmet),
    ring: row(equipped.ring),
  };
}

const REMOVE_CHARACTER_CONFIRM =
  "Are you sure you want to remove your character?\n\n" +
  "This will permanently delete your entire save from Firebase (progress, items, gold, rank, everything). " +
  "This cannot be undone.";

export type ProfileViewProps = {
  /** When set, show this user's public profile (read-only). */
  targetUserId?: string | null;
};

export function ProfileView({ targetUserId }: ProfileViewProps) {
  const router = useRouter();
  const { user, loading: authLoading, authError } = useAuth();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [userDoc, setUserDoc] = useState<UserDocument | null>(null);

  const targetIdTrimmed = targetUserId?.trim() ?? "";
  const viewingOther = Boolean(targetIdTrimmed) && targetIdTrimmed !== user?.uid;

  const refreshSelf = useCallback(async (uid: string) => {
    const d = await getOrCreateUser(uid);
    setUserDoc(d);
  }, []);

  useEffect(() => {
    if (authLoading || authError) return;
    if (!user) {
      setLoading(false);
      return;
    }

    const otherId = targetIdTrimmed;
    setLoading(true);
    setErr(null);
    let cancelled = false;
    (async () => {
      try {
        if (otherId && otherId !== user.uid) {
          const d = await fetchUserPublicProfile(otherId);
          if (!cancelled) {
            if (!d) setErr("Player not found.");
            setUserDoc(d);
          }
        } else {
          await refreshSelf(user.uid);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setErr("Failed to load profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    authError,
    user,
    targetIdTrimmed,
    refreshSelf,
  ]);

  async function handleRemoveCharacter() {
    if (!user || removing) return;
    const confirmed = window.confirm(REMOVE_CHARACTER_CONFIRM);
    if (!confirmed) return;
    setDeleteErr(null);
    setRemoving(true);
    try {
      await deleteDoc(doc(getDb(), "users", user.uid));
      await signOut(auth);
      router.push("/");
    } catch (e) {
      console.error(e);
      setDeleteErr("Could not delete your character. Check your connection and Firestore rules.");
    } finally {
      setRemoving(false);
    }
  }

  const equippedBySlot = useMemo(() => {
    if (!userDoc) return null;
    return resolveEquippedSlots(userDoc.equipped, userDoc.inventory);
  }, [userDoc]);

  const finalStats = useMemo(() => {
    if (!userDoc) return null;
    return getEffectiveCombatTotals({
      stats: userDoc.stats,
      equipped: userDoc.equipped,
      inventory: userDoc.inventory,
      heroClass: userDoc.class,
    });
  }, [userDoc]);

  const portraitSrc = userDoc
    ? getInventoryPortraitPath(userDoc.class)
    : "/images/inventory-hero.png";

  const xpCap =
    userDoc && userDoc.xpToNext > 0 ? userDoc.xpToNext : 1;
  const xpPct = userDoc
    ? Math.min(100, (userDoc.xp / xpCap) * 100)
    : 0;

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

  if (err || !userDoc || !finalStats || !equippedBySlot) {
    return (
      <div className="p-6 text-center text-red-400">
        {err ?? "Could not load profile."}
        <Link
          href={viewingOther ? "/leaderboard" : "/"}
          className="mt-4 block text-amber-400 underline"
        >
          {viewingOther ? "Back to leaderboard" : "Home"}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-zinc-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-950/35 via-zinc-950 to-black text-zinc-100">
      <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-6 pb-12">
        <header className="flex items-center justify-between">
          {viewingOther ? (
            <Link
              href="/leaderboard"
              className="text-sm text-violet-300/90 hover:text-violet-200"
            >
              ← Leaderboard
            </Link>
          ) : (
            <Link
              href="/"
              className="text-sm text-violet-300/90 hover:text-violet-200"
            >
              ← Main menu
            </Link>
          )}
          <h1 className="text-lg font-semibold tracking-tight">
            {viewingOther ? "Adventurer" : "Profile"}
          </h1>
          <span className="w-20" aria-hidden />
        </header>

        {deleteErr ? (
          <p className="text-center text-sm text-red-400">{deleteErr}</p>
        ) : null}

        {/* Character header */}
        <section className="flex flex-col items-center text-center">
          <div className="relative mb-4 aspect-[3/4] w-full max-w-[200px] overflow-hidden rounded-2xl border border-white/10 bg-black/50 shadow-[0_0_40px_rgba(139,92,246,0.2)] ring-1 ring-violet-500/25 backdrop-blur-sm">
            <Image
              src={portraitSrc}
              alt=""
              fill
              className="object-cover object-top"
              sizes="200px"
              priority
              unoptimized
            />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/25"
              aria-hidden
            />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-50">
            {userDoc.username?.trim() || "Traveler"}
          </h2>
          <p className="mt-1 text-sm font-medium capitalize text-violet-300/85">
            {classDisplayName(userDoc.class)}
          </p>
          {viewingOther ? (
            <p className="mt-3 text-xs text-zinc-500">
              Rank {userDoc.rankPoints.toLocaleString()} RP · {userDoc.wins}W /{" "}
              {userDoc.losses}L
            </p>
          ) : null}
        </section>

        {/* Level & XP */}
        <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/70 p-5 shadow-[0_0_32px_rgba(0,0,0,0.4)] backdrop-blur-md">
          <p className="text-center text-sm font-semibold text-zinc-200">
            Level {userDoc.level}
          </p>
          <div className="mt-3 flex justify-between text-xs text-zinc-500">
            <span>Experience</span>
            <span className="font-mono tabular-nums text-zinc-400">
              XP: {userDoc.xp} / {xpCap}
            </span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-black/50 ring-1 ring-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.35)]"
              style={{ width: `${xpPct}%` }}
            />
          </div>
        </section>

        {/* Final stats */}
        <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/70 p-5 shadow-[0_0_32px_rgba(0,0,0,0.4)] backdrop-blur-md">
          <p className="mb-4 text-center text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Combat stats
            <span className="mt-1 block text-[9px] font-normal normal-case text-zinc-600">
              Base + equipped
            </span>
          </p>
          <dl className="mx-auto flex max-w-[200px] flex-col gap-3">
            {(
              [
                ["HP", finalStats.hp],
                ["ATK", finalStats.atk],
                ["DEF", finalStats.def],
                ["CRIT", finalStats.crit],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between border-b border-white/5 pb-3 last:border-0 last:pb-0"
              >
                <dt className="text-sm text-zinc-500">{label}</dt>
                <dd className="font-mono text-lg font-semibold tabular-nums text-zinc-100">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Equipped */}
        <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/70 p-5 shadow-[0_0_32px_rgba(0,0,0,0.4)] backdrop-blur-md">
          <p className="mb-4 text-center text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Equipped
          </p>
          <ul className="space-y-3">
            {SLOT_ORDER.map((slot) => {
              const id = userDoc.equipped[slot];
              const row = equippedBySlot[slot];
              const item = row?.item;
              const displayRarity = row?.displayRarity;
              const borderGlow = item
                ? rarityStyles[displayRarity ?? getItemRarity(item)]
                : "border-zinc-700 shadow-none";
              return (
                <li
                  key={slot}
                  className={[
                    "rounded-xl border-2 bg-black/30 px-4 py-3 backdrop-blur-sm",
                    borderGlow,
                  ].join(" ")}
                >
                  <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                    {SLOT_LABEL[slot]}
                  </p>
                  {item && displayRarity ? (
                    <>
                      <p className="mt-1 font-medium text-zinc-100">
                        {item.name}
                      </p>
                      <p
                        className={`mt-0.5 text-xs font-semibold capitalize ${rarityLabelClass[displayRarity]}`}
                      >
                        {displayRarity}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-zinc-600">
                      {id && !item ? "Unknown item" : "— Empty —"}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {!viewingOther ? (
          <section className="rounded-2xl border border-red-500/25 bg-red-950/20 p-5 backdrop-blur-md">
            <p className="text-center text-[10px] font-semibold uppercase tracking-widest text-red-400/90">
              Danger zone
            </p>
            <p className="mt-2 text-center text-xs text-zinc-500">
              Permanently delete your character document in Firebase. You will be
              signed out and can start fresh.
            </p>
            <button
              type="button"
              disabled={removing}
              onClick={handleRemoveCharacter}
              className="mt-4 w-full rounded-xl border border-red-500/50 bg-red-950/50 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-900/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {removing ? "Removing…" : "Remove character"}
            </button>
          </section>
        ) : null}
      </div>
    </div>
  );
}
