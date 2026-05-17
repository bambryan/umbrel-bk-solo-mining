import { redirect } from "next/navigation";
import { getPoolSettings } from "@/lib/ckpoolConfig";
import { parsePoolId, getPool } from "@/lib/poolRegistry";
import { getEnabledPoolIdsFromState } from "@/lib/poolEnabled";
import { PoolSettingsForm } from "./PoolSettingsForm";
import { RestartButton } from "./RestartButton";
import { LogsViewer } from "./LogsViewer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = { searchParams: Promise<{ pool?: string }> };

export default async function AdminPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const enabledIds = await getEnabledPoolIdsFromState();
  if (enabledIds.length === 0) redirect("/pools");
  const requested = parsePoolId(sp.pool);
  const pool = enabledIds.includes(requested) ? requested : enabledIds[0];
  const poolDef = getPool(pool);
  const settings = await getPoolSettings(pool).catch(() => null);
  const nodeLabel = pool === "btc" ? "bitcoind" : "bchn";

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <header className="mb-4">
          <h2 className="text-lg font-semibold text-slate-200">
            {poolDef.fullName} pool settings
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Saving writes <code className="text-amber-400">ckpool.conf</code> + the{" "}
            <code className="text-amber-400">_use_miner_username</code> sentinel, then restarts
            {" "}{poolDef.displayName} ckpool. Miners auto-reconnect within seconds.
            {" "}{nodeLabel} is not touched.
          </p>
        </header>
        {settings ? (
          <PoolSettingsForm initial={settings} pool={pool} />
        ) : (
          <p className="text-sm text-slate-400">
            {poolDef.displayName} ckpool config not found yet — install the pool first.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-lg font-semibold mb-1 text-slate-200">Restart services</h2>
        <p className="text-sm text-slate-400 mb-3">
          ckpool restart ≈ 5s downtime; miners auto-reconnect. {nodeLabel} restart ≈
          30–60s while it reloads chainstate.
        </p>
        <div className="flex gap-3">
          <RestartButton service="ckpool" />
          <RestartButton service="node" />
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-lg font-semibold mb-3 text-slate-200">Logs</h2>
        <LogsViewer />
      </section>
    </div>
  );
}
