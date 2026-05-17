"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatAgo } from "@/lib/format";

type Props = {
  pool: string;
  height: number;
  hash: string;
  ts: number;
  totalSolved: number;
};

// Persisted dismissal — once you click X on a specific block, it stays
// dismissed across refreshes (keyed by pool+height+hash). A future block
// triggers a new banner because the key changes.
function dismissKey(pool: string, height: number, hash: string): string {
  return `bk-mining:dismissed-block:${pool}:${height}:${hash}`;
}

export function BlockSolvedBanner({ pool, height, hash, ts, totalSolved }: Props) {
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid SSR flash; reveal after mount check

  useEffect(() => {
    try {
      const k = dismissKey(pool, height, hash);
      setDismissed(localStorage.getItem(k) === "1");
    } catch {
      setDismissed(false);
    }
  }, [pool, height, hash]);

  function onDismiss(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try { localStorage.setItem(dismissKey(pool, height, hash), "1"); } catch { /* ignore */ }
    setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <Link
      href={`/blocks?pool=${pool}`}
      className="block relative rounded-md border border-amber-500/60 bg-gradient-to-r from-amber-500/15 to-amber-500/5 px-4 py-3 hover:border-amber-400 transition-colors"
    >
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute top-2 right-2 w-6 h-6 rounded-md text-amber-400/60 hover:text-amber-200 hover:bg-amber-500/10 leading-none text-sm flex items-center justify-center"
      >
        ✕
      </button>
      <div className="flex items-center justify-between gap-3 flex-wrap pr-8">
        <div>
          <div className="text-amber-300 font-semibold">
            🎉 Block solved! #{height.toLocaleString()}
            {totalSolved > 1 && (
              <span className="text-amber-400/80 text-sm font-normal ml-2">
                ({totalSolved} total)
              </span>
            )}
          </div>
          <div className="text-xs text-amber-200/70 mt-0.5 font-mono">
            {hash.slice(0, 32)}… · {formatAgo(ts)}
          </div>
        </div>
        <span className="text-xs text-amber-400">View all →</span>
      </div>
    </Link>
  );
}
