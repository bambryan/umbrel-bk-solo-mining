"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkline } from "./Sparkline";
import { formatHashrate, formatSI } from "@/lib/format";

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

const SERIES_REFRESH_MS = 30_000;

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
      try {
        const res = await fetch(`/api/history?w=${w}&pool=${pool}&series=${metric}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { ts: number[]; series: Record<string, (number | null)[]> };
        const arr = data.series[metric] ?? [];
        if (cancelled) return;
        setSeries(arr);
        for (let i = arr.length - 1; i >= 0; i--) {
          const v = arr[i];
          if (typeof v === "number") {
            setValue(applyFormat(format, v));
            break;
          }
        }
      } catch { /* ignore */ }
    }

    tick();
    const interval = setInterval(tick, SERIES_REFRESH_MS);
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
