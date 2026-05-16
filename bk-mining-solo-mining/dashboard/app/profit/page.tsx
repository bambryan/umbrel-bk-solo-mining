import { computeAllProfits } from "@/lib/profitability";
import { formatHashrate, formatSI } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function fmtUsd(n: number): string {
  if (!isFinite(n) || n === 0) return "$0.00";
  if (n < 0.01) return "$" + n.toFixed(6);
  if (n < 1) return "$" + n.toFixed(4);
  if (n < 100) return "$" + n.toFixed(2);
  return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtUsdSmall(n: number): string {
  // For prices like DGB at $0.01x
  if (n >= 1) return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 0.01) return "$" + n.toFixed(4);
  return "$" + n.toFixed(6);
}

function fmtPct(p: number): string {
  const sign = p > 0 ? "+" : "";
  return sign + p.toFixed(2) + "%";
}

export default async function ProfitPage() {
  const profits = await computeAllProfits();

  // Rank by $/day (best first); only meaningful pools.
  const ranked = profits
    .filter((p) => p.available)
    .sort((a, b) => b.dailyUsd - a.dailyUsd);
  const winner = ranked[0];
  const runnerUp = ranked[1];
  const winnerEdgePct = winner && runnerUp && runnerUp.dailyUsd > 0
    ? ((winner.dailyUsd - runnerUp.dailyUsd) / runnerUp.dailyUsd) * 100
    : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-lg font-semibold text-slate-200">Profitability</h1>
        <p className="text-sm text-slate-400 mt-1">
          Expected USD/day per coin at your current hashrate. <span className="text-amber-400/80">Honest caveat:</span>{" "}
          solo mining variance is huge — these are statistical averages, not guaranteed earnings. Useful for picking
          where to point rigs when conditions shift.
        </p>
      </header>

      {winner && winner.dailyUsd > 0 && (
        <div className="rounded-lg border border-amber-500/60 bg-gradient-to-r from-amber-500/15 to-amber-500/5 px-4 py-3">
          <div className="text-amber-300 font-semibold">
            ⭐ Best right now: {winner.poolName} ({winner.pool.toUpperCase()})
            {" — "}
            <span className="font-mono">{fmtUsd(winner.dailyUsd)}/day</span>
            {winnerEdgePct !== null && winnerEdgePct > 0 && (
              <span className="text-amber-400/80 text-sm font-normal ml-2">
                ({winnerEdgePct.toFixed(0)}% better than {runnerUp!.pool.toUpperCase()})
              </span>
            )}
          </div>
          <div className="text-xs text-amber-200/70 mt-1">
            Point your SHA-256d rigs at <code className="text-amber-300">stratum+tcp://&lt;host&gt;:{
              winner.pool === "bch" ? "4567" : winner.pool === "btc" ? "7890" : "5678"
            }</code> for max expected return.
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 text-left">Coin</th>
              <th className="px-3 py-2 text-right">Your hashrate (1h)</th>
              <th className="px-3 py-2 text-right">Network hash</th>
              <th className="px-3 py-2 text-right">Your share</th>
              <th className="px-3 py-2 text-right">Block reward</th>
              <th className="px-3 py-2 text-right">Price (24h)</th>
              <th className="px-3 py-2 text-right">$/day (est)</th>
            </tr>
          </thead>
          <tbody>
            {profits.map((p) => {
              const share = p.networkHashrate > 0 ? (p.hashrate1h / p.networkHashrate) : 0;
              const isWinner = winner && p.pool === winner.pool;
              return (
                <tr
                  key={p.pool}
                  className={
                    "border-t border-slate-800 " +
                    (isWinner ? "bg-amber-500/5" : "")
                  }
                >
                  <td className="px-3 py-2">
                    <div className="font-semibold text-white">{p.poolName}</div>
                    <div className="text-xs text-slate-500">{p.pool.toUpperCase()}</div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{formatHashrate(p.hashrate1h)}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatHashrate(p.networkHashrate)}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {share > 0 ? (share * 100).toExponential(2) + "%" : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className="font-mono">{p.blockReward.toFixed(p.blockReward < 10 ? 3 : 1)}</span>
                    <span className="text-slate-500 text-xs ml-1">{p.pool.toUpperCase()}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="font-mono">{fmtUsdSmall(p.priceUsd)}</div>
                    <div className={"text-xs " + (p.priceChange24h >= 0 ? "text-emerald-400/80" : "text-red-400/80")}>
                      {fmtPct(p.priceChange24h)}
                    </div>
                  </td>
                  <td className={"px-3 py-2 text-right font-mono " + (isWinner ? "text-amber-400 font-semibold" : "text-white")}>
                    {fmtUsd(p.dailyUsd)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Per-pool notes / warnings */}
      {profits.some((p) => p.note) && (
        <div className="text-xs text-slate-500 space-y-1">
          {profits.filter((p) => p.note).map((p) => (
            <div key={p.pool}>
              <span className="text-slate-400">{p.pool.toUpperCase()}:</span> {p.note}
            </div>
          ))}
        </div>
      )}

      <div className="text-xs text-slate-500 border-t border-slate-800 pt-3 space-y-1">
        <div>
          <strong>Formula:</strong>{" "}
          <code>(your_hashrate / network_hashrate) × (86400 / block_time) × block_reward × price_usd</code>
        </div>
        <div>
          <strong>DGB network hash</strong> is the SHA-256d-only portion (DGB has 5 algos sharing a chain with
          ~75s per-algo target). BTC/BCH are single-algo at 600s.
        </div>
        <div>
          <strong>Price source:</strong> CoinGecko free tier (cached 5 min). <strong>Rewards:</strong> current
          coin schedule (BCH/BTC: 3.125 post-April-2024 halving; DGB: ~535).
        </div>
      </div>
    </div>
  );
}
