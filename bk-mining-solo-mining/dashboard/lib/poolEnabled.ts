// Tracks which pools are "enabled" (services should be running). Source of
// truth lives on disk so the sampler, API routes, and UI all agree even if
// the dashboard restarts. Survives upgrades — the file is in the same
// snapshots/ volume as the JSONL sample data.
//
// First-run behavior: if the file doesn't exist yet, we auto-initialize
// from the current ckpool.conf payout addresses. Any pool with a real
// (non-CHANGE_ME) btcaddress is treated as already-enabled. This preserves
// the existing user's setup without forcing them to re-enable everything.

import { promises as fs } from "fs";
import path from "path";
import { readConfig } from "./ckpoolConfig";
import { type PoolId } from "./poolRegistry";

const DIR = process.env.SNAPSHOTS_DIR || "/snapshots";
const FILE = path.join(DIR, "enabled-pools.json");

const ALL_POOLS: PoolId[] = ["bch", "btc", "dgb"];

interface State {
  enabled: PoolId[];
}

async function ensureDir(): Promise<void> {
  try { await fs.mkdir(DIR, { recursive: true }); } catch { /* race ok */ }
}

async function readState(): Promise<State | null> {
  try {
    const text = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(text) as { enabled?: string[] };
    const enabled = (parsed.enabled ?? []).filter((p): p is PoolId =>
      ALL_POOLS.includes(p as PoolId)
    );
    return { enabled };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

async function writeState(state: State): Promise<void> {
  await ensureDir();
  await fs.writeFile(FILE, JSON.stringify(state, null, 2) + "\n", "utf8");
}

// On first run, detect which pools the user has already configured (i.e.
// btcaddress is a real value, not the CHANGE_ME placeholder). Treat those
// as enabled so existing setups don't appear empty after upgrade.
async function autoInitFromExistingConfig(): Promise<State> {
  const enabled: PoolId[] = [];
  for (const pool of ALL_POOLS) {
    try {
      const cfg = await readConfig(pool);
      if (cfg.btcaddress && !cfg.btcaddress.startsWith("CHANGE_ME")) {
        enabled.push(pool);
      }
    } catch {
      // No config yet (pool never installed) → not enabled.
    }
  }
  return { enabled };
}

// Returns the pools the user has opted into (file-backed state). Differs
// from poolRegistry.getEnabledPoolIds() which returns the *universe* of
// pools the dashboard is built to know about (POOLS env, static).
export async function getEnabledPoolIdsFromState(): Promise<PoolId[]> {
  let state = await readState();
  if (state === null) {
    state = await autoInitFromExistingConfig();
    try { await writeState(state); } catch { /* non-fatal */ }
  }
  return state.enabled;
}

export async function isPoolEnabled(pool: PoolId): Promise<boolean> {
  const enabled = await getEnabledPoolIdsFromState();
  return enabled.includes(pool);
}

export async function setPoolEnabled(pool: PoolId, on: boolean): Promise<PoolId[]> {
  const current = await getEnabledPoolIdsFromState();
  const set = new Set(current);
  if (on) set.add(pool);
  else set.delete(pool);
  const next: PoolId[] = ALL_POOLS.filter((p) => set.has(p)); // canonical order
  await writeState({ enabled: next });
  return next;
}

// "Available" pools are everything the registry knows about, whether enabled
// or not. UI lists these so users can see installation options.
export function getAvailablePools(): PoolId[] {
  return [...ALL_POOLS];
}
