import {
  type DocumentReference,
  doc,
  getDoc,
} from "firebase/firestore";
import { getDb } from "./firebase";

/** Maps Firebase Auth UID → `users` document id (username slug or legacy uid). */
export const USER_AUTH_INDEX_COLLECTION = "userAuthIndex";

const MAX_PROFILE_DOC_ID_LEN = 700;

/**
 * Firestore-safe document id from display name (lowercase, underscores).
 * Update security rules: allow write when `request.resource.data.authUid == request.auth.uid`.
 */
export function slugifyUsernameForProfileDocId(username: string): string {
  const s = username
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  const base = s || "adventurer";
  return base.slice(0, MAX_PROFILE_DOC_ID_LEN);
}

export function userAuthIndexDocRef(authUid: string): DocumentReference {
  return doc(getDb(), USER_AUTH_INDEX_COLLECTION, authUid);
}

/**
 * Picks `users/{id}` for a new profile: prefers slug from username; resolves collisions.
 * If a doc exists with the same `authUid`, reuses that id (idempotent save).
 */
export async function allocateProfileDocIdForUsername(
  authUid: string,
  displayUsername: string,
): Promise<string> {
  const db = getDb();
  let base = slugifyUsernameForProfileDocId(displayUsername);
  if (!base) base = "adventurer";

  for (let n = 0; n < 120; n++) {
    const candidate =
      n === 0
        ? base
        : `${base}_${n + 1}`.slice(0, MAX_PROFILE_DOC_ID_LEN);
    const snap = await getDoc(doc(db, "users", candidate));
    if (!snap.exists()) return candidate;
    const owner = snap.data()?.authUid;
    if (typeof owner === "string" && owner === authUid) return candidate;
  }
  return `${base.slice(0, 32)}_${Date.now()}`.slice(0, MAX_PROFILE_DOC_ID_LEN);
}

/**
 * Resolves the `users` collection document id for this login.
 * - New flow: `userAuthIndex/{authUid}.profileId` → slug.
 * - Legacy: document at `users/{authUid}` with no index.
 * - No profile yet: `null`.
 */
export async function resolveProfileDocumentId(
  authUid: string,
): Promise<string | null> {
  const db = getDb();
  const idxSnap = await getDoc(doc(db, USER_AUTH_INDEX_COLLECTION, authUid));
  if (idxSnap.exists()) {
    const pid = idxSnap.data()?.profileId;
    if (typeof pid === "string" && pid.length > 0) return pid;
  }
  const legacySnap = await getDoc(doc(db, "users", authUid));
  if (legacySnap.exists()) return authUid;
  return null;
}

/**
 * Ref for read/write. If the user has no profile yet, points to `users/{authUid}`
 * so {@link getOrCreateUser} can still create a legacy placeholder when needed.
 */
export async function getUserProfileDocRef(
  authUid: string,
): Promise<DocumentReference> {
  const id = await resolveProfileDocumentId(authUid);
  return doc(getDb(), "users", id ?? authUid);
}
