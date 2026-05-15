"use client";

import { useState } from "react";

export function RestartButton({ service }: { service: "ckpool" | "bchn" }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onClick() {
    if (!confirm(`Restart ${service}?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/restart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service }),
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
        {busy ? `Restarting ${service}…` : `Restart ${service}`}
      </button>
      {msg && <span className="text-xs text-slate-400">{msg}</span>}
    </div>
  );
}
