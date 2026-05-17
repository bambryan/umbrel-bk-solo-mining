// Visual indicator that a pool's chain is in Initial Block Download. Reads
// verificationprogress + headers/blocks from the node and shows a compact
// progress bar. Hides itself once sync is >99.95% (chain is "current").

type Props = {
  verificationprogress?: number; // 0..1
  blocks?: number;
  headers?: number;
};

export function SyncProgress({ verificationprogress, blocks, headers }: Props) {
  if (verificationprogress == null || blocks == null) return null;
  // Treat anything above 99.95% as "synced" — the chain tip wobbles slightly
  // even on a fully caught-up node.
  if (verificationprogress >= 0.9995) return null;

  const pct = Math.max(0, Math.min(100, verificationprogress * 100));
  const behind = headers && headers > blocks ? headers - blocks : null;

  return (
    <div className="rounded-md border border-amber-700/40 bg-amber-900/15 px-3 py-2 text-xs space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-amber-300 font-semibold">Syncing chain…</span>
        <span className="text-amber-200/80 font-mono">{pct.toFixed(2)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-amber-900/50 overflow-hidden">
        <div
          className="h-full bg-amber-500/80 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-amber-200/60 flex justify-between gap-2">
        <span>Block {blocks.toLocaleString()}</span>
        {behind != null && <span>{behind.toLocaleString()} behind tip</span>}
      </div>
    </div>
  );
}
