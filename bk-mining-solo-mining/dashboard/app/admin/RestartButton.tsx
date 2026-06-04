"use client";

import { useState } from "react";

// `ckpool` targets a single stratum instance (instanceId); `node` targets a
// coin's shared node (pool).
type Service = "ckpool" | "node";

export function RestartButton({
  service,
  instanceId,
  pool,
  label,
}: {
  service: Service;
  instanceId?: string;
  pool?: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const display = label ?? (service === "ckpool" ? `${instanceId} ckpool` : "node");

  async function onClick() {
    if (!confirm(`Restart ${display}?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const body =
        service === "ckpool"
          ? { service, instance: instanceId }
          : { service, pool };
      const res = await fetch("/api/restart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
