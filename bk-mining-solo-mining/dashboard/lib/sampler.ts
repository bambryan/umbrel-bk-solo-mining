import { getPoolStats, parseHashrate } from "./ckpool";
import { getBlockchainInfo } from "./bchn";
import { appendSample, trimIfNeeded, type Sample } from "./history";

// One pass: read current state from ckpool + bchn, build a sample row,
// append to JSONL, trim if the file has grown past the cap.
export async function sample(): Promise<void> {
  const ts = Math.floor(Date.now() / 1000);
  const row: Sample = { ts, pool: "bch" };

  try {
    const pool = await getPoolStats();
    if (pool) {
      row.hr1m = parseHashrate(pool.hashrate1m);
      row.hr5m = parseHashrate(pool.hashrate5m);
      row.hr15m = parseHashrate(pool.hashrate15m);
      row.hr1h = parseHashrate(pool.hashrate1hr);
      row.hr6h = parseHashrate(pool.hashrate6hr);
      row.hr1d = parseHashrate(pool.hashrate1d);
      row.hr7d = parseHashrate(pool.hashrate7d);
      row.accepted = pool.accepted;
      row.rejected = pool.rejected;
      row.bestshare = pool.bestshare;
      row.workers = pool.Workers;
      row.sps1m = pool.SPS1m;
    }
  } catch (e) {
    console.warn("[sampler] pool stats failed:", e instanceof Error ? e.message : e);
  }

  try {
    const info = await getBlockchainInfo();
    row.height = info.blocks;
    row.diff = info.difficulty;
  } catch (e) {
    console.warn("[sampler] bchn info failed:", e instanceof Error ? e.message : e);
  }

  try {
    await appendSample(row);
    await trimIfNeeded();
  } catch (e) {
    console.error("[sampler] write failed:", e instanceof Error ? e.message : e);
  }
}
