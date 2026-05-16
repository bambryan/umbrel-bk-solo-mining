import { getPoolSettings } from "@/lib/ckpoolConfig";
import { PoolSettingsForm } from "./PoolSettingsForm";
import { RestartButton } from "./RestartButton";
import { LogsViewer } from "./LogsViewer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  const settings = await getPoolSettings();

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <header className="mb-4">
          <h2 className="text-lg font-semibold text-slate-200">Pool settings</h2>
          <p className="text-sm text-slate-400 mt-1">
            Saving writes <code className="text-amber-400">ckpool.conf</code> + the{" "}
            <code className="text-amber-400">_use_miner_username</code> sentinel, then restarts
            ckpool. Miners auto-reconnect within seconds. bchn is not touched.
          </p>
        </header>
        <PoolSettingsForm initial={settings} />
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-lg font-semibold mb-1 text-slate-200">Restart services</h2>
        <p className="text-sm text-slate-400 mb-3">
          ckpool restart ≈ 5s downtime; miners auto-reconnect. bchn restart ≈
          30–60s while it reloads chainstate.
        </p>
        <div className="flex gap-3">
          <RestartButton service="ckpool" />
          <RestartButton service="bchn" />
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-lg font-semibold mb-3 text-slate-200">Logs</h2>
        <LogsViewer />
      </section>
    </div>
  );
}
