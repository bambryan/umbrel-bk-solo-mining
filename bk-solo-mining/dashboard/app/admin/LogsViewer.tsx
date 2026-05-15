"use client";

import { useEffect, useState } from "react";

export function LogsViewer() {
  const [service, setService] = useState<"ckpool" | "bchn">("ckpool");
  const [logs, setLogs] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function load(svc: "ckpool" | "bchn") {
    setLoading(true);
    try {
      const res = await fetch(`/api/logs?service=${svc}&tail=300`);
      setLogs(await res.text());
    } catch (err) {
      setLogs(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(service); }, [service]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <select
          value={service}
          onChange={(e) => setService(e.target.value as "ckpool" | "bchn")}
          className="rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-sm"
        >
          <option value="ckpool">ckpool</option>
          <option value="bchn">bchn</option>
        </select>
        <button
          onClick={() => load(service)}
          disabled={loading}
          className="rounded-md border border-slate-700 hover:border-amber-500 px-3 py-1 text-sm disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>
      <pre className="max-h-[480px] overflow-auto rounded-md bg-slate-950 border border-slate-800 p-3 text-xs font-mono whitespace-pre-wrap text-slate-300">
        {logs || "(no logs)"}
      </pre>
    </div>
  );
}
