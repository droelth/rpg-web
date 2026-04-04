import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import {
  generateInstanceId,
  inventoryToFirestore,
  parseInventory,
} from "@/lib/items";
import { getDb } from "@/lib/firebase";
import {
  generateShop,
  MANUAL_REFRESH_COST,
  parseShop,
  serializeShopOffers,
  type ShopOffer,
} from "@/lib/shopSystem";

export class ShopGoldError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShopGoldError";
  }
}

export class ShopOfferError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShopOfferError";
  }
}

/** Paid refresh: −50 gold, new offers, new lastRefresh. */
export async function transactionManualRefreshShop(
  uid: string,
  classId: string | null,
): Promise<void> {
  const db = getDb();
  const ref = doc(db, "users", uid);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new ShopOfferError("User not found");
    const data = snap.data() as Record<string, unknown>;
    const gold = typeof data.gold === "number" ? data.gold : 0;
    if (gold < MANUAL_REFRESH_COST) {
      throw new ShopGoldError("Not enough gold");
    }
    const offers = generateShop(classId);
    transaction.update(ref, {
      gold: Math.max(0, gold - MANUAL_REFRESH_COST),
      shop: {
        items: serializeShopOffers(offers),
        lastRefresh: serverTimestamp(),
      },
    });
  });
}

/** Buy one slot: −price, inventory + id, mark sold. */
export async function transactionPurchaseShopSlot(
  uid: string,
  slotIndex: number,
): Promise<void> {
  const db = getDb();
  const ref = doc(db, "users", uid);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new ShopOfferError("User not found");
    const data = snap.data() as Record<string, unknown>;
    const gold = typeof data.gold === "number" ? data.gold : 0;
    const shop = parseShop(data.shop);
    const offer = shop.items[slotIndex];
    if (!offer) throw new ShopOfferError("Invalid slot");
    if (offer.sold) throw new ShopOfferError("Already sold");
    if (gold < offer.price) throw new ShopGoldError("Not enough gold");

    const inv = parseInventory(data.inventory);
    const nextInv = [
      ...inv,
      {
        instanceId: generateInstanceId(),
        itemId: offer.id,
        rarity: offer.rarity,
      },
    ];

    const nextOffers: ShopOffer[] = shop.items.map((o, i) =>
      i === slotIndex ? { ...o, sold: true } : o,
    );

    const shopRaw = data.shop as Record<string, unknown> | undefined;
    const lastRefresh =
      shopRaw && shopRaw.lastRefresh != null
        ? shopRaw.lastRefresh
        : serverTimestamp();

    transaction.update(ref, {
      gold: Math.max(0, gold - offer.price),
      inventory: inventoryToFirestore(nextInv),
      shop: {
        items: serializeShopOffers(nextOffers),
        lastRefresh,
      },
    });
  });
}
