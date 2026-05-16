"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

// `node` covers bchn (BCH) and bitcoind (BTC); the API resolves it per-pool.
type Service = "ckpool" | "node";

export function RestartButton({ service, label }: { service: Service; label?: string }) {
  const params = useSearchParams();
  const pool = params.get("pool") || "bch";
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const display = label ?? (service === "ckpool"
    ? `${pool.toUpperCase()} ckpool`
    : (pool === "btc" ? "bitcoind" : "bchn"));

  async function onClick() {
    if (!confirm(`Restart ${display}?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/restart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service, pool }),
      });
      if (!res.ok) throw new Error(await res.text());
      setMsg("Restarted.");
    } catch (err) {
      setMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={onClick}
        disabled={busy}
        className="rounded-md border border-slate-700 hover:border-amber-500 hover:text-amber-400 px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {busy ? `Restarting ${display}…` : `Restart ${display}`}
      </button>
      {msg && <span className="text-xs text-slate-400">{msg}</span>}
    </div>
  );
}
