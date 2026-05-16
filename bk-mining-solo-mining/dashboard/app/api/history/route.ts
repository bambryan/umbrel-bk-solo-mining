import { NextResponse } from "next/server";
import { readSeries, parseWindow, type Sample } from "@/lib/history";

// Series keys clients are allowed to ask for. Restricting prevents arbitrary
// JSONL field exfiltration if we ever add sensitive fields.
const ALLOWED_SERIES = new Set<keyof Sample>([
  "hr1m", "hr5m", "hr15m", "hr1h", "hr6h", "hr1d", "hr7d",
  "accepted", "rejected", "bestshare", "workers", "sps1m",
  "height", "diff",
]);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const window = parseWindow(url.searchParams.get("w"));
  const pool = url.searchParams.get("pool") ?? "bch";
  const seriesParam = url.searchParams.get("series") ?? "hr1m";
  const requested = seriesParam.split(",").map((s) => s.trim()).filter(Boolean);
  const keys = requested.filter((s) => ALLOWED_SERIES.has(s as keyof Sample)) as (keyof Sample)[];

  const rows = await readSeries(window, pool);
  const ts = rows.map((r) => r.ts);
  const series: Record<string, (number | null)[]> = {};
  for (const k of keys) {
    series[k] = rows.map((r) => {
      const v = r[k];
      return typeof v === "number" ? v : null;
    });
  }
  return NextResponse.json({ ts, series });
}
