"use client";

import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInAnonymously,
  type User,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";

function firebaseErrorMessage(code: string | undefined): string {
  if (code === "auth/invalid-api-key") {
    return "Invalid Firebase API key. In Firebase Console → Project settings → Your apps, copy the Web API key into NEXT_PUBLIC_FIREBASE_API_KEY (no quotes). Restart next dev after editing .env.local.";
  }
  return "Firebase authentication failed. Check console and Firebase Console (Anonymous sign-in enabled).";
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!isFirebaseConfigured()) {
      setAuthError(
        "Firebase is not configured. Copy .env.example to .env.local, fill all NEXT_PUBLIC_FIREBASE_* values, then restart the dev server (next dev).",
      );
      setUser(null);
      setLoading(false);
      return;
    }

    let unsub: (() => void) | undefined;

    try {
      unsub = onAuthStateChanged(auth, async (firebaseUser) => {
        if (cancelled) return;

        if (firebaseUser) {
          setAuthError(null);
          setUser(firebaseUser);
          setLoading(false);
          return;
        }

        setLoading(true);
        try {
          await signInAnonymously(auth);
        } catch (e: unknown) {
          const err = e as { code?: string; message?: string };
          console.error("Anonymous sign-in failed:", e);
          if (!cancelled) {
            setAuthError(firebaseErrorMessage(err.code));
            setUser(null);
            setLoading(false);
          }
        }
      });
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      console.error("Firebase Auth setup failed:", e);
      if (!cancelled) {
        setAuthError(
          err.code
            ? firebaseErrorMessage(err.code)
            : err.message ?? "Could not start Firebase Auth.",
        );
        setUser(null);
        setLoading(false);
      }
    }

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  return { user, loading, authError };
}
