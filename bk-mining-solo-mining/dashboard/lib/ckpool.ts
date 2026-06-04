import { promises as fs } from "fs";
import path from "path";
import { getInstances, type PoolId } from "./poolRegistry";
import { parseHashrate, formatHashrate } from "./format";

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

// ckpool hashrate fields we sum when aggregating instances. PoolStats carries
// more windows than UserStats/WorkerStats.
const POOL_HR_KEYS = [
  "hashrate1m", "hashrate5m", "hashrate15m", "hashrate1hr", "hashrate6hr", "hashrate1d", "hashrate7d",
] as const;
const USER_HR_KEYS = [
  "hashrate1m", "hashrate5m", "hashrate1hr", "hashrate1d", "hashrate7d",
] as const;

function sumHr(values: (string | undefined)[]): string {
  return formatHashrate(values.reduce((acc, v) => acc + (v ? parseHashrate(v) : 0), 0));
}

async function readInstancePoolStatus(dir: string): Promise<PoolStats | null> {
  const text = await readOrNull(path.join(dir, "pool", "pool.status"));
  return text ? parseStats<PoolStats>(text) : null;
}

async function readInstanceUsers(dir: string): Promise<{ address: string; stats: UserStats }[]> {
  const usersDir = path.join(dir, "users");
  let entries: string[];
  try { entries = await fs.readdir(usersDir); } catch { return []; }
  const out: { address: string; stats: UserStats }[] = [];
  for (const entry of entries) {
    if (entry.endsWith(".workers")) continue;
    const text = await readOrNull(path.join(usersDir, entry));
    if (!text) continue;
    out.push({ address: entry, stats: parseStats<UserStats>(text) });
  }
  return out;
}

// PUBLIC: pool stats for a coin = SUM across its low + high ckpool instances.
export async function getPoolStats(pool: PoolId = "bch"): Promise<PoolStats | null> {
  const parts = (
    await Promise.all(getInstances(pool).map((i) => readInstancePoolStatus(i.wwwDir)))
  ).filter((p): p is PoolStats => p !== null);
  if (parts.length === 0) return null;

  const sum = (k: keyof PoolStats) => parts.reduce((a, p) => a + (Number(p[k]) || 0), 0);
  const max = (k: keyof PoolStats) => parts.reduce((a, p) => Math.max(a, Number(p[k]) || 0), 0);
  const agg = { ...parts[0] } as PoolStats;
  for (const k of POOL_HR_KEYS) (agg as unknown as Record<string, unknown>)[k] = sumHr(parts.map((p) => p[k] as string));
  agg.Users = sum("Users");
  agg.Workers = sum("Workers");
  agg.Idle = sum("Idle");
  agg.Disconnected = sum("Disconnected");
  agg.accepted = sum("accepted");
  agg.rejected = sum("rejected");
  agg.SPS1m = sum("SPS1m"); agg.SPS5m = sum("SPS5m"); agg.SPS15m = sum("SPS15m"); agg.SPS1h = sum("SPS1h");
  agg.bestshare = max("bestshare");
  agg.lastupdate = max("lastupdate");
  agg.runtime = max("runtime");
  // diff is the network diff — identical across instances of the same coin.
  agg.diff = parts.find((p) => Number(p.diff) > 0)?.diff ?? parts[0].diff;
  return agg;
}

// PUBLIC: per-address user stats merged across a coin's instances (the same
// address mining on both the low and high port becomes one combined row).
export async function getUsers(pool: PoolId = "bch"): Promise<{ address: string; stats: UserStats }[]> {
  const lists = await Promise.all(getInstances(pool).map((i) => readInstanceUsers(i.wwwDir)));
  const merged = new Map<string, UserStats>();
  for (const list of lists) {
    for (const { address, stats } of list) {
      const cur = merged.get(address);
      if (!cur) { merged.set(address, { ...stats, worker: stats.worker ? [...stats.worker] : undefined }); continue; }
      for (const k of USER_HR_KEYS) (cur as unknown as Record<string, unknown>)[k] = sumHr([cur[k] as string, stats[k] as string]);
      cur.workers = (cur.workers || 0) + (stats.workers || 0);
      cur.shares = (cur.shares || 0) + (stats.shares || 0);
      cur.bestever = Math.max(cur.bestever || 0, stats.bestever || 0);
      cur.bestshare = Math.max(cur.bestshare || 0, stats.bestshare || 0);
      cur.lastshare = Math.max(cur.lastshare || 0, stats.lastshare || 0);
      if (Array.isArray(stats.worker)) cur.worker = [...(cur.worker || []), ...stats.worker];
    }
  }
  return [...merged.entries()].map(([address, stats]) => ({ address, stats }));
}

// Workers for an address across ALL of a coin's instances (low + high).
export async function getWorkers(address: string, pool: PoolId = "bch"): Promise<WorkerStats[]> {
  const out: WorkerStats[] = [];
  for (const i of getInstances(pool)) {
    const userText = await readOrNull(path.join(i.wwwDir, "users", address));
    if (userText) {
      const stats = parseStats<UserStats>(userText);
      if (Array.isArray(stats.worker)) { out.push(...stats.worker); continue; }
    }
    const text = await readOrNull(path.join(i.wwwDir, "users", `${address}.workers`));
    if (!text) continue;
    for (const line of text.split(/\r?\n/)) {
      const s = line.trim();
      if (!s) continue;
      try { out.push(JSON.parse(s) as WorkerStats); } catch { /* skip */ }
    }
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
