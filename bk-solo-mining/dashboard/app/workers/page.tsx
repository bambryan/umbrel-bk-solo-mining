import { getUsers, getWorkers, parseHashrate, formatHashrate, formatAgo } from "@/lib/ckpool";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function WorkersPage() {
  const users = await getUsers();
  const byUser = await Promise.all(
    users.map(async (u) => ({
      address: u.address,
      stats: u.stats,
      workers: await getWorkers(u.address),
    }))
  );

  return (
    <div className="space-y-8">
      {byUser.length === 0 && (
        <p className="text-slate-400">
          No users have connected yet. Point a miner at{" "}
          <code className="text-amber-400">stratum+tcp://&lt;umbrel-ip&gt;:4567</code>
          {" "}with any BCH address as the username.
        </p>
      )}

      {byUser.map((u) => (
        <section key={u.address}>
          <header className="mb-3">
            <div className="font-mono text-xs text-amber-400 break-all">{u.address}</div>
            <div className="text-sm text-slate-300 mt-1">
              {formatHashrate(parseHashrate(u.stats.hashrate1m))} (1m) ·{" "}
              {formatHashrate(parseHashrate(u.stats.hashrate1hr))} (1h) ·{" "}
              {u.stats.workers} workers ·{" "}
              best ever {u.stats.bestever?.toLocaleString() ?? "—"}
            </div>
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
                  .map((w) => {
                    const hot = parseHashrate(w.hashrate1m) > 0;
                    return (
                      <tr
                        key={w.workername}
                        className="border-t border-slate-800 odd:bg-slate-900/30"
                      >
                        <td className="px-3 py-2 font-mono text-xs">
                          <span className={hot ? "text-emerald-400" : "text-slate-500"}>●</span>{" "}
                          {w.workername}
                        </td>
                        <td className="px-3 py-2 text-right">{formatHashrate(parseHashrate(w.hashrate1m))}</td>
                        <td className="px-3 py-2 text-right">{formatHashrate(parseHashrate(w.hashrate5m))}</td>
                        <td className="px-3 py-2 text-right">{formatHashrate(parseHashrate(w.hashrate1hr))}</td>
                        <td className="px-3 py-2 text-right">{formatHashrate(parseHashrate(w.hashrate1d))}</td>
                        <td className="px-3 py-2 text-right">{w.bestshare?.toLocaleString() ?? "—"}</td>
                        <td className="px-3 py-2 text-right text-slate-400">
                          {formatAgo(w.lastshare)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
