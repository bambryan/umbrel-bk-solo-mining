import { readConfig } from "@/lib/ckpoolConfig";
import { BtcsigForm } from "./BtcsigForm";
import { RestartButton } from "./RestartButton";
import { LogsViewer } from "./LogsViewer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  const cfg = await readConfig();
  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-lg font-semibold mb-1 text-slate-200">Coinbase signature</h2>
        <p className="text-sm text-slate-400 mb-3">
          Goes into the coinbase tx of any block we solve — visible on block
          explorers. Wrap with slashes, e.g. <code className="text-amber-400">/solo mined by BK/</code>.
          Changing this restarts ckpool (miners auto-reconnect in seconds).
        </p>
        <BtcsigForm initial={cfg.btcsig} />
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-lg font-semibold mb-1 text-slate-200">Payout address</h2>
        <p className="text-sm text-slate-400 mb-3">
          All solo-mined coinbase rewards go directly to this address. Change
          requires editing <code className="text-amber-400">data/ckpool/config/ckpool.conf</code>{" "}
          on the host and restarting ckpool — not changeable from here on purpose.
        </p>
        <code className="block break-all text-amber-400">{cfg.btcaddress}</code>
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
