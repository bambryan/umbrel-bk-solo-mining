"use client";

import { useEffect, useRef, useState } from "react";

const REFRESH_MS = 3_000;

export function LogsViewer() {
  const [service, setService] = useState<"ckpool" | "bchn">("ckpool");
  const [tail, setTail] = useState(300);
  const [logs, setLogs] = useState<string>("");
  const [live, setLive] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [stickToBottom, setStickToBottom] = useState(true);
  const preRef = useRef<HTMLPreElement | null>(null);

  // Auto-fetch loop while live + tab visible.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function pull() {
      if (cancelled) return;
      if (document.visibilityState !== "visible") {
        timer = setTimeout(pull, REFRESH_MS);
        return;
      }
      try {
        const res = await fetch(`/api/logs?service=${service}&tail=${tail}`, { cache: "no-store" });
        const text = await res.text();
        if (cancelled) return;
        if (!res.ok) {
          setErr(text);
        } else {
          setErr(null);
          setLogs(text);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      }
      if (!cancelled && live) timer = setTimeout(pull, REFRESH_MS);
    }

    pull();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [service, tail, live]);

  // Auto-scroll to bottom when new content arrives, unless the user has
  // scrolled away.
  useEffect(() => {
    if (!stickToBottom) return;
    const el = preRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs, stickToBottom]);

  function onScroll() {
    const el = preRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    setStickToBottom(atBottom);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={service}
          onChange={(e) => setService(e.target.value as "ckpool" | "bchn")}
          className="rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-sm"
        >
          <option value="ckpool">ckpool</option>
          <option value="bchn">bchn</option>
        </select>
        <select
          value={tail}
          onChange={(e) => setTail(parseInt(e.target.value, 10))}
          className="rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-sm"
        >
          <option value="100">100 lines</option>
          <option value="300">300 lines</option>
          <option value="1000">1000 lines</option>
          <option value="2000">2000 lines</option>
        </select>
        <button
          onClick={() => setLive((v) => !v)}
          className={
            "rounded-md border px-3 py-1 text-sm " +
            (live
              ? "border-emerald-600 bg-emerald-600/10 text-emerald-400 hover:border-emerald-500"
              : "border-slate-700 text-slate-300 hover:border-amber-500 hover:text-amber-400")
          }
        >
          {live ? "● Live (auto-refresh 3s)" : "Paused"}
        </button>
        {!live && (
          <button
            onClick={() => setLive(true)}
            className="rounded-md border border-slate-700 hover:border-amber-500 hover:text-amber-400 px-3 py-1 text-sm"
          >
            Refresh now
          </button>
        )}
        {err && <span className="text-xs text-red-400 truncate" title={err}>{err}</span>}
      </div>

      <pre
        ref={preRef}
        onScroll={onScroll}
        className="h-[480px] overflow-auto rounded-md bg-slate-950 border border-slate-800 p-3 text-xs font-mono whitespace-pre-wrap text-slate-300"
      >
        {logs || "(no logs yet)"}
      </pre>
    </div>
  );
}
