"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HeroClassDef } from "@/lib/heroClasses";

type HeroSliderProps = {
  classes: HeroClassDef[];
  selectedId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
};

const CARD_W = "min(82vw, 17.5rem)";

export function HeroSlider({
  classes,
  selectedId,
  onSelect,
  disabled,
}: HeroSliderProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startScrollLeft: number;
  } | null>(null);
  const onSelectRef = useRef(onSelect);
  const lastReportedRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);

  const [snapEnabled, setSnapEnabled] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  const syncCenteredHero = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    let bestId: string | null = null;
    let bestDist = Infinity;

    for (const el of container.querySelectorAll<HTMLElement>("[data-hero-id]")) {
      const r = el.getBoundingClientRect();
      const cardCenterX = r.left + r.width / 2;
      const d = Math.abs(cardCenterX - centerX);
      if (d < bestDist) {
        bestDist = d;
        bestId = el.dataset.heroId ?? null;
      }
    }

    if (bestId && bestId !== lastReportedRef.current) {
      lastReportedRef.current = bestId;
      onSelectRef.current(bestId);
    }
  }, []);

  const scheduleSync = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      syncCenteredHero();
    });
  }, [syncCenteredHero]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => scheduleSync();
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("scrollend", onScroll);

    const ro = new ResizeObserver(() => scheduleSync());
    ro.observe(el);

    scheduleSync();

    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("scrollend", onScroll);
      ro.disconnect();
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [classes.length, scheduleSync]);

  const endDrag = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      const el = scrollRef.current;
      if (d && d.pointerId === e.pointerId && el?.releasePointerCapture) {
        try {
          if (el.hasPointerCapture(e.pointerId)) {
            el.releasePointerCapture(e.pointerId);
          }
        } catch {
          /* ignore */
        }
      }
      dragRef.current = null;
      setIsDragging(false);
      setSnapEnabled(true);
      scheduleSync();
    },
    [scheduleSync],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.pointerType === "touch") return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    const el = scrollRef.current;
    if (!el) return;

    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startScrollLeft: el.scrollLeft,
    };
    setSnapEnabled(false);
    setIsDragging(true);
    el.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const el = scrollRef.current;
    if (!el) return;
    const dx = e.clientX - d.startX;
    el.scrollLeft = d.startScrollLeft - dx;
    scheduleSync();
  };

  return (
    <div className="w-full">
      <p className="mb-3 text-center text-xs font-medium uppercase tracking-widest text-amber-500/90">
        Choose your hero
      </p>
      <p className="mb-2 text-center text-xs text-zinc-500">
        Drag to switch — the hero in the center is selected.
      </p>
      <div
        ref={scrollRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={[
          "onboarding-scroll flex w-full touch-pan-x gap-4 overflow-x-auto pb-2 pt-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
          isDragging ? "cursor-grabbing select-none" : "cursor-grab",
        ].join(" ")}
        style={{
          scrollSnapType: snapEnabled ? "x mandatory" : "none",
          scrollBehavior: snapEnabled ? "smooth" : "auto",
          paddingLeft: `max(1rem, calc(50% - (${CARD_W}) / 2))`,
          paddingRight: `max(1rem, calc(50% - (${CARD_W}) / 2))`,
        }}
      >
        {classes.map((c) => {
          const selected = c.id === selectedId;
          return (
            <div
              key={c.id}
              data-hero-id={c.id}
              aria-current={selected ? "true" : undefined}
              style={{
                width: CARD_W,
                scrollSnapAlign: "center",
                flex: "0 0 auto",
              }}
              className={[
                "flex flex-col items-center rounded-2xl border-2 bg-zinc-900/80 p-4 text-left transition-all duration-300 ease-out",
                selected
                  ? "scale-[1.06] border-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.35),inset_0_1px_0_rgba(255,255,255,0.06)]"
                  : "scale-100 border-zinc-700/90 opacity-90",
                disabled ? "pointer-events-none opacity-50" : "",
              ].join(" ")}
            >
              <div className="relative mb-3 aspect-square w-full max-w-[9.5rem] overflow-hidden rounded-xl ring-1 ring-zinc-700/80">
                <Image
                  src={c.image}
                  alt={c.name}
                  fill
                  className="pointer-events-none object-cover"
                  sizes="(max-width: 768px) 40vw, 200px"
                  unoptimized
                  draggable={false}
                />
              </div>
              <h3 className="w-full text-center font-serif text-lg font-semibold tracking-tight text-zinc-100">
                {c.name}
              </h3>
              <p className="mt-2 line-clamp-3 text-center text-xs leading-relaxed text-zinc-400">
                {c.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
