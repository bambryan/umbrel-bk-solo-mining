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

  // Reconcile containers against the enable list before the first sample.
  // On a fresh install, compose creates all pool services but the state
  // file (auto-initialized empty) tells us to stop everything except
  // app_proxy/dashboard/init — done once at boot, then on every user
  // enable/disable through the API routes.
  try {
    const { getEnabledPoolIdsFromState } = await import("./lib/poolEnabled");
    const { reconcileAllPools } = await import("./lib/poolControl");
    const enabled = await getEnabledPoolIdsFromState();
    await reconcileAllPools(enabled);
    console.log(`[instrumentation] reconciled pools, enabled=${enabled.join(",") || "(none)"}`);
  } catch (e) {
    console.warn("[instrumentation] reconcile failed:", e instanceof Error ? e.message : e);
  }

  // Fire immediately so the first row exists before the UI asks for it.
  sample().catch((e) => console.error("[instrumentation] initial sample threw:", e));
  setInterval(() => {
    sample().catch((e) => console.error("[instrumentation] sample threw:", e));
  }, INTERVAL_MS);

  console.log(`[instrumentation] sampler started (every ${INTERVAL_MS / 1000}s)`);
}
