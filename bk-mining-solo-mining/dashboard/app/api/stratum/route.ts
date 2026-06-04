import { NextResponse } from "next/server";
import { getPool, parsePoolId } from "@/lib/poolRegistry";

export async function GET(req: Request) {
  const pool = parsePoolId(new URL(req.url).searchParams.get("pool"));
  const p = getPool(pool);
  return NextResponse.json({
    port: p.stratumPort,
    pool: p.id,
    displayName: p.displayName,
    // Public stratum host shown in the connect banner. Falls back (null) to the
    // browser's location.hostname when unset — but on a split web/stratum setup
    // (e.g. pool-web.* for the dashboard, pool.* for stratum) set this env.
    host: process.env.STRATUM_PUBLIC_HOST || null,
  });
}
