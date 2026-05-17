import { NextResponse } from "next/server";
import { setPoolEnabled } from "@/lib/poolEnabled";
import { stopPool } from "@/lib/poolControl";
import { parsePoolId } from "@/lib/poolRegistry";

// POST /api/pools/disable
// Body: { pool: "bch"|"btc"|"dgb" }
// Stops the pool's containers and marks it disabled. Chain data + ckpool.conf
// are preserved — re-enabling later picks up where you left off without
// resyncing.
export async function POST(req: Request) {
  const body = (await req.json()) as { pool?: string };
  const pool = parsePoolId(body.pool);

  try {
    await stopPool(pool);
  } catch (e) {
    return new NextResponse(
      `Stop containers failed: ${e instanceof Error ? e.message : String(e)}`,
      { status: 500 }
    );
  }

  try {
    const enabled = await setPoolEnabled(pool, false);
    return NextResponse.json({ ok: true, pool, enabled });
  } catch (e) {
    return new NextResponse(
      `Mark disabled failed: ${e instanceof Error ? e.message : String(e)}`,
      { status: 500 }
    );
  }
}
