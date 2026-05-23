// Compute expected $/day for each coin given live hashrate + chain state +
// market price. Honest about the math: this is *expected value*, not what
// you'll actually earn in any given day (solo mining variance is huge).
//
// Key modeling choice: every pool here mines SHA-256d (BTC, BCH, DGB). Your
// rigs can only point at one pool at a time, so the useful question is "if I
// pointed ALL my connected hashpower at this coin, what would I expect to
// earn?" — not "what does the hashrate that happens to be on this pool right
// now earn?" So we sum the hashrate connected across every pool and run that
// total against each coin's difficulty. That makes the per-coin $/day a true
// apples-to-apples ranking for deciding where to aim the rigs.

import { getPoolStats, parseHashrate } from "./ckpool";
import { getBlockchainInfo } from "./bchn";
import { getPrices } from "./prices";
import { getEnabledPools, type PoolDef, type PoolId } from "./poolRegistry";

export interface PoolProfit {
  pool: PoolId;
  poolName: string;
  // Live signals
  connectedHashrate: number;    // hashrate currently pointed at THIS pool, H/s
  totalHashrate: number;        // sum of hashrate across ALL pools (same on every row), H/s
  difficulty: number;           // network difficulty for this coin's SHA-256d chain
  networkHashrate: number;      // estimated network hashrate for this algo, H/s
  blockTimeSec: number;         // target seconds per block (for the relevant algo)
  blockReward: number;          // subsidy + fees (coin units, approximate)
  priceUsd: number;             // 1 coin price in USD
  priceChange24h: number;       // % change last 24h (positive = up)
  // Derived — computed against TOTAL hashrate ("if you pointed everything here")
  share: number;                // totalHashrate / networkHashrate
  expectedBlocksPerDay: number; // your share × blocks per day
  dailyUsd: number;             // expected USD/day at current conditions
  available: boolean;           // false if we couldn't pull enough data
  note?: string;                // human-readable status (e.g. "no hashrate", "price stale")
}

// DGB has 5 algos. ckpool only mines SHA-256d. Per-algo target block time is
// roughly 15s × 5 ≈ 75s (DGB targets ~15s overall, evenly across algos).
// BCH and BTC are 600s per block, single algo. NB: block time cancels out of
// the expected-blocks math (it's baked into both network hashrate and blocks
// per day); we keep it only to display an honest network-hashrate figure.
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

// Read the hashrate currently connected to a single pool (1h average, H/s).
async function getConnectedHashrate(pool: PoolId): Promise<number> {
  try {
    const stats = await getPoolStats(pool);
    if (stats) return parseHashrate(stats.hashrate1hr);
  } catch { /* leave 0 */ }
  return 0;
}

// Pull this coin's SHA-256d difficulty and the network hashrate it implies.
async function getDifficultyAndNetwork(
  def: PoolDef,
  blockTimeSec: number,
): Promise<{ difficulty: number; networkHashrate: number }> {
  try {
    const info = await getBlockchainInfo(def.id);
    if (info) {
      // For DGB the global difficulty getblockchaininfo returns is the most
      // recent algo's diff. SHA-256d-specific diff lives in `difficulties`.
      const difficulty = def.id === "dgb"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? ((info as any).difficulties?.sha256d ?? info.difficulty)
        : info.difficulty;
      return { difficulty, networkHashrate: (difficulty * 2 ** 32) / blockTimeSec };
    }
  } catch { /* leave 0 */ }
  return { difficulty: 0, networkHashrate: 0 };
}

// Compute one coin's profitability. `connectedHashrate` is what's pointed at
// THIS pool now (display only); `totalHashrate` is the sum across all pools and
// is what the $/day estimate actually runs against.
export async function computeProfit(
  def: PoolDef,
  connectedHashrate: number,
  totalHashrate: number,
): Promise<PoolProfit> {
  const blockTimeSec = blockTimeFor(def.id);

  // --- Difficulty + network hashrate ---
  const { difficulty, networkHashrate } = await getDifficultyAndNetwork(def, blockTimeSec);

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
      connectedHashrate, totalHashrate, difficulty, networkHashrate, blockTimeSec,
      blockReward: FALLBACK_REWARD[def.id], priceUsd: 0, priceChange24h: 0,
      share: 0, expectedBlocksPerDay: 0, dailyUsd: 0,
      available: false,
      note: `Price feed unavailable: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // --- Reward ---
  const recentReward = await getRecentBlockReward(def.id);
  const blockReward = recentReward ?? FALLBACK_REWARD[def.id];

  // --- Derived (against TOTAL hashrate) ---
  // For SHA-256d, expected blocks per day depends only on hashrate and
  // difficulty — block time cancels:
  //   blocks/day = hashrate × 86400 / (difficulty × 2^32)
  const expectedBlocksPerDay = difficulty > 0
    ? (totalHashrate * 86400) / (difficulty * 2 ** 32)
    : 0;
  const share = networkHashrate > 0 ? totalHashrate / networkHashrate : 0;
  const dailyUsd = expectedBlocksPerDay * blockReward * priceUsd;

  let note: string | undefined;
  if (totalHashrate === 0) note = "No miners connected to any pool";
  else if (difficulty === 0) note = "Network difficulty unavailable";
  else if (priceStale) note = "Price >30 min stale";

  return {
    pool: def.id,
    poolName: def.fullName,
    connectedHashrate,
    totalHashrate,
    difficulty,
    networkHashrate,
    blockTimeSec,
    blockReward,
    priceUsd,
    priceChange24h,
    share,
    expectedBlocksPerDay,
    dailyUsd,
    available: true,
    note,
  };
}

export async function computeAllProfits(): Promise<PoolProfit[]> {
  const pools = getEnabledPools();

  // First pass: how much hashrate is connected to each pool right now. Summed,
  // this is the total SHA-256d hashpower we can aim at any single coin.
  const connected = await Promise.all(pools.map((def) => getConnectedHashrate(def.id)));
  const totalHashrate = connected.reduce((sum, h) => sum + h, 0);

  // Second pass: run that total against every coin's difficulty.
  return Promise.all(
    pools.map((def, i) => computeProfit(def, connected[i], totalHashrate)),
  );
}
