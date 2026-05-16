import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ConnectionBanner } from "@/components/ConnectionBanner";
import { PoolSwitcher } from "@/components/PoolSwitcher";
import { getEnabledPools } from "@/lib/poolRegistry";
import "./globals.css";

export const metadata: Metadata = {
  title: "BK Mining",
  description: "Self-hosted solo mining dashboard (BCH + BTC)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pools = getEnabledPools().map((p) => ({ id: p.id, label: p.displayName }));

  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
            {/* Plain <img> avoids next/image edge cases in standalone builds. */}
            <img src="/logo.png" alt="" width={40} height={40} className="rounded-md shrink-0" />
            <div className="font-semibold text-amber-400 text-lg">BK Mining</div>
            <nav className="flex gap-4 text-sm text-slate-300 ml-2">
              <Link href="/" className="hover:text-white">Overview</Link>
              <Link href="/workers" className="hover:text-white">Workers</Link>
              <Link href="/admin" className="hover:text-white">Admin</Link>
            </nav>
            {pools.length > 1 && (
              <Suspense fallback={null}>
                <PoolSwitcher pools={pools} />
              </Suspense>
            )}
          </div>
        </header>
        <Suspense fallback={null}>
          <ConnectionBanner />
        </Suspense>
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">{children}</main>
        <footer className="border-t border-slate-800 text-xs text-slate-500 text-center py-3">
          BK Mining · self-hosted solo mining
        </footer>
      </body>
    </html>
  );
}
