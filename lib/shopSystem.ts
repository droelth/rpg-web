import type { Timestamp } from "firebase/firestore";
import type { ItemRarity } from "@/types/item";
import { SLOT_ORDER } from "@/types/item";
import {
  allCatalogItems,
  groupItemsByType,
  itemsForClass,
  resolveItem,
} from "@/lib/items";

export const REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000;
export const MANUAL_REFRESH_COST = 110;

const RARITY_ORDER: ItemRarity[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
];

/** Cumulative thresholds out of 1.0: 50%, 25%, 15%, 8%, 2% */
const RARITY_THRESHOLDS = [0.5, 0.75, 0.9, 0.98, 1.0];

const PRICE_BY_RARITY: Record<ItemRarity, number> = {
  common: 100,
  uncommon: 200,
  rare: 420,
  epic: 850,
  legendary: 1700,
};

export type ShopOffer = {
  id: string;
  rarity: ItemRarity;
  price: number;
  sold?: boolean;
};

export type ParsedShop = {
  items: ShopOffer[];
  lastRefresh: Timestamp | null;
};

function pickRandom<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

export function rollRarity(): ItemRarity {
  const r = Math.random();
  for (let i = 0; i < RARITY_THRESHOLDS.length; i++) {
    if (r < RARITY_THRESHOLDS[i]) {
      return RARITY_ORDER[i]!;
    }
  }
  return "legendary";
}

export function priceForRarity(rarity: ItemRarity): number {
  return PRICE_BY_RARITY[rarity];
}

function isValidRarity(v: unknown): v is ItemRarity {
  return (
    typeof v === "string" &&
    (RARITY_ORDER as readonly string[]).includes(v)
  );
}

export function parseShop(raw: unknown): ParsedShop {
  if (!raw || typeof raw !== "object") {
    return { items: [], lastRefresh: null };
  }
  const o = raw as Record<string, unknown>;
  const itemsOut: ShopOffer[] = [];
  const itemsRaw = o.items;
  if (Array.isArray(itemsRaw)) {
    for (const el of itemsRaw) {
      if (!el || typeof el !== "object") continue;
      const e = el as Record<string, unknown>;
      if (typeof e.id !== "string") continue;
      const rarity = isValidRarity(e.rarity) ? e.rarity : "common";
      const price =
        typeof e.price === "number" && Number.isFinite(e.price) && e.price >= 0
          ? Math.floor(e.price)
          : priceForRarity(rarity);
      itemsOut.push({
        id: e.id,
        rarity,
        price,
        sold: Boolean(e.sold),
      });
    }
  }
  const lr = o.lastRefresh;
  let lastRefresh: Timestamp | null = null;
  if (
    lr &&
    typeof lr === "object" &&
    "toMillis" in lr &&
    typeof (lr as Timestamp).toMillis === "function"
  ) {
    lastRefresh = lr as Timestamp;
  }
  return { items: itemsOut, lastRefresh };
}

export function isShopStale(lastRefresh: Timestamp | null): boolean {
  if (!lastRefresh) return true;
  try {
    return Date.now() - lastRefresh.toMillis() >= REFRESH_INTERVAL_MS;
  } catch {
    return true;
  }
}

/** Plain objects safe for Firestore `updateDoc`. */
export function serializeShopOffers(offers: ShopOffer[]): Record<string, unknown>[] {
  return offers.map((o) => ({
    id: o.id,
    rarity: o.rarity,
    price: o.price,
    ...(o.sold ? { sold: true } : {}),
  }));
}

/**
 * Build 4 shop slots (weapon, armor, helmet, ring) for the given class.
 */
export function generateShop(classId: string | null): ShopOffer[] {
  const pool = itemsForClass(classId);
  const byType = groupItemsByType(pool);
  const fallback = groupItemsByType(allCatalogItems());
  const offers: ShopOffer[] = [];

  for (const slot of SLOT_ORDER) {
    let candidates = byType[slot];
    if (candidates.length === 0) {
      candidates = fallback[slot];
    }
    const item = pickRandom(candidates);
    if (!item) continue;
    const rarity = rollRarity();
    offers.push({
      id: item.id,
      rarity,
      price: priceForRarity(rarity),
      sold: false,
    });
  }

  return offers;
}

export function shopNeedsRegeneration(parsed: ParsedShop): boolean {
  if (parsed.items.length !== SLOT_ORDER.length) return true;
  for (let i = 0; i < parsed.items.length; i++) {
    const offer = parsed.items[i];
    const it = offer ? resolveItem(offer.id) : undefined;
    if (!offer || !it) return true;
    if (it.type !== SLOT_ORDER[i]) return true;
  }
  return false;
}

/** Milliseconds until next free refresh, or 0 if stale now. */
export function msUntilShopRefresh(lastRefresh: Timestamp | null): number {
  if (!lastRefresh) return 0;
  try {
    const next = lastRefresh.toMillis() + REFRESH_INTERVAL_MS;
    return Math.max(0, next - Date.now());
  } catch {
    return 0;
  }
}

export function formatRefreshCountdown(ms: number): string {
  if (ms <= 0) return "Soon";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}
