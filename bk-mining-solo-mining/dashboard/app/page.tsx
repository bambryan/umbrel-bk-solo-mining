import { Suspense } from "react";
import { getPoolStats, parseHashrate, formatHashrate, formatSI, formatAgo } from "@/lib/ckpool";
import { getBlockchainInfo, getNetworkInfo, getMempoolInfo } from "@/lib/bchn";
import { readSeries, parseWindow } from "@/lib/history";
import { SparkCard } from "@/components/SparkCard";
import { WindowSelector } from "@/components/WindowSelector";

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

// Server-side helper to seed each SparkCard with a starting series so the
// first paint has shape, not just a flat dashed baseline.
async function seedSeries(metric: string, windowSec: number): Promise<number[]> {
  const rows = await readSeries(windowSec);
  return rows.map((r) => {
    const v = (r as Record<string, unknown>)[metric];
    return typeof v === "number" ? v : 0;
  });
}

type PageProps = { searchParams: Promise<{ w?: string }> };

export default async function Overview({ searchParams }: PageProps) {
  const sp = await searchParams;
  const windowSec = parseWindow(sp.w);

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

  const hr1m = parseHashrate(poolStats?.hashrate1m);
  const hr1h = parseHashrate(poolStats?.hashrate1hr);
  const hr1d = parseHashrate(poolStats?.hashrate1d);
  const networkHashrate = bchInfo ? (bchInfo.difficulty * 2 ** 32) / 600 : 0;
  const dailyOdds = networkHashrate > 0 ? (hr1h * 86400) / (networkHashrate * 600) : 0;

  // Seed all sparklines in parallel from the rolling history file.
  const [s_hr1m, s_hr1h, s_hr1d, s_workers, s_accepted, s_rejected, s_best, s_sps, s_diff] =
    await Promise.all([
      seedSeries("hr1m", windowSec),
      seedSeries("hr1h", windowSec),
      seedSeries("hr1d", windowSec),
      seedSeries("workers", windowSec),
      seedSeries("accepted", windowSec),
      seedSeries("rejected", windowSec),
      seedSeries("bestshare", windowSec),
      seedSeries("sps1m", windowSec),
      seedSeries("diff", windowSec),
    ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-200">Pool</h1>
        <Suspense fallback={null}><WindowSelector /></Suspense>
      </div>

      <section>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Suspense fallback={null}>
            <SparkCard
              label="1m hashrate"
              metric="hr1m"
              initialSeries={s_hr1m}
              initialValue={formatHashrate(hr1m)}
              format={(n) => formatHashrate(n ?? 0)}
              color="#22d3ee"
            />
            <SparkCard
              label="1h hashrate"
              metric="hr1h"
              initialSeries={s_hr1h}
              initialValue={formatHashrate(hr1h)}
              format={(n) => formatHashrate(n ?? 0)}
              color="#ec4899"
            />
            <SparkCard
              label="1d hashrate"
              metric="hr1d"
              initialSeries={s_hr1d}
              initialValue={formatHashrate(hr1d)}
              format={(n) => formatHashrate(n ?? 0)}
              color="#a78bfa"
            />
            <SparkCard
              label="Workers"
              metric="workers"
              initialSeries={s_workers}
              initialValue={poolStats ? `${poolStats.Workers}` : "—"}
              format={(n) => (n == null ? "—" : `${Math.round(n)}`)}
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
            <SparkCard
              label="Accepted"
              metric="accepted"
              initialSeries={s_accepted}
              initialValue={formatSI(poolStats?.accepted)}
              format={(n) => formatSI(n)}
              sub={poolStats ? poolStats.accepted.toLocaleString() : undefined}
              color="#22d3ee"
            />
            <SparkCard
              label="Rejected"
              metric="rejected"
              initialSeries={s_rejected}
              initialValue={formatSI(poolStats?.rejected)}
              format={(n) => formatSI(n)}
              sub={poolStats ? poolStats.rejected.toLocaleString() : undefined}
              color="#f87171"
            />
            <SparkCard
              label="Best share"
              metric="bestshare"
              initialSeries={s_best}
              initialValue={formatSI(poolStats?.bestshare)}
              format={(n) => formatSI(n)}
              sub={poolStats ? poolStats.bestshare.toLocaleString() : undefined}
              color="#fbbf24"
            />
            <SparkCard
              label="SPS (1m)"
              metric="sps1m"
              initialSeries={s_sps}
              initialValue={poolStats ? poolStats.SPS1m.toFixed(2) : "—"}
              format={(n) => (n == null ? "—" : n.toFixed(2))}
              color="#a78bfa"
            />
          </Suspense>
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
          <Suspense fallback={null}>
            <SparkCard
              label="Network difficulty"
              metric="diff"
              initialSeries={s_diff}
              initialValue={formatSI(bchInfo?.difficulty)}
              format={(n) => formatSI(n)}
              sub={bchInfo ? bchInfo.difficulty.toExponential(3) : undefined}
              color="#f59e0b"
            />
          </Suspense>
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
        Sparklines auto-refresh every 30s while the tab is visible. Sampler writes one row per minute.
      </p>
    </div>
  );
}
