// Minimal JSON-RPC client for bchn. Server-only — never expose to browser.

const HOST = process.env.BCH_RPC_HOST || "bchn";
const PORT = process.env.BCH_RPC_PORT || "28332";
const USER = process.env.BCH_RPC_USER || "bch";
const PASS = process.env.BCH_RPC_PASS || "";

async function rpc<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
  const url = `http://${HOST}:${PORT}/`;
  const auth = Buffer.from(`${USER}:${PASS}`).toString("base64");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({ jsonrpc: "1.0", id: "dashboard", method, params }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`bchn RPC ${method} → HTTP ${res.status}`);
  const json = (await res.json()) as { result: T; error: { message: string } | null };
  if (json.error) throw new Error(`bchn RPC ${method} → ${json.error.message}`);
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

export async function getBlockchainInfo(): Promise<BlockchainInfo> {
  return rpc<BlockchainInfo>("getblockchaininfo");
}

export async function getNetworkInfo(): Promise<NetworkInfo> {
  return rpc<NetworkInfo>("getnetworkinfo");
}

export async function getMempoolInfo(): Promise<MempoolInfo> {
  return rpc<MempoolInfo>("getmempoolinfo");
}

export async function getRecentBlocks(n = 5): Promise<Array<{ height: number; hash: string; time: number }>> {
  const info = await getBlockchainInfo();
  const heights: number[] = [];
  for (let i = 0; i < n; i++) heights.push(info.blocks - i);
  const out: Array<{ height: number; hash: string; time: number }> = [];
  for (const h of heights) {
    if (h < 0) break;
    const hash = await rpc<string>("getblockhash", [h]);
    const block = await rpc<{ time: number }>("getblockheader", [hash]);
    out.push({ height: h, hash, time: block.time });
  }
  return out;
}
