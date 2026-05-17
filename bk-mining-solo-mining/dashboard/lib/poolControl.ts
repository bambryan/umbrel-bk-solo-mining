// Start/stop the docker containers that make up a pool's stack, in the right
// order. Used by the enable/disable API routes.
//
// Per-pool stacks (ordered start: node → proxy → ckpool):
//   bch: bchn → ckpool
//   btc: btc-bitcoind → btc-ckpool
//   dgb: dgb-bitcoind → dgb-rpc-proxy → dgb-ckpool
//
// Stop order is the reverse so ckpool drops its bitcoind connection cleanly
// before the bitcoind process exits.

import Docker from "dockerode";
import { getPool, type PoolId } from "./poolRegistry";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

const DGB_RPC_PROXY_CONTAINER =
  process.env.DGB_RPC_PROXY_CONTAINER || "bk-mining-solo-mining_dgb_rpc_proxy_1";

// Returns container names in dependency order (first = lowest-level service).
function containersFor(pool: PoolId): string[] {
  const p = getPool(pool);
  if (pool === "dgb") {
    return [p.nodeContainer, DGB_RPC_PROXY_CONTAINER, p.ckpoolContainer];
  }
  return [p.nodeContainer, p.ckpoolContainer];
}

async function startContainer(name: string): Promise<void> {
  const c = docker.getContainer(name);
  try {
    const inspect = await c.inspect();
    if (inspect.State.Running) return;
    await c.start();
  } catch (e) {
    // Container might not exist (e.g. fresh install before init created
    // it). Surface that clearly instead of cryptic Docker error.
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("No such container")) {
      throw new Error(
        `Container ${name} doesn't exist. The app's compose must include all pool ` +
        `services even if disabled. Make sure docker-compose.yml has not been edited ` +
        `to remove them.`
      );
    }
    throw e;
  }
}

async function stopContainer(name: string): Promise<void> {
  const c = docker.getContainer(name);
  try {
    const inspect = await c.inspect();
    if (!inspect.State.Running) return;
    await c.stop({ t: 30 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("No such container")) return; // already gone
    throw e;
  }
}

export async function startPool(pool: PoolId): Promise<void> {
  const names = containersFor(pool);
  for (const name of names) await startContainer(name);
}

export async function stopPool(pool: PoolId): Promise<void> {
  const names = [...containersFor(pool)].reverse();
  for (const name of names) await stopContainer(name);
}

// Reconcile container state with the persisted enable list. Called once at
// dashboard startup so that on a fresh install (no pools enabled) all the
// chain/ckpool containers created by `docker compose up -d` get stopped
// promptly. On a normal install with enabled pools this is a no-op.
export async function reconcileAllPools(enabled: PoolId[]): Promise<void> {
  const enabledSet = new Set(enabled);
  const allPools: PoolId[] = ["bch", "btc", "dgb"];
  for (const pool of allPools) {
    if (enabledSet.has(pool)) continue;
    try {
      await stopPool(pool);
    } catch (e) {
      // Non-fatal — containers might not exist yet during first boot, or
      // user may have disabled the service in compose. Log and move on.
      console.warn(
        `[poolControl] reconcile stop ${pool} failed:`,
        e instanceof Error ? e.message : e
      );
    }
  }
}

export async function poolContainerStatus(pool: PoolId): Promise<Record<string, "running" | "exited" | "missing" | string>> {
  const out: Record<string, string> = {};
  for (const name of containersFor(pool)) {
    try {
      const inspect = await docker.getContainer(name).inspect();
      out[name] = inspect.State.Status;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      out[name] = msg.includes("No such container") ? "missing" : `error: ${msg}`;
    }
  }
  return out;
}
