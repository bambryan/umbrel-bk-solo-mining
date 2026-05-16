// Simple in-memory price cache backed by CoinGecko's free /simple/price
// endpoint. ~30 req/min free tier — we refresh every 5 min so we never come
// close. No retry/backoff because the dashboard's own polling will retry
// naturally; a single failed price fetch just means stale-but-recent values.

import type { PoolId } from "./poolRegistry";

const CG_IDS: Record<PoolId, string> = {
  bch: "bitcoin-cash",
  btc: "bitcoin",
  dgb: "digibyte",
};

const TTL_MS = 5 * 60 * 1000;

type Cache = {
  fetchedAt: number;
  pricesUsd: Partial<Record<PoolId, number>>;
  changePct24h: Partial<Record<PoolId, number>>;
};

let cache: Cache | null = null;
let inflight: Promise<Cache> | null = null;

async function fetchFresh(): Promise<Cache> {
  const ids = Object.values(CG_IDS).join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const data = (await res.json()) as Record<string, { usd: number; usd_24h_change?: number }>;
  const pricesUsd: Partial<Record<PoolId, number>> = {};
  const changePct24h: Partial<Record<PoolId, number>> = {};
  for (const [pool, cgId] of Object.entries(CG_IDS) as Array<[PoolId, string]>) {
    const row = data[cgId];
    if (row) {
      pricesUsd[pool] = row.usd;
      if (typeof row.usd_24h_change === "number") changePct24h[pool] = row.usd_24h_change;
    }
  }
  return { fetchedAt: Date.now(), pricesUsd, changePct24h };
}

export async function getPrices(): Promise<Cache> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache;
  if (inflight) return inflight;
  inflight = fetchFresh()
    .then((c) => { cache = c; return c; })
    .catch((e) => {
      console.warn("[prices] fetch failed:", e instanceof Error ? e.message : e);
      // Return stale cache if we have one, else rethrow.
      if (cache) return cache;
      throw e;
    })
    .finally(() => { inflight = null; });
  return inflight;
}
