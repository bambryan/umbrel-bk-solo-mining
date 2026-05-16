import { NextResponse } from "next/server";
import { readBlocks } from "@/lib/blocks";
import { parsePoolId, getEnabledPoolIds } from "@/lib/poolRegistry";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const poolParam = url.searchParams.get("pool");
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));

  if (poolParam === "all") {
    const out: Record<string, Awaited<ReturnType<typeof readBlocks>>> = {};
    for (const p of getEnabledPoolIds()) {
      out[p] = await readBlocks(p, limit);
    }
    return NextResponse.json(out);
  }

  const pool = parsePoolId(poolParam);
  const blocks = await readBlocks(pool, limit);
  return NextResponse.json({ pool, blocks });
}
