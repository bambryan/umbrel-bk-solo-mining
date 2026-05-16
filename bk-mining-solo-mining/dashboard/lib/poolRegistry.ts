// Single source of truth for "what pools exist + how to talk to each one."
// Every multi-pool code path (ckpool readers, RPC client, sampler, API routes)
// resolves a pool id to a PoolDef here.

export type PoolId = "bch" | "btc";

export interface PoolDef {
  id: PoolId;
  displayName: string;   // "BCH" — short, for header dropdown
  fullName: string;      // "Bitcoin Cash"
  ckpoolWwwDir: string;
  ckpoolConfigPath: string;
  rpcHost: string;
  rpcPort: number;
  rpcUser: string;
  rpcPass: string;
  ckpoolContainer: string;
  nodeContainer: string;
  stratumPort: number;
}

const POOL_DEFS: Record<PoolId, Omit<PoolDef, "id">> = {
  bch: {
    displayName: "BCH",
    fullName: "Bitcoin Cash",
    ckpoolWwwDir:
      process.env.CKPOOL_WWW_DIR_BCH ||
      process.env.CKPOOL_WWW_DIR ||
      "/ckpool-www",
    ckpoolConfigPath:
      process.env.CKPOOL_CONFIG_PATH_BCH ||
      process.env.CKPOOL_CONFIG_PATH ||
      "/ckpool-config/ckpool.conf",
    rpcHost: process.env.BCH_RPC_HOST || "bchn",
    rpcPort: Number(process.env.BCH_RPC_PORT) || 28332,
    rpcUser: process.env.BCH_RPC_USER || "bch",
    rpcPass: process.env.BCH_RPC_PASS || "",
    ckpoolContainer:
      process.env.CKPOOL_CONTAINER || "bk-mining-solo-mining_ckpool_1",
    nodeContainer:
      process.env.BCHN_CONTAINER || "bk-mining-solo-mining_bchn_1",
    stratumPort: Number(process.env.STRATUM_PORT_BCH) || Number(process.env.STRATUM_PORT) || 4567,
  },
  btc: {
    displayName: "BTC",
    fullName: "Bitcoin",
    ckpoolWwwDir: process.env.CKPOOL_WWW_DIR_BTC || "/btc-ckpool-www",
    ckpoolConfigPath:
      process.env.CKPOOL_CONFIG_PATH_BTC || "/btc-ckpool-config/ckpool.conf",
    rpcHost: process.env.BTC_RPC_HOST || "btc-bitcoind",
    rpcPort: Number(process.env.BTC_RPC_PORT) || 28332,
    rpcUser: process.env.BTC_RPC_USER || "btc",
    rpcPass: process.env.BTC_RPC_PASS || "",
    ckpoolContainer:
      process.env.BTC_CKPOOL_CONTAINER || "bk-mining-solo-mining_btc_ckpool_1",
    nodeContainer:
      process.env.BTC_BITCOIND_CONTAINER || "bk-mining-solo-mining_btc_bitcoind_1",
    stratumPort: Number(process.env.STRATUM_PORT_BTC) || 7890,
  },
};

// Enabled pools come from the POOLS env (comma-separated). Defaults to "bch"
// so the existing single-pool config keeps working. Phase 3 adds "bch,btc".
export function getEnabledPoolIds(): PoolId[] {
  const raw = process.env.POOLS || "bch";
  const all: PoolId[] = ["bch", "btc"];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is PoolId => all.includes(s as PoolId));
}

export function getPool(id: PoolId): PoolDef {
  const def = POOL_DEFS[id];
  if (!def) throw new Error(`Unknown pool id: ${id}`);
  return { id, ...def };
}

export function getEnabledPools(): PoolDef[] {
  return getEnabledPoolIds().map(getPool);
}

// Parse pool id from a query param, defaulting to bch. Used by API routes
// and pages that read `?pool=`.
export function parsePoolId(raw: string | null | undefined): PoolId {
  const v = (raw || "").toLowerCase();
  return v === "btc" ? "btc" : "bch";
}
