/** Full-body portraits for the inventory screen (`public/images/`). */
const INVENTORY_PORTRAIT_BY_CLASS: Record<string, string> = {
  warrior: "/images/inventory-warrior.png",
  mage: "/images/inventory-mage.png",
  ranger: "/images/inventory-ranger.png",
  paladin: "/images/inventory-paladin.png",
};

/**
 * Portrait image path for `user.class` (same ids as onboarding / HERO_CLASSES).
 * Falls back to generic hero art when class is missing or unknown.
 */
export function getInventoryPortraitPath(
  classId: string | null | undefined,
): string {
  if (!classId) return "/images/inventory-hero.png";
  return INVENTORY_PORTRAIT_BY_CLASS[classId] ?? "/images/inventory-hero.png";
}
