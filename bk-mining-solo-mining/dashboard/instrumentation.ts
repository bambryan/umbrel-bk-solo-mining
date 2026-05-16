// Next.js auto-loads this once per server process (Node runtime only).
// We use it to boot the 60s pool.status sampler so the dashboard has a
// rolling history to chart against.

const INTERVAL_MS = 60_000;

// Module-level guard so dev hot-reload doesn't stack timers.
let started = false;

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (started) return;
  started = true;

  // Dynamic import keeps Edge/Browser bundles clean; sampler pulls in
  // fs + dockerode-adjacent code that's strictly server-side.
  const { sample } = await import("./lib/sampler");

  // Fire immediately so the first row exists before the UI asks for it.
  sample().catch((e) => console.error("[instrumentation] initial sample threw:", e));
  setInterval(() => {
    sample().catch((e) => console.error("[instrumentation] sample threw:", e));
  }, INTERVAL_MS);

  console.log(`[instrumentation] sampler started (every ${INTERVAL_MS / 1000}s)`);
}
