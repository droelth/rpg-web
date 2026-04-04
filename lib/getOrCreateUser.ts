import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { getDb } from "./firebase";

export const INITIAL_USER_GOLD = 100;
export const INITIAL_USER_ENERGY = 20;

export type UserDocument = {
  username: string | null;
  class: string | null;
  stats: unknown | null;
  gold: number;
  energy: number;
  createdAt: Timestamp | null;
};

function readGoldEnergy(data: Record<string, unknown> | undefined) {
  const gold = data?.gold;
  const energy = data?.energy;
  return {
    gold: typeof gold === "number" ? gold : INITIAL_USER_GOLD,
    energy: typeof energy === "number" ? energy : INITIAL_USER_ENERGY,
  };
}

export async function getOrCreateUser(uid: string): Promise<UserDocument> {
  const ref = doc(getDb(), "users", uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data();
    const { gold, energy } = readGoldEnergy(data);
    return {
      username: data.username ?? null,
      class: data.class ?? null,
      stats: data.stats ?? null,
      gold,
      energy,
      createdAt: data.createdAt ?? null,
    };
  }

  const newUser: Omit<UserDocument, "createdAt"> & {
    createdAt: ReturnType<typeof serverTimestamp>;
  } = {
    username: null,
    class: null,
    stats: null,
    gold: INITIAL_USER_GOLD,
    energy: INITIAL_USER_ENERGY,
    createdAt: serverTimestamp(),
  };

  await setDoc(ref, newUser);

  const created = await getDoc(ref);
  const data = created.data();
  const { gold, energy } = readGoldEnergy(data);
  return {
    username: data?.username ?? null,
    class: data?.class ?? null,
    stats: data?.stats ?? null,
    gold,
    energy,
    createdAt: data?.createdAt ?? null,
  };
}
