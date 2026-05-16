import { getPoolStats, parseHashrate } from "./ckpool";
import { getBlockchainInfo } from "./bchn";
import { appendSample, trimIfNeeded, type Sample } from "./history";
import { getEnabledPoolIds, type PoolId } from "./poolRegistry";

// One sample per enabled pool. Failures on a per-pool basis are isolated —
// e.g. if the BTC node isn't up yet, the BCH row still gets written.
async function sampleOne(pool: PoolId): Promise<void> {
  const ts = Math.floor(Date.now() / 1000);
  const row: Sample = { ts, pool };

  try {
    const stats = await getPoolStats(pool);
    if (stats) {
      row.hr1m = parseHashrate(stats.hashrate1m);
      row.hr5m = parseHashrate(stats.hashrate5m);
      row.hr15m = parseHashrate(stats.hashrate15m);
      row.hr1h = parseHashrate(stats.hashrate1hr);
      row.hr6h = parseHashrate(stats.hashrate6hr);
      row.hr1d = parseHashrate(stats.hashrate1d);
      row.hr7d = parseHashrate(stats.hashrate7d);
      row.accepted = stats.accepted;
      row.rejected = stats.rejected;
      row.bestshare = stats.bestshare;
      row.workers = stats.Workers;
      row.sps1m = stats.SPS1m;
    }
  } catch (e) {
    console.warn(`[sampler:${pool}] pool stats failed:`, e instanceof Error ? e.message : e);
  }

  try {
    const info = await getBlockchainInfo(pool);
    row.height = info.blocks;
    row.diff = info.difficulty;
  } catch (e) {
    console.warn(`[sampler:${pool}] node info failed:`, e instanceof Error ? e.message : e);
  }

  try {
    await appendSample(row);
    await trimIfNeeded();
  } catch (e) {
    console.error(`[sampler:${pool}] write failed:`, e instanceof Error ? e.message : e);
  }
}

// Top-level: called by instrumentation.ts every 60s. Sample every enabled
// pool sequentially (so console logs are tidy + we don't double-load disk).
export async function sample(): Promise<void> {
  for (const pool of getEnabledPoolIds()) {
    await sampleOne(pool);
  }
}
