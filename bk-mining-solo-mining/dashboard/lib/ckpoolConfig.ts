import { promises as fs } from "fs";
import path from "path";

// Client-safe types + presets live in their own file so client components
// can import them without dragging fs/path into the browser bundle.
export { VARDIFF_PRESETS, type PoolSettings } from "./poolSettings.types";
import type { PoolSettings } from "./poolSettings.types";

const CONFIG_PATH = process.env.CKPOOL_CONFIG_PATH || "/ckpool-config/ckpool.conf";
const SENTINEL_USE_MINER_USERNAME = path.join(path.dirname(CONFIG_PATH), "_use_miner_username");

export interface CkpoolConfig {
  btcaddress: string;
  btcsig: string;
  mindiff: number;
  maxdiff: number;
  startdiff: number;
  [k: string]: unknown;
}

export async function readConfig(): Promise<CkpoolConfig> {
  const text = await fs.readFile(CONFIG_PATH, "utf8");
  return JSON.parse(text);
}

export async function writeConfig(patch: Partial<CkpoolConfig>): Promise<CkpoolConfig> {
  const current = await readConfig();
  const next = { ...current, ...patch };
  await fs.writeFile(CONFIG_PATH, JSON.stringify(next, null, 2) + "\n", "utf8");
  return next;
}

export async function getUseMinerUsername(): Promise<boolean> {
  try {
    await fs.access(SENTINEL_USE_MINER_USERNAME);
    return true;
  } catch {
    return false;
  }
}

export async function setUseMinerUsername(on: boolean): Promise<void> {
  if (on) {
    await fs.writeFile(SENTINEL_USE_MINER_USERNAME, "", "utf8");
  } else {
    try { await fs.unlink(SENTINEL_USE_MINER_USERNAME); } catch { /* already gone */ }
  }
}

export async function getPoolSettings(): Promise<PoolSettings> {
  const cfg = await readConfig();
  const useMinerUsername = await getUseMinerUsername();
  return {
    btcaddress: cfg.btcaddress,
    btcsig: cfg.btcsig,
    mindiff: cfg.mindiff,
    maxdiff: cfg.maxdiff,
    startdiff: cfg.startdiff,
    useMinerUsername,
  };
}

// Loose validation — ckpool itself will reject anything that doesn't parse
// against the BCH consensus rules. We just catch obvious typos client-side
// so users don't accidentally save garbage and lose all their blocks.
const ADDR_LEGACY = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/; // 1… (P2PKH), 3… (P2SH)
const ADDR_CASHADDR_LOWER = /^(bitcoincash:)?[qp][a-z0-9]{39,49}$/;
const ADDR_CASHADDR_UPPER = /^(BITCOINCASH:)?[QP][A-Z0-9]{39,49}$/;

export function isValidBchAddress(addr: string): boolean {
  const a = addr.trim();
  if (!a) return false;
  if (ADDR_LEGACY.test(a)) return true;
  if (ADDR_CASHADDR_LOWER.test(a) || ADDR_CASHADDR_UPPER.test(a)) return true;
  return false;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

export function validatePoolSettings(p: Partial<PoolSettings>): ValidationResult {
  if (p.btcaddress != null && !isValidBchAddress(p.btcaddress)) {
    return { ok: false, error: "Payout address doesn't look like a valid BCH address (legacy 1…/3… or cashaddr q…/p…)." };
  }
  if (p.btcsig != null) {
    const s = p.btcsig.trim();
    if (!s) return { ok: false, error: "Coinbase signature can't be blank." };
    if (!s.startsWith("/") || !s.endsWith("/")) {
      return { ok: false, error: "Coinbase signature must start and end with / (e.g. /solo mined by BK/)." };
    }
    if (s.length > 100) return { ok: false, error: "Coinbase signature too long (max 100 chars)." };
  }
  for (const k of ["mindiff", "startdiff", "maxdiff"] as const) {
    const v = p[k];
    if (v == null) continue;
    if (!Number.isInteger(v) || v < 0) {
      return { ok: false, error: `${k} must be a non-negative integer.` };
    }
  }
  if (p.mindiff != null && p.startdiff != null && p.startdiff < p.mindiff) {
    return { ok: false, error: "startdiff must be >= mindiff." };
  }
  if (p.maxdiff != null && p.maxdiff > 0 && p.mindiff != null && p.maxdiff < p.mindiff) {
    return { ok: false, error: "maxdiff must be >= mindiff (or 0 for no limit)." };
  }
  return { ok: true };
}

