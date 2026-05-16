import { NextResponse } from "next/server";
import { getPoolStats, parseHashrate } from "@/lib/ckpool";
import { getBlockchainInfo, getNetworkInfo, getMempoolInfo } from "@/lib/bchn";
import { parsePoolId } from "@/lib/poolRegistry";

// Aggregated current-snapshot endpoint that drives the client-side
// auto-refresh on the Overview page. Mirrors what app/page.tsx computes on
// initial server render so the polling code can simply replace its state.
//
// BCH blocktime = 600s, BTC blocktime = 600s — same formula works for both.
export async function GET(req: Request) {
  const pool = parsePoolId(new URL(req.url).searchParams.get("pool"));
  const [poolRes, infoRes, netRes, mempoolRes] = await Promise.allSettled([
    getPoolStats(pool),
    getBlockchainInfo(pool),
    getNetworkInfo(pool),
    getMempoolInfo(pool),
  ]);
  const poolStats = poolRes.status === "fulfilled" ? poolRes.value : null;
  const nodeInfo = infoRes.status === "fulfilled" ? infoRes.value : null;
  const netInfo = netRes.status === "fulfilled" ? netRes.value : null;
  const mempool = mempoolRes.status === "fulfilled" ? mempoolRes.value : null;

  const hr1m = parseHashrate(poolStats?.hashrate1m);
  const hr1h = parseHashrate(poolStats?.hashrate1hr);
  const hr1d = parseHashrate(poolStats?.hashrate1d);
  const networkHashrate = nodeInfo ? (nodeInfo.difficulty * 2 ** 32) / 600 : 0;
  const dailyOdds = networkHashrate > 0 ? (hr1h * 86400) / (networkHashrate * 600) : 0;

  return NextResponse.json({
    pool: poolStats,
    // keep `bch` field name for backwards compat — UI doesn't care since
    // it's just the node's getblockchaininfo response either way.
    bch: nodeInfo,
    net: netInfo,
    mempool,
    derived: { hr1m, hr1h, hr1d, networkHashrate, dailyOdds },
  });
}
