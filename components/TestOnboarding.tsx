"use client";

import { useMemo, useState } from "react";
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import {
  INITIAL_USER_ENERGY,
  INITIAL_USER_GOLD,
} from "@/lib/getOrCreateUser";
import { createStarterInventory, inventoryToFirestore } from "@/lib/items";
import { EMPTY_EQUIPPED } from "@/types/item";
import {
  getEffectiveCombatTotals,
  persistEffectiveCombatStats,
} from "@/lib/inventoryUtils";
import { xpToNextForCurrentLevel } from "@/lib/levelSystem";
import { DEFAULT_HERO_ID, HERO_CLASSES } from "@/lib/heroClasses";
import { HeroSlider } from "@/components/HeroSlider";
import { UsernameInput } from "@/components/UsernameInput";
import { ContinueButton } from "@/components/ContinueButton";
import {
  allocateProfileDocIdForUsername,
  userAuthIndexDocRef,
} from "@/lib/userProfileFirestore";

type TestOnboardingProps = {
  uid: string;
  onSaved: () => void;
};

export function TestOnboarding({ uid, onSaved }: TestOnboardingProps) {
  const [username, setUsername] = useState("");
  const [selectedClassId, setSelectedClassId] = useState(DEFAULT_HERO_ID);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedClass = useMemo(
    () => HERO_CLASSES.find((c) => c.id === selectedClassId),
    [selectedClassId],
  );

  const canContinue = username.trim().length > 0 && selectedClass !== undefined;

  async function handleContinue() {
    const trimmed = username.trim();
    if (!trimmed || selectedClass === undefined) {
      setError("Enter your name to continue.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const db = getDb();
      const profileDocId = await allocateProfileDocIdForUsername(uid, trimmed);
      const profileRef = doc(db, "users", profileDocId);
      const legacyRef = doc(db, "users", uid);
      const [profileSnap, legacySnap] = await Promise.all([
        getDoc(profileRef),
        getDoc(legacyRef),
      ]);

      const inst = createStarterInventory(selectedClass.id);
      const equipped = { ...EMPTY_EQUIPPED };
      const effectiveStats = getEffectiveCombatTotals({
        stats: selectedClass.stats,
        equipped,
        inventory: inst,
        heroClass: selectedClass.id,
      });

      await setDoc(
        profileRef,
        {
          authUid: uid,
          username: trimmed,
          class: selectedClass.id,
          stats: selectedClass.stats,
          level: 1,
          xp: 0,
          xpToNext: xpToNextForCurrentLevel(1),
          gold: INITIAL_USER_GOLD,
          energy: INITIAL_USER_ENERGY,
          rankPoints: 0,
          wins: 0,
          losses: 0,
          inventory: inventoryToFirestore(inst),
          equipped,
          shop: { items: [], lastRefresh: null },
          effectiveStats,
          lastEnergyUpdate: serverTimestamp(),
          ...(!profileSnap.exists() && !legacySnap.exists()
            ? { createdAt: serverTimestamp() }
            : !profileSnap.exists() && legacySnap.exists()
              ? {
                  createdAt:
                    legacySnap.data()?.createdAt ?? serverTimestamp(),
                }
              : {}),
        },
        { merge: true },
      );

      await setDoc(userAuthIndexDocRef(uid), { profileId: profileDocId });

      if (profileDocId !== uid && legacySnap.exists()) {
        await deleteDoc(legacyRef);
      }

      await persistEffectiveCombatStats(uid);
      onSaved();
    } catch (e) {
      console.error(e);
      setError("Could not save. Check Firestore rules and connection.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8 px-4 py-6 sm:px-6">
      <header className="text-center">
        <h1 className="font-serif text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
          Begin your journey
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Select a class and claim your name.
        </p>
      </header>

      <HeroSlider
        classes={HERO_CLASSES}
        selectedId={selectedClassId}
        onSelect={setSelectedClassId}
        disabled={saving}
      />

      <UsernameInput
        value={username}
        onChange={setUsername}
        disabled={saving}
      />

      {error ? (
        <p className="text-center text-sm text-red-400">{error}</p>
      ) : null}

      <ContinueButton
        onClick={handleContinue}
        disabled={!canContinue || saving}
        loading={saving}
      />
    </div>
  );
}
