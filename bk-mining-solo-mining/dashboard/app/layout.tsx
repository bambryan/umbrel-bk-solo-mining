import type { Metadata } from "next";
import { Suspense } from "react";
import { ConnectionBanner } from "@/components/ConnectionBanner";
import { NavLinks } from "@/components/NavLinks";
import "./globals.css";

export const metadata: Metadata = {
  title: "BK Mining",
  description: "Self-hosted solo mining dashboard (BCH + BTC)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 py-2 sm:py-3">
            {/* Pool selection now happens by tapping a tile on /pools — no
                per-page switcher needed. Header just has logo + nav. */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex items-center gap-3 min-w-0">
                <img src="/logo.png" alt="" width={36} height={36} className="rounded-md shrink-0" />
                <div className="font-semibold text-amber-400 text-base sm:text-lg leading-tight">BK Mining</div>
              </div>
              <Suspense fallback={null}>
                <NavLinks />
              </Suspense>
            </div>
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
