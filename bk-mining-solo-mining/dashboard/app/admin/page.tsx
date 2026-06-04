import { redirect } from "next/navigation";
import Link from "next/link";
import { getPoolSettings } from "@/lib/ckpoolConfig";
import { getEnabledPoolIds, getInstances, getInstance, getPool } from "@/lib/poolRegistry";
import { PoolSettingsForm } from "./PoolSettingsForm";
import { RestartButton } from "./RestartButton";
import { LogsViewer } from "./LogsViewer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = { searchParams: Promise<{ instance?: string }> };

export default async function AdminPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const instances = getEnabledPoolIds().flatMap(getInstances);
  if (instances.length === 0) redirect("/pools");
  const selected = getInstance(sp.instance || "") || instances[0];
  const coin = getPool(selected.coin);
  const settings = await getPoolSettings(selected.id).catch(() => null);
  const nodeLabel = selected.coin === "btc" ? "bitcoind" : selected.coin === "dgb" ? "digibyted" : "bchn";

  return (
    <div className="space-y-8">
      {/* Each stratum instance (low / high per coin) is managed separately. */}
      <nav className="flex flex-wrap gap-2">
        {instances.map((i) => {
          const active = i.id === selected.id;
          return (
            <Link
              key={i.id}
              href={`/admin?instance=${i.id}`}
              className={
                active
                  ? "rounded-md bg-amber-500 text-slate-950 font-semibold px-3 py-1.5 text-sm"
                  : "rounded-md border border-slate-700 hover:border-amber-500 hover:text-amber-400 px-3 py-1.5 text-sm"
              }
            >
              {i.coin.toUpperCase()} · {i.label}
              <span className="opacity-60"> :{i.stratumPort}</span>
            </Link>
          );
        })}
      </nav>

      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <header className="mb-4">
          <h2 className="text-lg font-semibold text-slate-200">
            {coin.fullName} — {selected.label}{" "}
            <span className="text-slate-500 text-sm font-mono">:{selected.stratumPort}</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Saving writes this instance&apos;s <code className="text-amber-400">ckpool.conf</code> and restarts
            only the <code className="text-amber-400">{selected.id}</code> ckpool — miners reconnect within
            seconds. The {nodeLabel} node and the coin&apos;s other instance are not touched.
          </p>
        </header>
        {settings ? (
          <PoolSettingsForm initial={settings} instanceId={selected.id} coin={selected.coin} />
        ) : (
          <p className="text-sm text-slate-400">
            {selected.id} ckpool config not found yet — start the instance first.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-lg font-semibold mb-1 text-slate-200">Restart services</h2>
        <p className="text-sm text-slate-400 mb-3">
          ckpool restart ≈ 5s downtime on <code className="text-amber-400">{selected.id}</code> only.
          {" "}{nodeLabel} restart ≈ 30–60s and affects <em>all</em> of {selected.coin.toUpperCase()}&apos;s instances.
        </p>
        <div className="flex gap-3">
          <RestartButton service="ckpool" instanceId={selected.id} label={`${selected.coin.toUpperCase()} ${selected.label} ckpool`} />
          <RestartButton service="node" pool={selected.coin} label={nodeLabel} />
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-lg font-semibold mb-3 text-slate-200">Logs</h2>
        <LogsViewer />
      </section>
    </div>
  );
}
