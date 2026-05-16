// Pure formatters — safe for both server and client bundles (no Node-only
// imports). Anything that needs fs/path/etc lives in ckpool.ts.

// Parse "132T", "5.5G", "65.7P", or a plain number → hashes/sec
export function parseHashrate(h: string | number | undefined): number {
  if (h == null) return 0;
  if (typeof h === "number") return h;
  const m = /^([\d.]+)\s*([KMGTPE])?$/i.exec(String(h).trim());
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const unit = (m[2] || "").toUpperCase();
  const mult: Record<string, number> = {
    "": 1, K: 1e3, M: 1e6, G: 1e9, T: 1e12, P: 1e15, E: 1e18,
  };
  return n * (mult[unit] ?? 1);
}

export function formatHashrate(hps: number): string {
  if (hps >= 1e18) return (hps / 1e18).toFixed(2) + " EH/s";
  if (hps >= 1e15) return (hps / 1e15).toFixed(2) + " PH/s";
  if (hps >= 1e12) return (hps / 1e12).toFixed(2) + " TH/s";
  if (hps >= 1e9) return (hps / 1e9).toFixed(2) + " GH/s";
  if (hps >= 1e6) return (hps / 1e6).toFixed(2) + " MH/s";
  if (hps >= 1e3) return (hps / 1e3).toFixed(2) + " KH/s";
  return hps.toFixed(0) + " H/s";
}

// Format a large unitless number with SI suffix (matches ckpool's style for
// shares + best-share + difficulty: 36,314,947,747 → 36.3G,
// 7.487e+11 → 748G).
export function formatSI(n: number | undefined, digits = 1): string {
  if (n == null || !isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e18) return (n / 1e18).toFixed(digits) + "E";
  if (abs >= 1e15) return (n / 1e15).toFixed(digits) + "P";
  if (abs >= 1e12) return (n / 1e12).toFixed(digits) + "T";
  if (abs >= 1e9) return (n / 1e9).toFixed(digits) + "G";
  if (abs >= 1e6) return (n / 1e6).toFixed(digits) + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(digits) + "K";
  return n.toFixed(0);
}

export function formatAgo(unixSec: number | undefined): string {
  if (!unixSec) return "—";
  const sec = Math.max(0, Math.floor(Date.now() / 1000) - unixSec);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}
