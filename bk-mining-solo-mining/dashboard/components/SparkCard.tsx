"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkline } from "./Sparkline";

type Props = {
  label: string;
  // Render the headline value from a raw number (or pass a pre-formatted
  // string via `staticValue`). We accept both because some cards display
  // counts (raw) and others display strings like "131 TH/s".
  metric: string; // history series key (e.g. "hr1m", "accepted", "diff")
  format: (n: number | undefined) => string;
  initialValue: string;
  initialSeries?: number[]; // optional SSR-seeded history
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

  const [series, setSeries] = useState<(number | null)[]>(initialSeries ?? []);
  const [value, setValue] = useState<string>(initialValue);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/history?w=${w}&series=${metric}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { ts: number[]; series: Record<string, (number | null)[]> };
        const arr = data.series[metric] ?? [];
        if (cancelled) return;
        setSeries(arr);
        // Headline value = the most recent non-null sample.
        for (let i = arr.length - 1; i >= 0; i--) {
          const v = arr[i];
          if (typeof v === "number") {
            setValue(format(v));
            break;
          }
        }
      } catch { /* ignore network blips */ }
    }

    tick();
    const interval = setInterval(tick, SERIES_REFRESH_MS);
    const onVisibility = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer) clearTimeout(timer);
    };
  }, [w, metric, format]);

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
