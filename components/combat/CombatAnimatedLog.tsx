"use client";

import { motion } from "framer-motion";
import { forwardRef } from "react";
import type { CombatLogLine } from "@/lib/combatLog";

type CombatAnimatedLogProps = {
  entries: CombatLogLine[];
  className?: string;
  itemClassName?: string;
};

export const CombatAnimatedLog = forwardRef<
  HTMLUListElement,
  CombatAnimatedLogProps
>(function CombatAnimatedLog(
  {
    entries,
    className = "max-h-56 overflow-y-auto rounded-lg border border-zinc-800 bg-black/40 p-3 text-sm text-zinc-300",
    itemClassName = "border-b border-zinc-800/80 py-1.5 last:border-0",
  },
  ref,
) {
  return (
    <ul ref={ref} className={className}>
      {entries.map((e) => (
        <motion.li
          key={e.id}
          layout={false}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className={itemClassName}
        >
          {e.text}
        </motion.li>
      ))}
    </ul>
  );
});
