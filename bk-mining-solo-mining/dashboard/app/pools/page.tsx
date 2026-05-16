import Link from "next/link";
import { getPoolStats, parseHashrate, formatHashrate, formatSI, formatAgo } from "@/lib/ckpool";
import { getBlockchainInfo } from "@/lib/bchn";
import { getEnabledPools, type PoolDef } from "@/lib/poolRegistry";
import { readBlocks, type BlockEvent } from "@/lib/blocks";

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

function BlocksSection({ summaries }: { summaries: PoolSummary[] }) {
  const allBlocks: { pool: PoolDef; b: BlockEvent }[] = [];
  for (const s of summaries) for (const b of s.blocks) allBlocks.push({ pool: s.def, b });
  allBlocks.sort((a, b) => b.b.ts - a.b.ts);

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-200 mb-1">Solved blocks</h2>
      <p className="text-sm text-slate-400 mb-3">
        Detected from ckpool logs in real time and cross-verified against each chain's recent coinbase outputs.
        Empty until you solve one.
      </p>
      {allBlocks.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
          No blocks solved yet — the moment you do, you'll see it here with a 🎉.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left">Pool</th>
                <th className="px-3 py-2 text-right">Height</th>
                <th className="px-3 py-2 text-left">Hash</th>
                <th className="px-3 py-2 text-left">Source</th>
                <th className="px-3 py-2 text-right">When</th>
              </tr>
            </thead>
            <tbody>
              {allBlocks.map(({ pool, b }) => (
                <tr key={`${pool.id}-${b.height}-${b.hash}`} className="border-t border-slate-800">
                  <td className="px-3 py-2 font-mono text-xs text-amber-400">{pool.displayName}</td>
                  <td className="px-3 py-2 text-right font-mono">{b.height.toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-400 truncate max-w-[280px]" title={b.hash}>
                    {b.hash.slice(0, 24)}…
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">{b.source}</td>
                  <td className="px-3 py-2 text-right text-slate-400">{formatAgo(b.ts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
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

      <BlocksSection summaries={summaries} />
    </div>
  );
}
