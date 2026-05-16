import { NextResponse } from "next/server";
import { getPool, parsePoolId } from "@/lib/poolRegistry";

export async function GET(req: Request) {
  const pool = parsePoolId(new URL(req.url).searchParams.get("pool"));
  const p = getPool(pool);
  return NextResponse.json({ port: p.stratumPort, pool: p.id, displayName: p.displayName });
}
