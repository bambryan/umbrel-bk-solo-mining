import { NextResponse } from "next/server";
import { getPoolStats, parseHashrate } from "@/lib/ckpool";
import { getBlockchainInfo, getNetworkInfo, getMempoolInfo } from "@/lib/bchn";

// Aggregated current-snapshot endpoint that drives the client-side
// auto-refresh on the Overview page. Mirrors what app/page.tsx computes on
// initial server render so the polling code can simply replace its state.
export async function GET() {
  const [pool, info, net, mempool] = await Promise.allSettled([
    getPoolStats(),
    getBlockchainInfo(),
    getNetworkInfo(),
    getMempoolInfo(),
  ]);
  const poolStats = pool.status === "fulfilled" ? pool.value : null;
  const bchInfo = info.status === "fulfilled" ? info.value : null;
  const bchNet = net.status === "fulfilled" ? net.value : null;
  const bchMempool = mempool.status === "fulfilled" ? mempool.value : null;

  const hr1m = parseHashrate(poolStats?.hashrate1m);
  const hr1h = parseHashrate(poolStats?.hashrate1hr);
  const hr1d = parseHashrate(poolStats?.hashrate1d);
  const networkHashrate = bchInfo ? (bchInfo.difficulty * 2 ** 32) / 600 : 0;
  const dailyOdds = networkHashrate > 0 ? (hr1h * 86400) / (networkHashrate * 600) : 0;

  return NextResponse.json({
    pool: poolStats,
    bch: bchInfo,
    net: bchNet,
    mempool: bchMempool,
    derived: {
      hr1m, hr1h, hr1d,
      networkHashrate,
      dailyOdds,
    },
  });
}
