"use client";

import { motion } from "framer-motion";

type AnimatedHpBarProps = {
  fraction: number;
  colorClass: string;
  className?: string;
};

export function AnimatedHpBar({
  fraction,
  colorClass,
  className = "mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-800",
}: AnimatedHpBarProps) {
  const pct = Math.max(0, Math.min(100, fraction * 100));
  return (
    <div className={className}>
      <motion.div
        className={`h-full rounded-full ${colorClass}`}
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
      />
    </div>
  );
}
