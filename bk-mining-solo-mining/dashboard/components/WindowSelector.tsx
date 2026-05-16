"use client";

import { useRouter, useSearchParams } from "next/navigation";

const WINDOWS: { label: string; value: string }[] = [
  { label: "30m", value: "30m" },
  { label: "1h", value: "1h" },
  { label: "6h", value: "6h" },
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" },
];

export function WindowSelector() {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("w") || "1h";

  function set(w: string) {
    const next = new URLSearchParams(params.toString());
    next.set("w", w);
    router.replace(`?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="flex items-center gap-1 text-xs">
      <span className="text-slate-400 mr-2">Trail</span>
      {WINDOWS.map((w) => (
        <button
          key={w.value}
          onClick={() => set(w.value)}
          className={
            "rounded-md px-2.5 py-1 border " +
            (current === w.value
              ? "border-amber-500 bg-amber-500/10 text-amber-400"
              : "border-slate-700 text-slate-300 hover:border-amber-500 hover:text-amber-400")
          }
        >
          {w.label}
        </button>
      ))}
    </div>
  );
}
