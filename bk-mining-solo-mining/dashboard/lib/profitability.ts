// Compute expected $/day for each pool given live hashrate + chain state +
// market price. Honest about the math: this is *expected value*, not what
// you'll actually earn in any given day (solo mining variance is huge).

import { getPoolStats, parseHashrate } from "./ckpool";
import { getBlockchainInfo } from "./bchn";
import { getPrices } from "./prices";
import { getEnabledPools, type PoolDef, type PoolId } from "./poolRegistry";

export interface PoolProfit {
  pool: PoolId;
  poolName: string;
  // Live signals
  hashrate1h: number;           // user's hashrate on this pool, H/s
  networkHashrate: number;      // estimated network hashrate for this algo, H/s
  blockTimeSec: number;         // target seconds per block (for the relevant algo)
  blockReward: number;          // subsidy + fees (coin units, approximate)
  priceUsd: number;             // 1 coin price in USD
  priceChange24h: number;       // % change last 24h (positive = up)
  // Derived
  expectedBlocksPerDay: number; // user's share × blocks per day
  dailyUsd: number;             // expected USD/day at current conditions
  available: boolean;           // false if we couldn't pull enough data
  note?: string;                // human-readable status (e.g. "no hashrate", "price stale")
}

// DGB has 5 algos. ckpool only mines SHA-256d. Per-algo target block time is
// roughly 15s × 5 ≈ 75s (DGB targets ~15s overall, evenly across algos).
// BCH and BTC are 600s per block, single algo.
function blockTimeFor(pool: PoolId): number {
  return pool === "dgb" ? 75 : 600;
}

// Pull the actual coinbase output total of the most recent block — that's
// subsidy + fees, the exact reward you'd get if you solved the next block.
// Falls back to the per-coin schedule if RPC fails.
const FALLBACK_REWARD: Record<PoolId, number> = {
  // Post-April-2024 halving
  bch: 3.125,
  btc: 3.125,
  // DGB SHA-256d reward per block (per algo). Verified empirically from
  // block 23,504,705 (our first solo solve): 265.20 DGB. Reflects current
  // post-halving subsidy + typical fees.
  dgb: 265.2,
};

async function getRecentBlockReward(pool: PoolId): Promise<number | null> {
  try {
    const info = await getBlockchainInfo(pool);
    // Walk backwards a few blocks; not every block has fees, but coinbase
    // total = subsidy + fees, which is what miners get. We use the median
    // of the last 3 to avoid empty-fee anomalies.
    // (Skipping the actual implementation for v1 — fallback table is fine
    //  for v1 since rewards are stable. Can wire up later.)
    if (!info) return null;
    return null;
  } catch {
    return null;
  }
}

export async function computeProfit(def: PoolDef): Promise<PoolProfit> {
  const blockTimeSec = blockTimeFor(def.id);

  // --- Hashrate (user) + diff (network) ---
  let hashrate1h = 0;
  try {
    const stats = await getPoolStats(def.id);
    if (stats) hashrate1h = parseHashrate(stats.hashrate1hr);
  } catch { /* leave 0 */ }

  let networkHashrate = 0;
  try {
    const info = await getBlockchainInfo(def.id);
    if (info) {
      // For DGB the global difficulty getblockchaininfo returns is the most
      // recent algo's diff. SHA-256d-specific diff lives in `difficulties`.
      const diff = def.id === "dgb"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? ((info as any).difficulties?.sha256d ?? info.difficulty)
        : info.difficulty;
      networkHashrate = (diff * 2 ** 32) / blockTimeSec;
    }
  } catch { /* leave 0 */ }

  // --- Price ---
  let priceUsd = 0;
  let priceChange24h = 0;
  let priceStale = false;
  try {
    const px = await getPrices();
    priceUsd = px.pricesUsd[def.id] ?? 0;
    priceChange24h = px.changePct24h[def.id] ?? 0;
    if (Date.now() - px.fetchedAt > 30 * 60 * 1000) priceStale = true;
  } catch (e) {
    return {
      pool: def.id, poolName: def.fullName,
      hashrate1h, networkHashrate, blockTimeSec,
      blockReward: FALLBACK_REWARD[def.id], priceUsd: 0, priceChange24h: 0,
      expectedBlocksPerDay: 0, dailyUsd: 0,
      available: false,
      note: `Price feed unavailable: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // --- Reward ---
  const recentReward = await getRecentBlockReward(def.id);
  const blockReward = recentReward ?? FALLBACK_REWARD[def.id];

  // --- Derived ---
  const blocksPerDay = networkHashrate > 0
    ? (86400 / blockTimeSec)
    : 0;
  const expectedBlocksPerDay = networkHashrate > 0
    ? (hashrate1h / networkHashrate) * blocksPerDay
    : 0;
  const dailyUsd = expectedBlocksPerDay * blockReward * priceUsd;

  let note: string | undefined;
  if (hashrate1h === 0) note = "No hashrate on this pool yet";
  else if (networkHashrate === 0) note = "Network diff unavailable";
  else if (priceStale) note = "Price >30 min stale";

  return {
    pool: def.id,
    poolName: def.fullName,
    hashrate1h,
    networkHashrate,
    blockTimeSec,
    blockReward,
    priceUsd,
    priceChange24h,
    expectedBlocksPerDay,
    dailyUsd,
    available: true,
    note,
  };
}

export async function computeAllProfits(): Promise<PoolProfit[]> {
  return Promise.all(getEnabledPools().map(computeProfit));
}
