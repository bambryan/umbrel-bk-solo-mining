import { getUsers, getWorkers } from "@/lib/ckpool";
import { parseHashrate, formatHashrate, formatSI } from "@/lib/format";
import { parsePoolId, getPool } from "@/lib/poolRegistry";
import { WorkerRow } from "@/components/WorkerRow";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = { searchParams: Promise<{ pool?: string }> };

export default async function WorkersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const pool = parsePoolId(sp.pool);
  const poolDef = getPool(pool);

  const users = await getUsers(pool);
  const byUser = await Promise.all(
    users.map(async (u) => ({
      address: u.address,
      stats: u.stats,
      workers: await getWorkers(u.address, pool),
    }))
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-lg font-semibold text-slate-200">{poolDef.fullName} workers</h1>
      </header>

      {byUser.length === 0 && (
        <p className="text-slate-400">
          No {poolDef.displayName} users have connected yet. Point a miner at{" "}
          <code className="text-amber-400">stratum+tcp://&lt;umbrel-ip&gt;:{poolDef.stratumPort}</code>
          {" "}with any {poolDef.displayName} address as the username.
        </p>
      )}

      {byUser.map((u) => (
        <section key={u.address}>
          <header className="mb-3">
            <div className="font-mono text-xs text-amber-400 break-all">{u.address}</div>
            <div className="text-sm text-slate-300 mt-1">
              {formatHashrate(parseHashrate(u.stats.hashrate1m))} (1m) ·{" "}
              {formatHashrate(parseHashrate(u.stats.hashrate1hr))} (1h) ·{" "}
              {u.workers.length} workers ·{" "}
              best ever {formatSI(u.stats.bestever)}
            </div>
            <div className="text-xs text-slate-500 mt-1">Click a worker for details.</div>
          </header>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2 text-left">Worker</th>
                  <th className="px-3 py-2 text-right">1m</th>
                  <th className="px-3 py-2 text-right">5m</th>
                  <th className="px-3 py-2 text-right">1h</th>
                  <th className="px-3 py-2 text-right">1d</th>
                  <th className="px-3 py-2 text-right">Best</th>
                  <th className="px-3 py-2 text-right">Last share</th>
                </tr>
              </thead>
              <tbody>
                {u.workers
                  .slice()
                  .sort((a, b) => parseHashrate(b.hashrate1hr) - parseHashrate(a.hashrate1hr))
                  .map((w) => (
                    <WorkerRow key={w.workername} worker={w} />
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
