import { promises as fs } from "fs";
import path from "path";

const WWW_DIR = process.env.CKPOOL_WWW_DIR || "/ckpool-www";

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
}

// ckpool writes JSON lines (one JSON object per line). For pool.status it's 3
// lines: counts/hashrate/shares. For workers it's a header line + N worker
// rows. We just concat into one object for counts/hashrate/shares files, and
// return an array for workers.
function parseConcatJson<T = Record<string, unknown>>(text: string): T {
  const acc: Record<string, unknown> = {};
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (!s) continue;
    try { Object.assign(acc, JSON.parse(s)); } catch { /* skip malformed */ }
  }
  return acc as T;
}

function parseJsonLines<T = Record<string, unknown>>(text: string): T[] {
  const out: T[] = [];
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (!s) continue;
    try { out.push(JSON.parse(s) as T); } catch { /* skip */ }
  }
  return out;
}

async function readOrNull(p: string): Promise<string | null> {
  try { return await fs.readFile(p, "utf8"); } catch { return null; }
}

export async function getPoolStats(): Promise<PoolStats | null> {
  const text = await readOrNull(path.join(WWW_DIR, "pool", "pool.status"));
  if (!text) return null;
  return parseConcatJson<PoolStats>(text);
}

export async function getUsers(): Promise<{ address: string; stats: UserStats }[]> {
  const usersDir = path.join(WWW_DIR, "users");
  let entries: string[];
  try { entries = await fs.readdir(usersDir); } catch { return []; }
  const results = [];
  for (const entry of entries) {
    if (entry.endsWith(".workers")) continue;
    const text = await readOrNull(path.join(usersDir, entry));
    if (!text) continue;
    results.push({ address: entry, stats: parseConcatJson<UserStats>(text) });
  }
  return results;
}

export async function getWorkers(address: string): Promise<WorkerStats[]> {
  const text = await readOrNull(path.join(WWW_DIR, "users", `${address}.workers`));
  if (!text) return [];
  return parseJsonLines<WorkerStats>(text);
}

export async function getAllWorkers(): Promise<WorkerStats[]> {
  const users = await getUsers();
  const all: WorkerStats[] = [];
  for (const u of users) {
    all.push(...(await getWorkers(u.address)));
  }
  return all;
}

// Convert "132T", "5.5G", "65.7P" → number of hashes/sec
export function parseHashrate(h: string | undefined): number {
  if (!h) return 0;
  const m = /^([\d.]+)\s*([KMGTPE])?$/i.exec(h.trim());
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const unit = (m[2] || "").toUpperCase();
  const mult: Record<string, number> = {
    "": 1, K: 1e3, M: 1e6, G: 1e9, T: 1e12, P: 1e15, E: 1e18,
  };
  return n * (mult[unit] ?? 1);
}

export function formatHashrate(hps: number): string {
  if (hps >= 1e18) return (hps / 1e18).toFixed(2) + " EH/s";
  if (hps >= 1e15) return (hps / 1e15).toFixed(2) + " PH/s";
  if (hps >= 1e12) return (hps / 1e12).toFixed(2) + " TH/s";
  if (hps >= 1e9) return (hps / 1e9).toFixed(2) + " GH/s";
  if (hps >= 1e6) return (hps / 1e6).toFixed(2) + " MH/s";
  if (hps >= 1e3) return (hps / 1e3).toFixed(2) + " KH/s";
  return hps.toFixed(0) + " H/s";
}

export function formatAgo(unixSec: number | undefined): string {
  if (!unixSec) return "—";
  const sec = Math.max(0, Math.floor(Date.now() / 1000) - unixSec);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}
