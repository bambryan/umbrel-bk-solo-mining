import { promises as fs } from "fs";
import path from "path";

const DIR = process.env.SNAPSHOTS_DIR || "/snapshots";
const FILE = path.join(DIR, "pool.jsonl");

// Keep 7 days of 60s samples ≈ 10,080 rows. We allow a soft cap with slack so
// we're not rewriting the whole file every minute.
const MAX_ROWS = 11000;

export type Sample = {
  ts: number; // unix seconds
  pool: string; // "bch" for now; discriminator for future multi-pool
  hr1m?: number;
  hr5m?: number;
  hr15m?: number;
  hr1h?: number;
  hr6h?: number;
  hr1d?: number;
  hr7d?: number;
  accepted?: number;
  rejected?: number;
  bestshare?: number;
  workers?: number;
  sps1m?: number;
  height?: number;
  diff?: number;
};

async function ensureDir(): Promise<void> {
  try { await fs.mkdir(DIR, { recursive: true }); } catch { /* race ok */ }
}

export async function appendSample(row: Sample): Promise<void> {
  await ensureDir();
  await fs.appendFile(FILE, JSON.stringify(row) + "\n", "utf8");
}

async function readAll(): Promise<Sample[]> {
  try {
    const text = await fs.readFile(FILE, "utf8");
    const out: Sample[] = [];
    for (const line of text.split(/\r?\n/)) {
      const s = line.trim();
      if (!s) continue;
      try { out.push(JSON.parse(s) as Sample); } catch { /* skip malformed */ }
    }
    return out;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

// Read the rows in [now - windowSec, now] for the given pool.
export async function readSeries(
  windowSec: number,
  pool = "bch"
): Promise<Sample[]> {
  const all = await readAll();
  const cutoff = Math.floor(Date.now() / 1000) - windowSec;
  return all.filter((r) => r.pool === pool && r.ts >= cutoff);
}

// Rewrite the file with the last MAX_ROWS rows. Called from the sampler after
// each append; the read+rewrite is only triggered when the file exceeds the
// cap, so steady-state cost is one stat() per minute.
export async function trimIfNeeded(): Promise<void> {
  try {
    const stat = await fs.stat(FILE);
    // Rough fast check: a row is < 200 bytes. If file is < cap * 250, skip.
    if (stat.size < MAX_ROWS * 250) return;
  } catch {
    return;
  }
  const all = await readAll();
  if (all.length <= MAX_ROWS) return;
  const trimmed = all.slice(-MAX_ROWS);
  const tmp = FILE + ".tmp";
  await fs.writeFile(tmp, trimmed.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
  await fs.rename(tmp, FILE);
}

// Window strings → seconds. Used by the API + UI.
export const WINDOWS: Record<string, number> = {
  "30m": 30 * 60,
  "1h": 60 * 60,
  "6h": 6 * 60 * 60,
  "24h": 24 * 60 * 60,
  "7d": 7 * 24 * 60 * 60,
};

export function parseWindow(w: string | null | undefined): number {
  if (!w) return WINDOWS["1h"];
  return WINDOWS[w] ?? WINDOWS["1h"];
}
