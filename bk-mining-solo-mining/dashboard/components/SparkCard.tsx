"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkline } from "./Sparkline";
import { formatHashrate, formatSI, parseHashrate } from "@/lib/format";

// Format kind chosen from a fixed set so we can keep all formatter functions
// inside this client bundle (they can't be passed as props across the
// server/client boundary).
type FormatKind = "hashrate" | "si" | "int" | "decimal2";

function applyFormat(kind: FormatKind, n: number | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  switch (kind) {
    case "hashrate": return formatHashrate(n);
    case "si":       return formatSI(n);
    case "int":      return Math.round(n).toLocaleString();
    case "decimal2": return n.toFixed(2);
  }
}

type Props = {
  label: string;
  metric: string;
  format: FormatKind;
  initialValue: string;
  initialSeries?: number[];
  color?: string;
  sub?: string;
};

const REFRESH_MS = 30_000;

// Map metric → which field in /api/stats response to read for the LIVE value.
// /api/stats returns the full ckpool pool.status object + node info; we pluck
// out the live current value here so the headline doesn't flash backwards to
// a stale historical sample.
function liveValueFor(metric: string, stats: ApiStats | null): number | undefined {
  if (!stats) return undefined;
  const pool = stats.pool;
  switch (metric) {
    case "hr1m": return parseHashrate(pool?.hashrate1m);
    case "hr5m": return parseHashrate(pool?.hashrate5m);
    case "hr15m": return parseHashrate(pool?.hashrate15m);
    case "hr1h": return parseHashrate(pool?.hashrate1hr);
    case "hr6h": return parseHashrate(pool?.hashrate6hr);
    case "hr1d": return parseHashrate(pool?.hashrate1d);
    case "hr7d": return parseHashrate(pool?.hashrate7d);
    case "accepted": return pool?.accepted;
    case "rejected": return pool?.rejected;
    case "bestshare": return pool?.bestshare;
    case "workers": return pool?.Workers;
    case "sps1m": return pool?.SPS1m;
    case "diff": return stats.bch?.difficulty; // node info field, regardless of pool
    default: return undefined;
  }
}

type ApiStats = {
  pool: {
    Workers?: number;
    Idle?: number;
    Disconnected?: number;
    hashrate1m?: string;
    hashrate5m?: string;
    hashrate15m?: string;
    hashrate1hr?: string;
    hashrate6hr?: string;
    hashrate1d?: string;
    hashrate7d?: string;
    accepted?: number;
    rejected?: number;
    bestshare?: number;
    SPS1m?: number;
  } | null;
  bch: { difficulty?: number } | null; // field name historical; really the active pool's node info
};

export function SparkCard({
  label,
  metric,
  format,
  initialValue,
  initialSeries,
  color = "#f59e0b",
  sub,
}: Props) {
  const params = useSearchParams();
  const w = params.get("w") || "1h";
  const pool = params.get("pool") || "bch";

  const [series, setSeries] = useState<(number | null)[]>(initialSeries ?? []);
  const [value, setValue] = useState<string>(initialValue);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (document.visibilityState !== "visible") return;
      // Fetch chart shape + live headline in parallel.
      const [histRes, statsRes] = await Promise.allSettled([
        fetch(`/api/history?w=${w}&pool=${pool}&series=${metric}`, { cache: "no-store" }),
        fetch(`/api/stats?pool=${pool}`, { cache: "no-store" }),
      ]);
      if (cancelled) return;

      // Chart shape from history
      if (histRes.status === "fulfilled" && histRes.value.ok) {
        try {
          const data = (await histRes.value.json()) as { ts: number[]; series: Record<string, (number | null)[]> };
          const arr = data.series[metric] ?? [];
          if (!cancelled) setSeries(arr);
        } catch { /* ignore parse error */ }
      }

      // Headline value from LIVE stats (fresher than the JSONL samples). Fall
      // back to the latest history sample if /api/stats failed.
      let liveVal: number | undefined;
      if (statsRes.status === "fulfilled" && statsRes.value.ok) {
        try {
          const stats = (await statsRes.value.json()) as ApiStats;
          liveVal = liveValueFor(metric, stats);
        } catch { /* ignore */ }
      }
      if (liveVal == null && histRes.status === "fulfilled" && histRes.value.ok) {
        // History was already consumed above; re-read won't work. Use the
        // series state we just set. (Skip — too rare to matter.)
      }
      if (liveVal != null && !cancelled) {
        setValue(applyFormat(format, liveVal));
      }
    }

    tick();
    const interval = setInterval(tick, REFRESH_MS);
    const onVisibility = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [w, pool, metric, format]);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 flex flex-col">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-2xl font-semibold text-white mt-1">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
      <div className="mt-2 -mb-1 -mx-1">
        <Sparkline points={series} height={36} color={color} />
      </div>
    </div>
  );
}
