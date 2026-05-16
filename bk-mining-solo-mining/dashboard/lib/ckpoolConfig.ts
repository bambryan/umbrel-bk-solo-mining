import { promises as fs } from "fs";
import path from "path";
import { getPool, type PoolId } from "./poolRegistry";

// Client-safe types + presets live in their own file so client components
// can import them without dragging fs/path into the browser bundle.
export { VARDIFF_PRESETS, type PoolSettings } from "./poolSettings.types";
import type { PoolSettings } from "./poolSettings.types";

export interface CkpoolConfig {
  btcaddress: string;
  btcsig: string;
  mindiff: number;
  maxdiff: number;
  startdiff: number;
  [k: string]: unknown;
}

function configPath(pool: PoolId): string {
  return getPool(pool).ckpoolConfigPath;
}

function sentinelPath(pool: PoolId, name: string): string {
  return path.join(path.dirname(configPath(pool)), name);
}

const SENTINEL_USE_MINER_USERNAME = "_use_miner_username";

export async function readConfig(pool: PoolId = "bch"): Promise<CkpoolConfig> {
  const text = await fs.readFile(configPath(pool), "utf8");
  return JSON.parse(text);
}

export async function writeConfig(patch: Partial<CkpoolConfig>, pool: PoolId = "bch"): Promise<CkpoolConfig> {
  const current = await readConfig(pool);
  const next = { ...current, ...patch };
  await fs.writeFile(configPath(pool), JSON.stringify(next, null, 2) + "\n", "utf8");
  return next;
}

export async function getUseMinerUsername(pool: PoolId = "bch"): Promise<boolean> {
  try {
    await fs.access(sentinelPath(pool, SENTINEL_USE_MINER_USERNAME));
    return true;
  } catch {
    return false;
  }
}

export async function setUseMinerUsername(on: boolean, pool: PoolId = "bch"): Promise<void> {
  const p = sentinelPath(pool, SENTINEL_USE_MINER_USERNAME);
  if (on) {
    await fs.writeFile(p, "", "utf8");
  } else {
    try { await fs.unlink(p); } catch { /* already gone */ }
  }
}

export async function getPoolSettings(pool: PoolId = "bch"): Promise<PoolSettings> {
  const cfg = await readConfig(pool);
  const useMinerUsername = await getUseMinerUsername(pool);
  return {
    btcaddress: cfg.btcaddress,
    btcsig: cfg.btcsig,
    mindiff: cfg.mindiff,
    maxdiff: cfg.maxdiff,
    startdiff: cfg.startdiff,
    useMinerUsername,
  };
}

// Loose address validation — ckpool itself rejects anything invalid against
// the consensus rules. We just catch obvious typos client-side.
// Per-chain prefix rules:
//   BCH/BTC: legacy starts with 1 (P2PKH) or 3 (P2SH)
//   BCH:     also CashAddr (q… or p…, optional bitcoincash: prefix)
//   BTC:     also bech32 (bc1…)
//   DGB:     legacy starts with D (P2PKH) or S (P2SH), bech32 dgb1…
const ADDR_LEGACY_BTC_BCH = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const ADDR_LEGACY_DGB = /^[DS][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const ADDR_CASHADDR = /^(bitcoincash:)?[qp][a-z0-9]{39,49}$/i;
const ADDR_BECH32_BTC = /^bc1[ac-hj-np-z02-9]{6,87}$/i;
const ADDR_BECH32_DGB = /^dgb1[ac-hj-np-z02-9]{6,87}$/i;

export function isValidPayoutAddress(addr: string, pool: PoolId = "bch"): boolean {
  const a = addr.trim();
  if (!a) return false;
  if (pool === "dgb") {
    return ADDR_LEGACY_DGB.test(a) || ADDR_BECH32_DGB.test(a);
  }
  if (ADDR_LEGACY_BTC_BCH.test(a)) return true;
  if (pool === "bch" && ADDR_CASHADDR.test(a)) return true;
  if (pool === "btc" && ADDR_BECH32_BTC.test(a)) return true;
  return false;
}

// Back-compat alias for the BCH-only callers — same as isValidPayoutAddress("bch").
export const isValidBchAddress = (a: string) => isValidPayoutAddress(a, "bch");

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

export function validatePoolSettings(p: Partial<PoolSettings>, pool: PoolId = "bch"): ValidationResult {
  if (p.btcaddress != null && !isValidPayoutAddress(p.btcaddress, pool)) {
    const examples = pool === "btc"
      ? "(1…/3… legacy or bc1… bech32)"
      : pool === "dgb"
      ? "(D…/S… legacy or dgb1… bech32)"
      : "(1…/3… legacy or q…/p… cashaddr)";
    return { ok: false, error: `Payout address doesn't look like a valid ${pool.toUpperCase()} address ${examples}.` };
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
