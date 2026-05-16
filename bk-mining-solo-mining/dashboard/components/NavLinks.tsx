"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type LinkDef = { href: string; label: string };

const LINKS: LinkDef[] = [
  { href: "/pools", label: "Pools" },
  { href: "/", label: "Overview" },
  { href: "/workers", label: "Workers" },
  { href: "/blocks", label: "Blocks" },
  { href: "/profit", label: "Profit" },
  { href: "/admin", label: "Admin" },
];

// Header nav. Preserves the current `?pool=` (and any other) query params so
// switching pages doesn't reset the pool selection. Highlights the active
// link with the amber accent.
export function NavLinks() {
  const pathname = usePathname();
  const params = useSearchParams();
  const qs = params.toString();
  const suffix = qs ? `?${qs}` : "";

  return (
    <nav className="flex gap-4 text-sm">
      {LINKS.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={`${l.href}${suffix}`}
            className={
              active
                ? "text-amber-400 font-medium"
                : "text-slate-300 hover:text-white"
            }
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
