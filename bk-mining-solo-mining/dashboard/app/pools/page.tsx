import Link from "next/link";
import { getPoolStats, parseHashrate, formatHashrate, formatSI, formatAgo } from "@/lib/ckpool";
import { getBlockchainInfo } from "@/lib/bchn";
import { getEnabledPools, type PoolDef } from "@/lib/poolRegistry";
import { readBlocks, type BlockEvent } from "@/lib/blocks";
// Note: BlocksSection moved to its own /blocks page; kept the import path
// for the tile-level summary (oursBlocks count + most-recent banner).

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PoolSummary {
  def: PoolDef;
  poolStats: Awaited<ReturnType<typeof getPoolStats>>;
  nodeInfo: Awaited<ReturnType<typeof getBlockchainInfo>> | null;
  blocks: BlockEvent[];
  err: string | null;
}

async function loadSummary(def: PoolDef): Promise<PoolSummary> {
  const [poolRes, infoRes, blocks] = await Promise.all([
    getPoolStats(def.id).catch(() => null),
    getBlockchainInfo(def.id).catch(() => null),
    readBlocks(def.id, 5).catch(() => [] as BlockEvent[]),
  ]);
  return {
    def,
    poolStats: poolRes,
    nodeInfo: infoRes,
    blocks,
    err: null,
  };
}

function PoolTile({ s }: { s: PoolSummary }) {
  const stats = s.poolStats;
  const hr1m = parseHashrate(stats?.hashrate1m);
  const hr1h = parseHashrate(stats?.hashrate1hr);
  const hr1d = parseHashrate(stats?.hashrate1d);
  const live = (stats?.Workers ?? 0) > 0;
  const oursBlocks = s.blocks.filter((b) => b.ours);

  return (
    <Link
      href={`/?pool=${s.def.id}`}
      className="block rounded-lg border border-slate-800 bg-slate-900/60 p-4 hover:border-amber-500 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-lg font-semibold text-white">{s.def.fullName}</div>
          <div className="text-xs text-slate-500 uppercase tracking-wide">{s.def.displayName} pool</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={live ? "text-emerald-400" : "text-slate-600"}>●</span>
          <span className="text-xs text-slate-400">{live ? "Mining" : "Idle"}</span>
        </div>
      </div>

      {oursBlocks.length > 0 && (
        <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2">
          <div className="text-xs text-amber-300 font-semibold">
            🎉 {oursBlocks.length} block{oursBlocks.length > 1 ? "s" : ""} solved!
          </div>
          <div className="text-[11px] text-amber-200/80 mt-0.5">
            Most recent: #{oursBlocks[0].height.toLocaleString()} · {formatAgo(oursBlocks[0].ts)}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">1m</div>
          <div className="text-base font-semibold text-white">{formatHashrate(hr1m)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">1h</div>
          <div className="text-base font-semibold text-white">{formatHashrate(hr1h)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">1d</div>
          <div className="text-base font-semibold text-white">{formatHashrate(hr1d)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Workers</div>
          <div className="text-slate-200">
            {stats ? stats.Workers : "—"}
            {stats && stats.Disconnected > 0 && (
              <span className="text-slate-500 text-xs"> · {stats.Disconnected} disc.</span>
            )}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Best share</div>
          <div className="text-slate-200">{formatSI(stats?.bestshare)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Block height</div>
          <div className="text-slate-200">
            {s.nodeInfo ? s.nodeInfo.blocks.toLocaleString() : <span className="text-amber-500">node down</span>}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Blocks solved</div>
          <div className="text-slate-200">{oursBlocks.length}</div>
        </div>
      </div>

      <div className="text-[11px] text-slate-500 border-t border-slate-800 pt-2">
        stratum+tcp://&lt;host&gt;:{s.def.stratumPort}
      </div>
    </Link>
  );
}


export default async function PoolsOverview() {
  const pools = getEnabledPools();
  const summaries = await Promise.all(pools.map(loadSummary));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-slate-200">All pools</h1>
        <p className="text-sm text-slate-400 mt-1">
          Tap a pool to open its detailed view.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {summaries.map((s) => <PoolTile key={s.def.id} s={s} />)}
      </div>

      <div className="text-sm text-slate-400">
        <Link href="/blocks" className="text-amber-400 hover:underline">
          View solved-block log →
        </Link>
      </div>
    </div>
  );
}
