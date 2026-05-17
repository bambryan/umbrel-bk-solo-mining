"use client";

import { useState } from "react";
import { type PoolId } from "@/lib/poolRegistry";

type Props = {
  pool: PoolId;
  enabled: boolean;
  fullName: string;
  displayName: string;
};

// Inline control on each pool tile. When disabled, opens an "Add to mining"
// form prompting for payout address. When enabled, single button to disable.
export function PoolControlButton({ pool, enabled, fullName, displayName }: Props) {
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [addr, setAddr] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const addrPlaceholder = pool === "btc" ? "1… / 3… / bc1…"
                       : pool === "dgb" ? "D… / S… / dgb1…"
                       : "1… / 3… / bitcoincash:…";

  async function onEnable(e: React.MouseEvent | React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!addr.trim()) { setErr("Payout address required"); return; }
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/pools/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pool, btcaddress: addr.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      window.location.reload();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  }

  async function onDisable(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Disable ${fullName} mining?\n\nContainers will stop but chain data + config are preserved. Re-enable any time.`)) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/pools/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pool }),
      });
      if (!res.ok) throw new Error(await res.text());
      window.location.reload();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  }

  if (enabled) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-emerald-400 text-xs">● Enabled</span>
        <button
          onClick={onDisable}
          disabled={busy}
          className="text-xs text-slate-400 hover:text-red-400 underline decoration-dotted disabled:opacity-50"
        >
          {busy ? "Disabling…" : "disable"}
        </button>
        {err && <span className="text-xs text-red-400 ml-2">{err}</span>}
      </div>
    );
  }

  if (!showForm) {
    return (
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowForm(true); }}
        className="rounded-md border border-amber-500/60 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-xs px-3 py-1.5 font-medium"
      >
        + Add {displayName} mining
      </button>
    );
  }

  return (
    <form
      onSubmit={onEnable}
      onClick={(e) => e.stopPropagation()}
      className="space-y-2 mt-2"
    >
      <div className="text-xs text-slate-300">
        Payout address for {displayName} blocks:
      </div>
      <input
        autoFocus
        value={addr}
        onChange={(e) => setAddr(e.target.value.trim())}
        placeholder={addrPlaceholder}
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-md bg-slate-950 border border-slate-700 px-2 py-1.5 font-mono text-xs"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs px-3 py-1.5 disabled:opacity-50"
        >
          {busy ? "Starting…" : "Install & start"}
        </button>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowForm(false); setErr(null); }}
          disabled={busy}
          className="text-xs text-slate-400 hover:text-slate-200"
        >
          cancel
        </button>
        {err && <span className="text-xs text-red-400">{err}</span>}
      </div>
      <div className="text-[11px] text-slate-500">
        First-time install starts chain download. Can take several hours.
      </div>
    </form>
  );
}
