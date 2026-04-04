"use client";

import { motion, useAnimation } from "framer-motion";
import Image from "next/image";
import { useEffect } from "react";
import type { CombatAnimationCue, CombatTurn } from "@/lib/combat";

type AnimatedCombatPortraitProps = {
  src: string;
  alt: string;
  className?: string;
  layoutSide: "left" | "right";
  role: CombatTurn;
  strikeSeq: number;
  lastCue: CombatAnimationCue | null;
};

export function AnimatedCombatPortrait({
  src,
  alt,
  className = "relative aspect-[3/4] w-full max-h-44 overflow-hidden rounded-xl border border-white/15 bg-black/50 shadow-inner shadow-black/40",
  layoutSide,
  role,
  strikeSeq,
  lastCue,
}: AnimatedCombatPortraitProps) {
  const bodyCtrl = useAnimation();
  const flashCtrl = useAnimation();

  useEffect(() => {
    if (strikeSeq === 0 || !lastCue) return;

    const isAttacker = lastCue.attacker === role;

    if (isAttacker) {
      void flashCtrl.set({ opacity: 0 });
      void bodyCtrl.start({
        x: layoutSide === "left" ? [0, 14, 0] : [0, -14, 0],
        transition: { duration: 0.2, ease: "easeOut", times: [0, 0.55, 1] },
      });
    } else {
      void bodyCtrl.start({
        x: [0, -6, 6, -4, 4, 0],
        transition: { duration: 0.35, ease: "easeInOut" },
      });
      void flashCtrl.start({
        opacity: [0, 0.45, 0],
        transition: { duration: 0.35, ease: "easeOut" },
      });
    }
  }, [strikeSeq, lastCue, role, layoutSide, bodyCtrl, flashCtrl]);

  const showCritFx =
    Boolean(lastCue?.isCrit && lastCue.attacker !== role && strikeSeq > 0);

  return (
    <motion.div
      className={className}
      animate={{ scale: [1, 1.03, 1] }}
      transition={{
        repeat: Infinity,
        duration: 2,
        ease: "easeInOut",
      }}
    >
      <motion.div
        className="relative h-full w-full"
        initial={{ x: 0 }}
        animate={bodyCtrl}
      >
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover object-top"
          sizes="(max-width: 640px) 45vw, 200px"
          priority={false}
        />
        <motion.div
          className="pointer-events-none absolute inset-0 bg-red-600 mix-blend-overlay"
          initial={{ opacity: 0 }}
          animate={flashCtrl}
        />
        {showCritFx ? (
          <motion.div
            key={strikeSeq}
            className="pointer-events-none absolute inset-0 rounded-[10px] ring-2 ring-amber-400/90"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 1, 0.75, 0],
              boxShadow: [
                "0 0 0 0 rgba(251,191,36,0)",
                "0 0 28px 4px rgba(251,191,36,0.55)",
                "0 0 20px 2px rgba(251,191,36,0.4)",
                "0 0 0 0 rgba(251,191,36,0)",
              ],
            }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        ) : null}
        {showCritFx ? (
          <motion.span
            key={`crit-label-${strikeSeq}`}
            className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded bg-gradient-to-b from-amber-300 to-amber-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-950 shadow-md"
            initial={{ opacity: 0, y: 10, scale: 0.85 }}
            animate={{
              opacity: [0, 1, 1, 0],
              y: [10, 0, 0, -4],
              scale: [0.85, 1.15, 1.08, 1],
            }}
            transition={{
              duration: 0.55,
              times: [0, 0.12, 0.5, 1],
              ease: "easeOut",
            }}
          >
            CRITICAL
          </motion.span>
        ) : null}
      </motion.div>
    </motion.div>
  );
}
