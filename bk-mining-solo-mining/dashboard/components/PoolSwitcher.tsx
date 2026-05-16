"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

type Props = { pools: { id: string; label: string }[] };

// Small pill row in the header. Active pool gets the amber treatment; clicks
// rewrite the current URL with the new ?pool= and trigger a re-render.
export function PoolSwitcher({ pools }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const current = params.get("pool") || "bch";

  function set(p: string) {
    if (p === current) return;
    const next = new URLSearchParams(params.toString());
    next.set("pool", p);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="flex items-center gap-1 text-xs ml-auto">
      {pools.map((p) => (
        <button
          key={p.id}
          onClick={() => set(p.id)}
          className={
            "rounded-md px-2.5 py-1 border " +
            (current === p.id
              ? "border-amber-500 bg-amber-500/10 text-amber-400"
              : "border-slate-700 text-slate-300 hover:border-amber-500 hover:text-amber-400")
          }
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
