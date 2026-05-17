// Two complementary detection paths so we never miss a block we solved:
//
//   1. Log watcher: scans each pool's ckpool container logs every minute for
//      block-solved markers. Fast — fires the moment ckpool calls submitblock
//      successfully. But misses anything that happened while the dashboard
//      was down.
//
//   2. Chain verifier: pulls the most recent blocks from each pool's node
//      and checks whether the coinbase paid our configured payout address.
//      Slower / less precise (won't catch a block we solved that another
//      miner orphaned), but catches anything the log watcher missed and
//      gives us "ours" verification.

import Docker from "dockerode";
import { getPool, type PoolId, getEnabledPoolIds } from "./poolRegistry";
import { getEnabledPoolIdsFromState } from "./poolEnabled";
import { readConfig } from "./ckpoolConfig";
import { appendBlock, hasBlock, type BlockEvent } from "./blocks";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

// ckpool log patterns we care about (case-insensitive substring match).
// We're inclusive — multiple patterns exist across ckpool variants. The
// height + hash are extracted later via regex.
const BLOCK_PATTERNS = [
  /BLOCK ACCEPTED/i,
  /Block solved/i,
  /Block submitted/i,
  /Submitted block/i,
];
const HEIGHT_RE = /\bheight[: ]+(\d+)/i;
const HASH_RE = /\b([0-9a-f]{64})\b/i;

async function tailLogs(container: string, sinceSec: number): Promise<string> {
  try {
    const c = docker.getContainer(container);
    const buf = (await c.logs({
      stdout: true, stderr: true,
      since: Math.floor(Date.now() / 1000) - sinceSec,
      timestamps: false,
      follow: false,
    })) as unknown as Buffer;
    // Strip docker multiplex headers (same approach as lib/docker.ts).
    const parts: string[] = [];
    let i = 0;
    while (i < buf.length) {
      if (
        i + 8 <= buf.length &&
        buf[i] <= 2 && buf[i + 1] === 0 && buf[i + 2] === 0 && buf[i + 3] === 0
      ) {
        const len = buf.readUInt32BE(i + 4);
        parts.push(buf.slice(i + 8, i + 8 + len).toString("utf8"));
        i += 8 + len;
      } else {
        parts.push(buf.slice(i).toString("utf8"));
        break;
      }
    }
    return parts.join("");
  } catch (e) {
    console.warn(`[blocksWatcher:logs ${container}] ${e instanceof Error ? e.message : e}`);
    return "";
  }
}

async function scanLogsForPool(pool: PoolId): Promise<number> {
  const p = getPool(pool);
  const text = await tailLogs(p.ckpoolContainer, 120); // 2 min window — runs every 60s, so 2x overlap
  if (!text) return 0;
  let recorded = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!BLOCK_PATTERNS.some((re) => re.test(line))) continue;
    const heightMatch = HEIGHT_RE.exec(line);
    const hashMatch = HASH_RE.exec(line);
    const height = heightMatch ? parseInt(heightMatch[1], 10) : 0;
    const hash = hashMatch ? hashMatch[1] : "";
    if (!height || !hash) continue;
    if (await hasBlock(pool, height, hash)) continue;
    const row: BlockEvent = {
      ts: Math.floor(Date.now() / 1000),
      pool,
      height,
      hash,
      ours: true, // ckpool only logs blocks IT solved → always ours
      source: "log",
      rawLogLine: line.trim().slice(0, 500),
    };
    await appendBlock(row);
    recorded++;
    console.log(`[blocksWatcher:${pool}] 🎉 block ${height} (${hash.slice(0,12)}…) detected via log!`);
  }
  return recorded;
}

// Tiny RPC client. Mirrors lib/bchn.ts's approach but lives here to keep this
// module self-contained.
async function rpc<T>(pool: PoolId, method: string, params: unknown[] = []): Promise<T> {
  const p = getPool(pool);
  const auth = Buffer.from(`${p.rpcUser}:${p.rpcPass}`).toString("base64");
  const res = await fetch(`http://${p.rpcHost}:${p.rpcPort}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
    body: JSON.stringify({ jsonrpc: "1.0", id: "blocks", method, params }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${pool} rpc ${method} → HTTP ${res.status}`);
  const json = (await res.json()) as { result: T; error: { message: string } | null };
  if (json.error) throw new Error(`${pool} rpc ${method} → ${json.error.message}`);
  return json.result;
}

// Walk back from the chain tip and check if any of the last N blocks paid
// us. Cheap because we only look at coinbase outputs and stop on the first
// already-recorded block.
async function verifyChainForPool(pool: PoolId, lookback = 20): Promise<number> {
  let payoutAddress: string;
  try {
    const cfg = await readConfig(pool);
    payoutAddress = cfg.btcaddress;
  } catch { return 0; }
  if (!payoutAddress || payoutAddress.startsWith("CHANGE_ME")) return 0;

  let tipHeight: number;
  try {
    tipHeight = await rpc<number>(pool, "getblockcount");
  } catch { return 0; }

  let recorded = 0;
  for (let h = tipHeight; h > tipHeight - lookback && h >= 0; h--) {
    try {
      const hash = await rpc<string>(pool, "getblockhash", [h]);
      if (await hasBlock(pool, h, hash)) break; // already recorded — older ones are too
      // verbosity 2 returns transactions with vout details
      const block = await rpc<{ tx: Array<{ vout: Array<{ scriptPubKey: { addresses?: string[]; address?: string } }> }> }>(pool, "getblock", [hash, 2]);
      const coinbase = block.tx[0];
      const addrs: string[] = [];
      for (const vout of coinbase.vout) {
        if (vout.scriptPubKey.address) addrs.push(vout.scriptPubKey.address);
        if (vout.scriptPubKey.addresses) addrs.push(...vout.scriptPubKey.addresses);
      }
      const ours = addrs.includes(payoutAddress);
      if (ours) {
        await appendBlock({
          ts: Math.floor(Date.now() / 1000),
          pool, height: h, hash, ours: true,
          payoutAddress, source: "chain",
        });
        recorded++;
        console.log(`[blocksWatcher:${pool}] 🎉 chain found our block ${h} (${hash.slice(0,12)}…)!`);
      }
    } catch (e) {
      // RPC error on a single block — skip and move on.
      console.warn(`[blocksWatcher:${pool}] getblock ${h} failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  return recorded;
}

export async function watchOnce(): Promise<void> {
  // Skip disabled pools — their containers are down so log scans + RPC
  // verifies would just spam errors. State file is the source of truth.
  const universe = new Set<PoolId>(getEnabledPoolIds());
  const enabled = (await getEnabledPoolIdsFromState()).filter((p) => universe.has(p));
  for (const pool of enabled) {
    try { await scanLogsForPool(pool); }
    catch (e) { console.warn(`[blocksWatcher:${pool}] log scan failed: ${e instanceof Error ? e.message : e}`); }
    try { await verifyChainForPool(pool); }
    catch (e) { console.warn(`[blocksWatcher:${pool}] chain verify failed: ${e instanceof Error ? e.message : e}`); }
  }
}
