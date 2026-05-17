import { Suspense } from "react";
import { getPoolStats, parseHashrate, formatHashrate, formatSI, formatAgo } from "@/lib/ckpool";
import { getBlockchainInfo, getNetworkInfo, getMempoolInfo } from "@/lib/bchn";
import { readSeries, parseWindow } from "@/lib/history";
import { parsePoolId, getPool } from "@/lib/poolRegistry";
import { readBlocks } from "@/lib/blocks";
import { SparkCard } from "@/components/SparkCard";
import { WindowSelector } from "@/components/WindowSelector";
import { BlockSolvedBanner } from "@/components/BlockSolvedBanner";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-2xl font-semibold text-white mt-1">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

async function seedSeries(metric: string, windowSec: number, pool: "bch" | "btc" | "dgb"): Promise<number[]> {
  const rows = await readSeries(windowSec, pool);
  return rows.map((r) => {
    const v = (r as Record<string, unknown>)[metric];
    return typeof v === "number" ? v : 0;
  });
}

type PageProps = { searchParams: Promise<{ w?: string; pool?: string }> };

export default async function Overview({ searchParams }: PageProps) {
  const sp = await searchParams;
  const windowSec = parseWindow(sp.w);
  const pool = parsePoolId(sp.pool);
  const poolDef = getPool(pool);

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

  const [s_hr1m, s_hr1h, s_hr1d, s_workers, s_accepted, s_rejected, s_best, s_sps, s_diff, allBlocks] =
    await Promise.all([
      seedSeries("hr1m", windowSec, pool),
      seedSeries("hr1h", windowSec, pool),
      seedSeries("hr1d", windowSec, pool),
      seedSeries("workers", windowSec, pool),
      seedSeries("accepted", windowSec, pool),
      seedSeries("rejected", windowSec, pool),
      seedSeries("bestshare", windowSec, pool),
      seedSeries("sps1m", windowSec, pool),
      seedSeries("diff", windowSec, pool),
      readBlocks(pool, 100).catch(() => []),
    ]);
  const oursBlocks = allBlocks.filter((b) => b.ours);
  const newest = oursBlocks[0]; // readBlocks returns newest first
  // Only show the celebration banner for blocks solved in the last 24h. The
  // Blocks-solved StatCard below stays regardless, so the count is never lost.
  const CELEBRATE_WINDOW_SEC = 24 * 60 * 60;
  const mostRecent = newest && (Math.floor(Date.now() / 1000) - newest.ts) < CELEBRATE_WINDOW_SEC
    ? newest
    : null;

  const nothingFromNode = nodeInfo == null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-200">{poolDef.fullName} pool</h1>
        <Suspense fallback={null}><WindowSelector /></Suspense>
      </div>

      {nothingFromNode && (
        <div className="rounded-md border border-amber-700/40 bg-amber-900/20 text-amber-300 px-3 py-2 text-sm">
          {poolDef.displayName} node not reachable yet (no chain info). If you just installed the
          stack, give bitcoind a minute to start. Stats below are from ckpool only.
        </div>
      )}

      {mostRecent && (
        <BlockSolvedBanner
          pool={pool}
          height={mostRecent.height}
          hash={mostRecent.hash}
          ts={mostRecent.ts}
          totalSolved={oursBlocks.length}
        />
      )}

      <section>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Suspense fallback={null}>
            <SparkCard label="1m hashrate" metric="hr1m" initialSeries={s_hr1m} initialValue={formatHashrate(hr1m)} format="hashrate" color="#22d3ee" />
            <SparkCard label="1h hashrate" metric="hr1h" initialSeries={s_hr1h} initialValue={formatHashrate(hr1h)} format="hashrate" color="#ec4899" />
            <SparkCard label="1d hashrate" metric="hr1d" initialSeries={s_hr1d} initialValue={formatHashrate(hr1d)} format="hashrate" color="#a78bfa" />
            <SparkCard
              label="Workers"
              metric="workers"
              initialSeries={s_workers}
              initialValue={poolStats ? `${poolStats.Workers}` : "—"}
              format="int"
              sub={poolStats ? `${poolStats.Idle} idle · ${poolStats.Disconnected} disc.` : undefined}
              color="#34d399"
            />
          </Suspense>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3 text-slate-200">Shares</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Suspense fallback={null}>
            <SparkCard label="Accepted" metric="accepted" initialSeries={s_accepted} initialValue={formatSI(poolStats?.accepted)} format="si" sub={poolStats ? poolStats.accepted.toLocaleString() : undefined} color="#22d3ee" />
            <SparkCard label="Rejected" metric="rejected" initialSeries={s_rejected} initialValue={formatSI(poolStats?.rejected)} format="si" sub={poolStats ? poolStats.rejected.toLocaleString() : undefined} color="#f87171" />
            <SparkCard label="Best share" metric="bestshare" initialSeries={s_best} initialValue={formatSI(poolStats?.bestshare)} format="si" sub={poolStats ? poolStats.bestshare.toLocaleString() : undefined} color="#fbbf24" />
            <SparkCard label="SPS (1m)" metric="sps1m" initialSeries={s_sps} initialValue={poolStats ? poolStats.SPS1m.toFixed(2) : "—"} format="decimal2" color="#a78bfa" />
          </Suspense>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3 text-slate-200">Chain</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Block height" value={nodeInfo ? nodeInfo.blocks.toLocaleString() : "—"} sub={nodeInfo?.headers ? `headers ${nodeInfo.headers.toLocaleString()}` : undefined} />
          <Suspense fallback={null}>
            <SparkCard label="Network difficulty" metric="diff" initialSeries={s_diff} initialValue={formatSI(nodeInfo?.difficulty)} format="si" sub={nodeInfo ? nodeInfo.difficulty.toExponential(3) : undefined} color="#f59e0b" />
          </Suspense>
          <StatCard label="Network hashrate" value={networkHashrate ? formatHashrate(networkHashrate) : "—"} />
          <StatCard label="Peers" value={netInfo ? `${netInfo.connections}` : "—"} sub={netInfo?.subversion} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3 text-slate-200">Solo odds (very rough)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Blocks solved"
            value={oursBlocks.length === 0 ? "0" : oursBlocks.length.toLocaleString()}
            sub={mostRecent ? `most recent ${formatAgo(mostRecent.ts)}` : "none yet"}
          />
          <StatCard
            label="Daily block probability"
            value={dailyOdds ? `${(dailyOdds * 100).toFixed(2)}%` : "—"}
            sub={dailyOdds ? `≈ 1 block every ${(1 / dailyOdds).toFixed(0)} days at current 1h hashrate` : undefined}
          />
          <StatCard
            label="Mempool"
            value={mempool ? `${mempool.size.toLocaleString()} txs` : "—"}
            sub={mempool ? `${(mempool.bytes / 1e6).toFixed(2)} MB` : undefined}
          />
          <StatCard
            label="Pool runtime"
            value={poolStats ? `${(poolStats.runtime / 3600).toFixed(1)}h` : "—"}
            sub={poolStats ? `updated ${formatAgo(poolStats.lastupdate)}` : undefined}
          />
        </div>
      </section>

      <p className="text-xs text-slate-500">
        Sparklines auto-refresh every 30s while the tab is visible. Sampler writes one row per pool per minute.
      </p>
    </div>
  );
}
