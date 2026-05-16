// Generic JSON-RPC client for a bitcoin-flavored node (bchn for BCH,
// bitcoind/knots for BTC). Per-pool connection info comes from poolRegistry.
// Server-only — never expose to browser.

import { getPool, type PoolId } from "./poolRegistry";

async function rpc<T = unknown>(
  pool: PoolId,
  method: string,
  params: unknown[] = []
): Promise<T> {
  const p = getPool(pool);
  const url = `http://${p.rpcHost}:${p.rpcPort}/`;
  const auth = Buffer.from(`${p.rpcUser}:${p.rpcPass}`).toString("base64");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({ jsonrpc: "1.0", id: "dashboard", method, params }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${pool} RPC ${method} → HTTP ${res.status}`);
  const json = (await res.json()) as { result: T; error: { message: string } | null };
  if (json.error) throw new Error(`${pool} RPC ${method} → ${json.error.message}`);
  return json.result;
}

export interface BlockchainInfo {
  chain: string;
  blocks: number;
  headers: number;
  bestblockhash: string;
  difficulty: number;
  mediantime: number;
  verificationprogress: number;
  initialblockdownload: boolean;
  size_on_disk: number;
  pruned: boolean;
  pruneheight?: number;
}

export interface NetworkInfo {
  version: number;
  subversion: string;
  connections: number;
  networkactive: boolean;
}

export interface MempoolInfo {
  size: number;
  bytes: number;
  usage: number;
}

export async function getBlockchainInfo(pool: PoolId = "bch"): Promise<BlockchainInfo> {
  return rpc<BlockchainInfo>(pool, "getblockchaininfo");
}

export async function getNetworkInfo(pool: PoolId = "bch"): Promise<NetworkInfo> {
  return rpc<NetworkInfo>(pool, "getnetworkinfo");
}

export async function getMempoolInfo(pool: PoolId = "bch"): Promise<MempoolInfo> {
  return rpc<MempoolInfo>(pool, "getmempoolinfo");
}

export async function getRecentBlocks(n = 5, pool: PoolId = "bch"): Promise<Array<{ height: number; hash: string; time: number }>> {
  const info = await getBlockchainInfo(pool);
  const heights: number[] = [];
  for (let i = 0; i < n; i++) heights.push(info.blocks - i);
  const out: Array<{ height: number; hash: string; time: number }> = [];
  for (const h of heights) {
    if (h < 0) break;
    const hash = await rpc<string>(pool, "getblockhash", [h]);
    const block = await rpc<{ time: number }>(pool, "getblockheader", [hash]);
    out.push({ height: h, hash, time: block.time });
  }
  return out;
}
