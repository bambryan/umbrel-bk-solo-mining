import { readBlocks, type BlockEvent } from "@/lib/blocks";
import { getEnabledPools, parsePoolId, type PoolDef } from "@/lib/poolRegistry";
import { getEnabledPoolIdsFromState } from "@/lib/poolEnabled";
import { formatAgo } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Row = { pool: PoolDef; b: BlockEvent };

type PageProps = { searchParams: Promise<{ pool?: string }> };

function StatTile({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className={"text-2xl font-semibold mt-1 " + (accent ? "text-amber-400" : "text-white")}>{value}</div>
    </div>
  );
}

export default async function BlocksPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  // 'all' (default) shows every pool; otherwise narrows to one.
  const showAll = !sp.pool || sp.pool === "all";
  const focusPool = showAll ? null : parsePoolId(sp.pool);
  // Filter universe by user-enabled state — disabled pools shouldn't have
  // their old block history surfaced here.
  const enabledIds = new Set(await getEnabledPoolIdsFromState());
  const pools = getEnabledPools().filter((p) => enabledIds.has(p.id));
  const visiblePools = focusPool ? pools.filter((p) => p.id === focusPool) : pools;

  // Pull up to 200 blocks per pool (more than enough at solo rates).
  const perPool = await Promise.all(
    visiblePools.map(async (p) => ({
      pool: p,
      blocks: await readBlocks(p.id, 200),
    }))
  );

  const allRows: Row[] = [];
  for (const { pool, blocks } of perPool) {
    for (const b of blocks) allRows.push({ pool, b });
  }
  allRows.sort((a, b) => b.b.ts - a.b.ts);

  const counts = perPool.map(({ pool, blocks }) => ({
    pool,
    total: blocks.length,
    ours: blocks.filter((b) => b.ours).length,
  }));
  const totalOurs = counts.reduce((s, c) => s + c.ours, 0);
  const newest = allRows.find((r) => r.b.ours);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-200">Solved blocks</h1>
          <p className="text-sm text-slate-400 mt-1">
            Detected from each ckpool's logs in real time and cross-verified against the chain.
            Click a row to open the block on a public explorer.
          </p>
        </div>
        {/* Per-pool filter pills */}
        <nav className="flex gap-1 text-xs">
          <a
            href="/blocks"
            className={
              "rounded-md px-2.5 py-1 border " +
              (showAll
                ? "border-amber-500 bg-amber-500/10 text-amber-400"
                : "border-slate-700 text-slate-300 hover:border-amber-500 hover:text-amber-400")
            }
          >
            All
          </a>
          {pools.map((p) => (
            <a
              key={p.id}
              href={`/blocks?pool=${p.id}`}
              className={
                "rounded-md px-2.5 py-1 border " +
                (focusPool === p.id
                  ? "border-amber-500 bg-amber-500/10 text-amber-400"
                  : "border-slate-700 text-slate-300 hover:border-amber-500 hover:text-amber-400")
              }
            >
              {p.displayName}
            </a>
          ))}
        </nav>
      </header>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Total blocks solved" value={totalOurs} accent={totalOurs > 0} />
        <StatTile label="Most recent" value={newest ? formatAgo(newest.b.ts) : "—"} />
        <StatTile label="Pools tracked" value={visiblePools.length} />
        <StatTile label="Detection sources" value="log + chain" />
      </div>

      {allRows.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 text-center">
          <div className="text-4xl mb-2">⛏️</div>
          <div className="text-slate-200 font-medium">No blocks solved yet</div>
          <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
            The moment any of your three pools solves a block, it appears here with a 🎉
            and persists across restarts. The watcher runs every 60s and uses two
            independent paths so a missed log doesn't lose a block.
          </p>
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
                <th className="px-3 py-2 text-left">Mine?</th>
                <th className="px-3 py-2 text-right">When</th>
              </tr>
            </thead>
            <tbody>
              {allRows.map(({ pool, b }) => (
                <tr
                  key={`${pool.id}-${b.height}-${b.hash}`}
                  className={
                    "border-t border-slate-800 " +
                    (b.ours ? "bg-amber-500/5 hover:bg-amber-500/10" : "hover:bg-slate-800/30")
                  }
                >
                  <td className="px-3 py-2 font-mono text-xs text-amber-400">{pool.displayName}</td>
                  <td className="px-3 py-2 text-right font-mono">{b.height.toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    <a
                      href={pool.explorerBlock(b.hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-300 hover:text-amber-400 underline decoration-dotted"
                      title={b.hash}
                    >
                      {b.hash.slice(0, 24)}…
                    </a>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">{b.source}</td>
                  <td className="px-3 py-2 text-xs">
                    {b.ours ? <span className="text-amber-400">🎉 yes</span> : <span className="text-slate-500">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-400 whitespace-nowrap">
                    {formatAgo(b.ts)}
                    <div className="text-[10px] text-slate-600">
                      {new Date(b.ts * 1000).toLocaleString()}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Storage: <code>data/snapshots/blocks-&lt;pool&gt;.jsonl</code> — append-only, deduped by height+hash.
      </p>
    </div>
  );
}
