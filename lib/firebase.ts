import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

function trimEnv(value: string | undefined): string | undefined {
  if (value == null) return undefined;
  const t = value.trim().replace(/^["']|["']$/g, "");
  return t.length > 0 ? t : undefined;
}

/** Values baked into the client bundle; trim & strip accidental quotes. */
export function getClientFirebaseConfig() {
  return {
    apiKey: trimEnv(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    authDomain: trimEnv(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
    projectId: trimEnv(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    storageBucket: trimEnv(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: trimEnv(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
    appId: trimEnv(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  };
}

export function isFirebaseConfigured(): boolean {
  const c = getClientFirebaseConfig();
  return Boolean(
    c.apiKey &&
      c.authDomain &&
      c.projectId &&
      c.storageBucket &&
      c.messagingSenderId &&
      c.appId,
  );
}

function getFirebaseApp(): FirebaseApp {
  if (typeof window === "undefined") {
    throw new Error("Firebase client SDK is only available in the browser.");
  }
  if (getApps().length > 0) {
    return getApp();
  }
  const config = getClientFirebaseConfig();
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase env vars are missing. Set NEXT_PUBLIC_FIREBASE_* in .env.local and restart next dev.",
    );
  }
  return initializeApp(config);
}

let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;

function getAuthInstance(): Auth {
  if (!authInstance) {
    authInstance = getAuth(getFirebaseApp());
  }
  return authInstance;
}

function getDbInstance(): Firestore {
  if (!dbInstance) {
    dbInstance = getFirestore(getFirebaseApp());
  }
  return dbInstance;
}

function lazyClient<T extends object>(getInstance: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop, receiver) {
      const instance = getInstance();
      const value = Reflect.get(instance, prop, receiver);
      return typeof value === "function"
        ? (value as (...args: unknown[]) => unknown).bind(instance)
        : value;
    },
  });
}

/** Lazily initialized; only touch from client-side code (e.g. useEffect, handlers). */
export const auth: Auth = lazyClient(getAuthInstance);

/**
 * Real Firestore instance — not a Proxy. `doc()` / `collection()` require a genuine Firestore.
 * Only call from the browser (e.g. useEffect, event handlers).
 */
export function getDb(): Firestore {
  return getDbInstance();
}
