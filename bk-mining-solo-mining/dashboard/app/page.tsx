import { getPoolStats, parseHashrate, formatHashrate, formatSI, formatAgo } from "@/lib/ckpool";
import { getBlockchainInfo, getNetworkInfo, getMempoolInfo } from "@/lib/bchn";

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

export default async function Overview() {
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

  const hashrate1m = parseHashrate(poolStats?.hashrate1m);
  const hashrate1hr = parseHashrate(poolStats?.hashrate1hr);
  const hashrate1d = parseHashrate(poolStats?.hashrate1d);

  // Solo "luck": odds of finding a block per day = my_hashrate / network_hashrate
  // network_hashrate ≈ difficulty * 2^32 / blocktime, BCH blocktime = 600s
  const networkHashrate = bchInfo ? (bchInfo.difficulty * 2 ** 32) / 600 : 0;
  const dailyOdds = networkHashrate > 0 ? (hashrate1hr * 86400) / (networkHashrate * 600) : 0;

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-lg font-semibold mb-3 text-slate-200">Pool</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="1m hashrate" value={formatHashrate(hashrate1m)} />
          <StatCard label="1h hashrate" value={formatHashrate(hashrate1hr)} />
          <StatCard label="1d hashrate" value={formatHashrate(hashrate1d)} />
          <StatCard
            label="Workers"
            value={poolStats ? `${poolStats.Workers}` : "—"}
            sub={poolStats ? `${poolStats.Idle} idle · ${poolStats.Disconnected} disconnected` : undefined}
          />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3 text-slate-200">Shares</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Accepted" value={formatSI(poolStats?.accepted)} sub={poolStats ? poolStats.accepted.toLocaleString() : undefined} />
          <StatCard label="Rejected" value={formatSI(poolStats?.rejected)} sub={poolStats ? poolStats.rejected.toLocaleString() : undefined} />
          <StatCard label="Best share" value={formatSI(poolStats?.bestshare)} sub={poolStats ? poolStats.bestshare.toLocaleString() : undefined} />
          <StatCard label="SPS (1m)" value={poolStats ? poolStats.SPS1m.toFixed(2) : "—"} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3 text-slate-200">Chain</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Block height"
            value={bchInfo ? bchInfo.blocks.toLocaleString() : "—"}
            sub={bchInfo?.headers ? `headers ${bchInfo.headers.toLocaleString()}` : undefined}
          />
          <StatCard
            label="Network difficulty"
            value={formatSI(bchInfo?.difficulty)}
            sub={bchInfo ? bchInfo.difficulty.toExponential(3) : undefined}
          />
          <StatCard
            label="Network hashrate"
            value={networkHashrate ? formatHashrate(networkHashrate) : "—"}
          />
          <StatCard
            label="Peers"
            value={bchNet ? `${bchNet.connections}` : "—"}
            sub={bchNet?.subversion}
          />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3 text-slate-200">Solo odds (very rough)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <StatCard
            label="Daily block probability"
            value={dailyOdds ? `${(dailyOdds * 100).toFixed(2)}%` : "—"}
            sub={
              dailyOdds
                ? `≈ 1 block every ${(1 / dailyOdds).toFixed(0)} days at current 1h hashrate`
                : undefined
            }
          />
          <StatCard
            label="Mempool"
            value={bchMempool ? `${bchMempool.size.toLocaleString()} txs` : "—"}
            sub={bchMempool ? `${(bchMempool.bytes / 1e6).toFixed(2)} MB` : undefined}
          />
          <StatCard
            label="Pool runtime"
            value={poolStats ? `${(poolStats.runtime / 3600).toFixed(1)}h` : "—"}
            sub={poolStats ? `updated ${formatAgo(poolStats.lastupdate)}` : undefined}
          />
        </div>
      </section>

      <p className="text-xs text-slate-500">
        Stats auto-refresh on page reload. ckpool writes to disk every 60s.
      </p>
    </div>
  );
}
