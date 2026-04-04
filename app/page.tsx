"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getOrCreateUser, type UserDocument } from "@/lib/getOrCreateUser";
import { TestOnboarding } from "@/components/TestOnboarding";
import { MainMenu } from "@/components/MainMenu";

export default function Home() {
  const { user, loading: authLoading, authError } = useAuth();
  const [userDoc, setUserDoc] = useState<UserDocument | null>(null);
  const [userDocLoading, setUserDocLoading] = useState(true);

  const refreshUserDoc = useCallback(async () => {
    if (!user) {
      setUserDoc(null);
      setUserDocLoading(false);
      return;
    }
    setUserDocLoading(true);
    try {
      const data = await getOrCreateUser(user.uid);
      setUserDoc(data);
    } catch (e) {
      console.error("Failed to load user document:", e);
      setUserDoc(null);
    } finally {
      setUserDocLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void refreshUserDoc();
  }, [authLoading, refreshUserDoc]);

  if (authError) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center p-8">
        <div className="max-w-md rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">Firebase setup</p>
          <p className="mt-2 leading-relaxed">{authError}</p>
        </div>
      </div>
    );
  }

  if (authLoading || userDocLoading) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center p-8">
        <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!user || !userDoc) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center p-8">
        <p className="text-zinc-600 dark:text-zinc-400">
          Could not load your profile. Check Firebase config and try again.
        </p>
      </div>
    );
  }

  if (userDoc.username == null) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center bg-zinc-950 py-8">
        <TestOnboarding uid={user.uid} onSaved={refreshUserDoc} />
      </div>
    );
  }

  return (
    <MainMenu
      username={userDoc.username}
      gold={userDoc.gold}
      energy={userDoc.energy}
      combatTotals={userDoc.effectiveStats}
    />
  );
}
