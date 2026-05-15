"use client";

import { useState } from "react";

export function BtcsigForm({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/btcsig", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ btcsig: value }),
      });
      if (!res.ok) throw new Error(await res.text());
      setMsg("Saved. ckpool restarting…");
    } catch (err) {
      setMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="flex-1 rounded-md bg-slate-950 border border-slate-700 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
        placeholder="/solo mined by BK/"
      />
      <button
        type="submit"
        disabled={saving || value.trim() === ""}
        className="rounded-md bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-semibold px-4 py-2 text-sm"
      >
        {saving ? "Saving…" : "Save + Restart ckpool"}
      </button>
      {msg && <span className="text-sm text-slate-300">{msg}</span>}
    </form>
  );
}
