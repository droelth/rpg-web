"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  fetchLeaderboardTop,
  LEADERBOARD_LIMIT,
  winRatePercent,
  type LeaderboardEntry,
} from "@/lib/leaderboardFirestore";
import { useAuth } from "@/hooks/useAuth";

function rankRowClass(rank: number, isSelf: boolean): string {
  const base =
    "border-b border-zinc-800/90 transition-colors hover:bg-zinc-800/40";
  if (isSelf) {
    return `${base} bg-violet-950/35 ring-1 ring-inset ring-violet-500/45`;
  }
  if (rank === 1) {
    return `${base} bg-amber-500/10 shadow-[inset_0_0_24px_rgba(251,191,36,0.12)]`;
  }
  if (rank === 2) {
    return `${base} bg-zinc-400/10 shadow-[inset_0_0_20px_rgba(161,161,170,0.1)]`;
  }
  if (rank === 3) {
    return `${base} bg-orange-700/15 shadow-[inset_0_0_18px_rgba(194,65,12,0.12)]`;
  }
  return base;
}

export function LeaderboardView() {
  const router = useRouter();
  const { user, loading: authLoading, authError } = useAuth();
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchLeaderboardTop(LEADERBOARD_LIMIT);
      setRows(data);
    } catch (e) {
      console.error(e);
      setLoadError("Could not load leaderboard. Check rules and connection.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load]);

  if (authError) {
    return (
      <div className="p-6 text-center text-red-400">
        <p>{authError}</p>
        <Link href="/" className="mt-4 inline-block text-amber-400 underline">
          Home
        </Link>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-3xl flex-col bg-zinc-950 text-zinc-100">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.12),_transparent_55%)]"
        aria-hidden
      />

      <header className="sticky top-0 z-10 border-b border-zinc-800/80 bg-zinc-950/90 px-4 py-4 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="shrink-0 text-sm text-amber-500/90 hover:text-amber-400"
          >
            ← Menu
          </Link>
          <h1 className="text-center text-lg font-semibold tracking-tight text-amber-100">
            PvP Leaderboard
          </h1>
          <span className="w-14 shrink-0" aria-hidden />
        </div>
        <p className="mt-1 text-center text-xs text-zinc-500">
          Top {LEADERBOARD_LIMIT} by rank points · select a row to view profile
        </p>
      </header>

      <div className="relative z-10 flex-1 px-3 pb-10 pt-4 sm:px-4">
        {authLoading || loading ? (
          <p className="py-12 text-center text-zinc-500">Loading…</p>
        ) : loadError ? (
          <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-center text-sm text-red-300">
            {loadError}
            <button
              type="button"
              onClick={() => void load()}
              className="mt-3 block w-full rounded-lg border border-zinc-600 py-2 text-zinc-200 hover:bg-zinc-800"
            >
              Retry
            </button>
          </div>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-zinc-500">
            No adventurers on the board yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/40 shadow-lg shadow-black/40">
            <table className="w-full min-w-[520px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-700 bg-black/30 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="px-3 py-3 pl-4 sm:px-4">#</th>
                  <th className="px-3 py-3 sm:px-4">Username</th>
                  <th className="px-3 py-3 text-right sm:px-4">RP</th>
                  <th className="px-3 py-3 text-right sm:px-4">Win %</th>
                  <th className="px-3 py-3 text-right sm:px-4">W</th>
                  <th className="px-3 py-3 pr-4 text-right sm:px-4">L</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const rank = i + 1;
                  const isSelf = user?.uid === row.id;
                  const wr = winRatePercent(row.wins, row.losses);
                  return (
                    <tr
                      key={row.id}
                      role="link"
                      tabIndex={0}
                      aria-label={`View ${row.username} profile`}
                      className={`${rankRowClass(rank, Boolean(isSelf))} cursor-pointer`}
                      onClick={() => router.push(`/profile/${row.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(`/profile/${row.id}`);
                        }
                      }}
                    >
                      <td className="px-3 py-2.5 pl-4 font-mono tabular-nums text-zinc-400 sm:px-4">
                        <span
                          className={
                            rank <= 3
                              ? "font-bold text-amber-200/95"
                              : undefined
                          }
                        >
                          {rank}
                        </span>
                      </td>
                      <td className="max-w-[140px] truncate px-3 py-2.5 font-medium text-zinc-100 sm:max-w-none sm:px-4">
                        {row.username}
                        {isSelf ? (
                          <span className="ml-2 text-[10px] font-normal uppercase tracking-wide text-violet-400">
                            You
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-amber-200/90 sm:px-4">
                        {row.rankPoints}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-zinc-300 sm:px-4">
                        {wr == null ? "—" : `${wr}%`}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-emerald-400/90 sm:px-4">
                        {row.wins}
                      </td>
                      <td className="px-3 py-2.5 pr-4 text-right font-mono tabular-nums text-rose-400/85 sm:px-4">
                        {row.losses}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
