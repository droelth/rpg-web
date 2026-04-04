import type { Item, ItemRarity } from "@/types/item";
import { formatItemStatHint, slotTypeGlyph } from "@/lib/itemDisplay";
import { getItemRarity, itemCardClassNames } from "@/lib/itemRarityStyles";

export type ItemCardProps = {
  item: Item;
  /** Shop / UI override; defaults to catalog `item.rarity`. */
  displayRarity?: ItemRarity;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  /** Inventory grid vs equipped slot strip. */
  size?: "md" | "sm";
  layout?: "stack" | "row";
  className?: string;
};

export function ItemCard({
  item,
  displayRarity,
  selected = false,
  disabled = false,
  onClick,
  size = "md",
  layout = "stack",
  className = "",
}: ItemCardProps) {
  const rarity = displayRarity ?? getItemRarity(item);
  const statHintInstance =
    displayRarity !== undefined ? { rarity: displayRarity } : undefined;
  const interactive = Boolean(onClick) && !disabled;
  const cardClass = itemCardClassNames(rarity, { selected, interactive });

  const isRow = layout === "row";
  const isSm = size === "sm";

  const iconBox = isRow
    ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-black/45 text-xl ring-1 ring-white/8"
    : [
        "flex w-full shrink-0 items-center justify-center rounded-lg bg-black/40 ring-1 ring-white/5",
        isSm ? "h-10 text-2xl" : "aspect-square max-h-[76px] text-3xl",
      ].join(" ");

  const nameCls = isRow
    ? "truncate text-sm font-semibold text-zinc-100"
    : isSm
      ? "line-clamp-1 text-[10px] font-medium text-zinc-200"
      : "line-clamp-2 text-xs font-semibold text-zinc-100";

  const hintCls = isRow
    ? "truncate text-[11px] text-zinc-500"
    : isSm
      ? "mt-0.5 text-[9px] text-zinc-500"
      : "mt-1 text-[10px] text-zinc-500";

  const rootLayout = isRow
    ? "min-h-0 flex-row items-center gap-3 px-3 py-2.5"
    : isSm
      ? "min-h-[100px] max-w-[140px] flex-col p-2"
      : "min-h-[132px] max-w-[168px] flex-col p-3";

  return (
    <button
      type="button"
      disabled={disabled || !onClick}
      onClick={onClick}
      className={[
        "group relative flex w-full text-left",
        isRow ? "flex-row" : "flex-col",
        rootLayout,
        cardClass,
        disabled ? "cursor-not-allowed opacity-45" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={iconBox} aria-hidden>
        <span className="select-none opacity-90 drop-shadow-[0_0_8px_rgba(255,255,255,0.12)]">
          {slotTypeGlyph(item.type)}
        </span>
      </div>
      {isRow ? (
        <div className="min-w-0 flex-1 text-left">
          <p className={nameCls}>{item.name}</p>
          <p className={hintCls}>
            {formatItemStatHint(item, statHintInstance)}
          </p>
        </div>
      ) : (
        <div className="mt-auto w-full min-w-0">
          <p className={nameCls}>{item.name}</p>
          <p className={hintCls}>
            {formatItemStatHint(item, statHintInstance)}
          </p>
        </div>
      )}
    </button>
  );
}

type EmptyEquipSlotProps = {
  slotLabel: string;
  disabled?: boolean;
  onClick?: () => void;
};

/** Empty equipped slot — dashed frame, matches row `ItemCard` height. */
export function EmptyEquipSlot({
  slotLabel,
  disabled = false,
  onClick,
}: EmptyEquipSlotProps) {
  return (
    <button
      type="button"
      disabled={disabled || !onClick}
      onClick={onClick}
      className={[
        "flex w-full min-w-0 items-center gap-3 rounded-xl border-2 border-dashed border-zinc-700/70",
        "bg-gradient-to-r from-zinc-950/80 to-black/60 px-3 py-2.5 text-left",
        "backdrop-blur-md transition hover:border-zinc-600 hover:bg-zinc-900/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50",
        disabled ? "cursor-not-allowed opacity-50" : "",
      ].join(" ")}
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-black/35 text-lg text-zinc-600 ring-1 ring-white/5"
        aria-hidden
      >
        —
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
          {slotLabel}
        </p>
        <p className="truncate text-sm text-zinc-500">Empty slot</p>
      </div>
    </button>
  );
}
