import { promises as fs } from "fs";
import path from "path";
import { getPool, type PoolId } from "./poolRegistry";

export interface PoolStats {
  runtime: number;
  lastupdate: number;
  Users: number;
  Workers: number;
  Idle: number;
  Disconnected: number;
  hashrate1m: string;
  hashrate5m: string;
  hashrate15m: string;
  hashrate1hr: string;
  hashrate6hr: string;
  hashrate1d: string;
  hashrate7d: string;
  diff: number;
  accepted: number;
  rejected: number;
  bestshare: number;
  SPS1m: number;
  SPS5m: number;
  SPS15m: number;
  SPS1h: number;
}

export interface WorkerStats {
  workername: string;
  hashrate1m: string;
  hashrate5m: string;
  hashrate1hr: string;
  hashrate1d: string;
  hashrate7d: string;
  lastshare: number;
  shares: number;
  bestshare: number;
  bestever: number;
}

export interface UserStats {
  hashrate1m: string;
  hashrate5m: string;
  hashrate1hr: string;
  hashrate1d: string;
  hashrate7d: string;
  lastshare: number;
  workers: number;
  shares: number;
  bestshare: number;
  bestever: number;
  authorised: number;
  // Newer ckpool builds embed the per-worker array directly in the user file
  // instead of writing a separate <addr>.workers file.
  worker?: WorkerStats[];
}

// ckpool emits two different JSON shapes:
//   1. pool.status — three CONCATENATED single-line JSON objects (counts /
//      hashrate / shares). Merging them into one object is correct.
//   2. users/<addr> — a single PRETTY-PRINTED multi-line JSON object with an
//      embedded "worker": [...] array.
// We try whole-file JSON first; if that fails, fall back to line-by-line
// concat-merge so both shapes work.
function parseStats<T = Record<string, unknown>>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    // not a single JSON object — fall through
  }
  const acc: Record<string, unknown> = {};
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (!s) continue;
    try { Object.assign(acc, JSON.parse(s)); } catch { /* skip malformed */ }
  }
  return acc as T;
}

async function readOrNull(p: string): Promise<string | null> {
  try { return await fs.readFile(p, "utf8"); } catch { return null; }
}

function wwwDir(pool: PoolId): string {
  return getPool(pool).ckpoolWwwDir;
}

export async function getPoolStats(pool: PoolId = "bch"): Promise<PoolStats | null> {
  const text = await readOrNull(path.join(wwwDir(pool), "pool", "pool.status"));
  if (!text) return null;
  return parseStats<PoolStats>(text);
}

export async function getUsers(pool: PoolId = "bch"): Promise<{ address: string; stats: UserStats }[]> {
  const usersDir = path.join(wwwDir(pool), "users");
  let entries: string[];
  try { entries = await fs.readdir(usersDir); } catch { return []; }
  const results = [];
  for (const entry of entries) {
    if (entry.endsWith(".workers")) continue;
    const text = await readOrNull(path.join(usersDir, entry));
    if (!text) continue;
    results.push({ address: entry, stats: parseStats<UserStats>(text) });
  }
  return results;
}

export async function getWorkers(address: string, pool: PoolId = "bch"): Promise<WorkerStats[]> {
  // Prefer the embedded worker[] array in the user file (newer ckpool builds).
  // Fall back to the legacy <addr>.workers file if the embedded form is absent.
  const userText = await readOrNull(path.join(wwwDir(pool), "users", address));
  if (userText) {
    const stats = parseStats<UserStats>(userText);
    if (Array.isArray(stats.worker)) return stats.worker;
  }
  const text = await readOrNull(path.join(wwwDir(pool), "users", `${address}.workers`));
  if (!text) return [];
  const out: WorkerStats[] = [];
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (!s) continue;
    try { out.push(JSON.parse(s) as WorkerStats); } catch { /* skip */ }
  }
  return out;
}

export async function getAllWorkers(pool: PoolId = "bch"): Promise<WorkerStats[]> {
  const users = await getUsers(pool);
  const all: WorkerStats[] = [];
  for (const u of users) {
    all.push(...(await getWorkers(u.address, pool)));
  }
  return all;
}

// Formatters moved to lib/format.ts so client components can import them
// without dragging fs/path into the client bundle. Re-export to keep
// existing import paths working.
export { parseHashrate, formatHashrate, formatSI, formatAgo } from "./format";
