import Link from "next/link";
import { getPoolStats, parseHashrate, formatHashrate, formatSI, formatAgo } from "@/lib/ckpool";
import { getBlockchainInfo } from "@/lib/bchn";
import { getEnabledPools, getPool, type PoolDef, type PoolId } from "@/lib/poolRegistry";
import { getEnabledPoolIdsFromState, getAvailablePools } from "@/lib/poolEnabled";
import { readBlocks, type BlockEvent } from "@/lib/blocks";
import { SyncProgress } from "@/components/SyncProgress";
import { PoolControlButton } from "@/components/PoolControlButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PoolSummary {
  def: PoolDef;
  enabled: boolean;
  poolStats: Awaited<ReturnType<typeof getPoolStats>>;
  nodeInfo: Awaited<ReturnType<typeof getBlockchainInfo>> | null;
  blocks: BlockEvent[];
}

async function loadSummary(def: PoolDef, enabled: boolean): Promise<PoolSummary> {
  // Skip live RPC calls for disabled pools — containers aren't running so
  // there's nothing to query (and we don't want error spam).
  if (!enabled) {
    return { def, enabled: false, poolStats: null, nodeInfo: null, blocks: [] };
  }
  const [poolStats, nodeInfo, blocks] = await Promise.all([
    getPoolStats(def.id).catch(() => null),
    getBlockchainInfo(def.id).catch(() => null),
    readBlocks(def.id, 5).catch(() => [] as BlockEvent[]),
  ]);
  return { def, enabled: true, poolStats, nodeInfo, blocks };
}

function EnabledPoolTile({ s }: { s: PoolSummary }) {
  const stats = s.poolStats;
  const hr1m = parseHashrate(stats?.hashrate1m);
  const hr1h = parseHashrate(stats?.hashrate1hr);
  const hr1d = parseHashrate(stats?.hashrate1d);
  const live = (stats?.Workers ?? 0) > 0;
  const oursBlocks = s.blocks.filter((b) => b.ours);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 hover:border-amber-500 transition-colors">
      <Link href={`/?pool=${s.def.id}`} className="block">
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

        {s.nodeInfo && (
          <SyncProgress
            verificationprogress={s.nodeInfo.verificationprogress}
            blocks={s.nodeInfo.blocks}
            headers={s.nodeInfo.headers}
          />
        )}

        {oursBlocks.length > 0 && (
          <div className="mt-3 mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2">
            <div className="text-xs text-amber-300 font-semibold">
              🎉 {oursBlocks.length} block{oursBlocks.length > 1 ? "s" : ""} solved!
            </div>
            <div className="text-[11px] text-amber-200/80 mt-0.5">
              Most recent: #{oursBlocks[0].height.toLocaleString()} · {formatAgo(oursBlocks[0].ts)}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mt-3 mb-3">
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

      <div className="mt-3 pt-3 border-t border-slate-800">
        <PoolControlButton
          pool={s.def.id}
          enabled={true}
          displayName={s.def.displayName}
          fullName={s.def.fullName}
        />
      </div>
    </div>
  );
}

function DisabledPoolTile({ def }: { def: PoolDef }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-lg font-semibold text-slate-300">{def.fullName}</div>
          <div className="text-xs text-slate-500 uppercase tracking-wide">{def.displayName} pool</div>
        </div>
        <span className="text-xs text-slate-500">○ Not installed</span>
      </div>

      <p className="text-xs text-slate-500 mb-3">
        Run a solo {def.fullName} pool on your Umbrel. Point your SHA-256 miners at
        <span className="font-mono text-slate-400"> :{def.stratumPort}</span> and any
        block you find pays out to your address.
      </p>

      <PoolControlButton
        pool={def.id}
        enabled={false}
        displayName={def.displayName}
        fullName={def.fullName}
      />
    </div>
  );
}

function WelcomeBanner() {
  return (
    <div className="rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-500/15 to-slate-900/50 p-6 mb-2">
      <div className="text-xl font-bold text-amber-200 mb-2">Welcome to BK Mining 👋</div>
      <p className="text-sm text-slate-300 max-w-2xl">
        No pools are enabled yet. Pick a coin below to install — the dashboard will
        provision the node, start ckpool, and show you sync progress. You can add
        more coins later or disable any one without losing chain data.
      </p>
      <p className="text-xs text-slate-400 mt-2">
        Tip: enable one coin first to see how it works. BCH syncs the fastest
        (~250 GB), BTC is ~700 GB, DGB is ~30 GB.
      </p>
    </div>
  );
}

export default async function PoolsOverview() {
  // Universe of pools the dashboard knows about (POOLS env / poolRegistry).
  const universe = getEnabledPools();
  const universeIds = new Set<PoolId>(universe.map((p) => p.id));

  // Available IDs = same set, expressed as PoolIds for the "what can be
  // installed" list. State file says which of those the user opted into.
  const availableIds = getAvailablePools().filter((id) => universeIds.has(id));
  const enabledIds = new Set(await getEnabledPoolIdsFromState());

  const fresh = enabledIds.size === 0;

  const allDefs: PoolDef[] = availableIds.map(getPool);
  const summaries = await Promise.all(
    allDefs.map((def) => loadSummary(def, enabledIds.has(def.id)))
  );

  const enabledSummaries = summaries.filter((s) => s.enabled);
  const disabledDefs = allDefs.filter((d) => !enabledIds.has(d.id));

  return (
    <div className="space-y-8">
      {fresh && <WelcomeBanner />}

      {!fresh && (
        <div>
          <h1 className="text-lg font-semibold text-slate-200">All pools</h1>
          <p className="text-sm text-slate-400 mt-1">
            Tap a tile to open its detailed view. Disable any pool from here to stop
            its containers without losing chain data.
          </p>
        </div>
      )}

      {enabledSummaries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {enabledSummaries.map((s) => <EnabledPoolTile key={s.def.id} s={s} />)}
        </div>
      )}

      {disabledDefs.length > 0 && (
        <div>
          {enabledSummaries.length > 0 && (
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Available to install
            </h2>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {disabledDefs.map((d) => <DisabledPoolTile key={d.id} def={d} />)}
          </div>
        </div>
      )}

      {!fresh && (
        <div className="text-sm text-slate-400">
          <Link href="/blocks" className="text-amber-400 hover:underline">
            View solved-block log →
          </Link>
        </div>
      )}
    </div>
  );
}
