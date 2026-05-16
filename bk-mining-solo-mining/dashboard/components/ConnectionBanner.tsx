"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

// Top-of-page strip showing the stratum URL miners point at, with one-click
// copy. Host comes from the browser's current location (so the URL always
// matches however the user reached the dashboard — LAN IP, hostname,
// reverse proxy, etc.). Port comes from /api/stratum, scoped to the
// currently-selected pool (?pool=bch|btc).

export function ConnectionBanner() {
  const params = useSearchParams();
  const pool = params.get("pool") || "bch";
  const [port, setPort] = useState<number | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [host, setHost] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setHost(window.location.hostname);
  }, []);

  useEffect(() => {
    setPort(null);
    fetch(`/api/stratum?pool=${pool}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { port: number; displayName?: string }) => {
        setPort(d.port);
        setDisplayName(d.displayName || pool.toUpperCase());
      })
      .catch(() => setPort(null));
  }, [pool]);

  const url = host && port ? `stratum+tcp://${host}:${port}` : "";

  async function onCopy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — some browsers reject without HTTPS context
    }
  }

  return (
    <div className="border-b border-slate-800 bg-slate-900/40">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-3 text-sm">
        <span className="text-slate-400 hidden sm:inline">
          Point {displayName || pool.toUpperCase()} miners at
        </span>
        <code className="flex-1 font-mono text-amber-400 truncate" title={url}>
          {url || "loading…"}
        </code>
        <button
          onClick={onCopy}
          disabled={!url}
          className="rounded-md border border-slate-700 hover:border-amber-500 hover:text-amber-400 px-3 py-1 text-xs disabled:opacity-50"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
