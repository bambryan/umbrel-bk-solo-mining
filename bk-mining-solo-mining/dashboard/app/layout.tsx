import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "BK Solo Mining",
  description: "Solo BCH mining dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6">
            <div className="font-semibold text-amber-400">BK Solo Mining</div>
            <nav className="flex gap-4 text-sm text-slate-300">
              <Link href="/" className="hover:text-white">Overview</Link>
              <Link href="/workers" className="hover:text-white">Workers</Link>
              <Link href="/admin" className="hover:text-white">Admin</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">{children}</main>
        <footer className="border-t border-slate-800 text-xs text-slate-500 text-center py-3">
          BK Solo Mining · bchn + ckpool · self-hosted
        </footer>
      </body>
    </html>
  );
}
