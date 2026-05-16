import { promises as fs } from "fs";
import path from "path";
import type { PoolId } from "./poolRegistry";

const DIR = process.env.SNAPSHOTS_DIR || "/snapshots";

function file(pool: PoolId): string {
  return path.join(DIR, `blocks-${pool}.jsonl`);
}

export type BlockEvent = {
  ts: number;          // unix seconds when detected
  pool: PoolId;
  height: number;
  hash: string;
  // Coinbase-derived (when known)
  reward?: number;     // sats (or coin's smallest unit)
  payoutAddress?: string;
  // "ours" if the coinbase pays our configured btcaddress
  ours: boolean;
  // Source: how we learned about it
  source: "log" | "chain";
  // For "log" source — original ckpool log line for debugging
  rawLogLine?: string;
};

async function ensureDir(): Promise<void> {
  try { await fs.mkdir(DIR, { recursive: true }); } catch { /* race ok */ }
}

export async function appendBlock(row: BlockEvent): Promise<void> {
  await ensureDir();
  await fs.appendFile(file(row.pool), JSON.stringify(row) + "\n", "utf8");
}

export async function readBlocks(pool: PoolId, limit = 50): Promise<BlockEvent[]> {
  try {
    const text = await fs.readFile(file(pool), "utf8");
    const rows: BlockEvent[] = [];
    for (const line of text.split(/\r?\n/)) {
      const s = line.trim();
      if (!s) continue;
      try { rows.push(JSON.parse(s) as BlockEvent); } catch { /* skip */ }
    }
    return rows.slice(-limit).reverse(); // most recent first
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

// Dedup by height+hash so the log watcher and chain verifier don't both
// record the same block twice.
export async function hasBlock(pool: PoolId, height: number, hash: string): Promise<boolean> {
  const rows = await readBlocks(pool, 500);
  return rows.some((r) => r.height === height && r.hash === hash);
}
