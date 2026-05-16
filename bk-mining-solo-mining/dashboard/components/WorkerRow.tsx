"use client";

import { useState } from "react";
import type { WorkerStats } from "@/lib/ckpool";
import { parseHashrate, formatHashrate, formatSI, formatAgo } from "@/lib/format";

type Props = { worker: WorkerStats };

function StatPill({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-white mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export function WorkerRow({ worker }: Props) {
  const [open, setOpen] = useState(false);
  const hot = parseHashrate(worker.hashrate1m) > 0;
  const sinceLast = worker.lastshare
    ? Math.max(0, Math.floor(Date.now() / 1000) - worker.lastshare)
    : null;

  return (
    <>
      <tr
        onClick={() => setOpen((o) => !o)}
        className="border-t border-slate-800 odd:bg-slate-900/30 cursor-pointer hover:bg-slate-800/40"
      >
        <td className="px-3 py-2 font-mono text-xs">
          <span className={hot ? "text-emerald-400" : "text-slate-500"}>●</span>{" "}
          <span className="text-slate-300">{open ? "▾" : "▸"}</span>{" "}
          {worker.workername}
        </td>
        <td className="px-3 py-2 text-right">{formatHashrate(parseHashrate(worker.hashrate1m))}</td>
        <td className="px-3 py-2 text-right">{formatHashrate(parseHashrate(worker.hashrate5m))}</td>
        <td className="px-3 py-2 text-right">{formatHashrate(parseHashrate(worker.hashrate1hr))}</td>
        <td className="px-3 py-2 text-right">{formatHashrate(parseHashrate(worker.hashrate1d))}</td>
        <td className="px-3 py-2 text-right">{formatSI(worker.bestshare)}</td>
        <td className="px-3 py-2 text-right text-slate-400">{formatAgo(worker.lastshare)}</td>
      </tr>
      {open && (
        <tr className="border-t border-slate-800 bg-slate-950/40">
          <td colSpan={7} className="px-4 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <StatPill label="1m" value={formatHashrate(parseHashrate(worker.hashrate1m))} />
              <StatPill label="5m" value={formatHashrate(parseHashrate(worker.hashrate5m))} />
              <StatPill label="1h" value={formatHashrate(parseHashrate(worker.hashrate1hr))} />
              <StatPill label="1d" value={formatHashrate(parseHashrate(worker.hashrate1d))} />
              <StatPill label="7d" value={formatHashrate(parseHashrate(worker.hashrate7d))} />
              <StatPill
                label="Shares submitted"
                value={worker.shares != null ? worker.shares.toLocaleString() : "—"}
                sub={worker.shares != null ? formatSI(worker.shares) : undefined}
              />
              <StatPill
                label="Best share (recent)"
                value={formatSI(worker.bestshare)}
                sub={worker.bestshare != null ? worker.bestshare.toLocaleString() : undefined}
              />
              <StatPill
                label="Best ever"
                value={formatSI(worker.bestever)}
                sub={worker.bestever != null ? worker.bestever.toLocaleString() : undefined}
              />
              <StatPill
                label="Last share"
                value={formatAgo(worker.lastshare)}
                sub={
                  worker.lastshare
                    ? new Date(worker.lastshare * 1000).toLocaleString()
                    : "never"
                }
              />
              <StatPill
                label="Status"
                value={hot ? "Mining" : sinceLast != null && sinceLast > 600 ? "Stale" : "Idle"}
                sub={hot ? "Submitting shares" : sinceLast != null ? `${sinceLast}s since last share` : "—"}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
