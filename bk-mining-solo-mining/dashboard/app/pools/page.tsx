import Link from "next/link";
import { getPoolStats, parseHashrate, formatHashrate, formatSI, formatAgo } from "@/lib/ckpool";
import { getBlockchainInfo } from "@/lib/bchn";
import { getEnabledPools, type PoolDef } from "@/lib/poolRegistry";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PoolSummary {
  def: PoolDef;
  poolStats: Awaited<ReturnType<typeof getPoolStats>>;
  nodeInfo: Awaited<ReturnType<typeof getBlockchainInfo>> | null;
  err: string | null;
}

async function loadSummary(def: PoolDef): Promise<PoolSummary> {
  const [poolRes, infoRes] = await Promise.allSettled([
    getPoolStats(def.id),
    getBlockchainInfo(def.id),
  ]);
  const poolStats = poolRes.status === "fulfilled" ? poolRes.value : null;
  const nodeInfo = infoRes.status === "fulfilled" ? infoRes.value : null;
  const err = infoRes.status === "rejected" ? String(infoRes.reason?.message ?? infoRes.reason) : null;
  return { def, poolStats, nodeInfo, err };
}

function PoolTile({ s }: { s: PoolSummary }) {
  const stats = s.poolStats;
  const hr1m = parseHashrate(stats?.hashrate1m);
  const hr1h = parseHashrate(stats?.hashrate1hr);
  const hr1d = parseHashrate(stats?.hashrate1d);
  const live = (stats?.Workers ?? 0) > 0;

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
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Last update</div>
          <div className="text-slate-200">{stats ? formatAgo(stats.lastupdate) : "—"}</div>
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
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-200">All pools</h1>
        <p className="text-sm text-slate-400 mt-1">
          Tap a pool to open its detailed view.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {summaries.map((s) => <PoolTile key={s.def.id} s={s} />)}
      </div>
    </div>
  );
}
