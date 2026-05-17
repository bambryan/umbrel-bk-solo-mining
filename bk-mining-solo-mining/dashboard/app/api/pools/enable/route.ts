import { NextResponse } from "next/server";
import {
  writeConfig,
  validatePoolSettings,
  type PoolSettings,
} from "@/lib/ckpoolConfig";
import { setPoolEnabled } from "@/lib/poolEnabled";
import { startPool } from "@/lib/poolControl";
import { parsePoolId } from "@/lib/poolRegistry";

// POST /api/pools/enable
// Body: { pool: "bch"|"btc"|"dgb", btcaddress: string, btcsig?: string }
// 1. Validates the payout address per pool
// 2. Writes it to ckpool.conf (plus optional btcsig)
// 3. Starts the pool's docker services (node → ckpool, plus proxy for DGB)
// 4. Marks the pool as enabled in enabled-pools.json
export async function POST(req: Request) {
  const body = (await req.json()) as { pool?: string; btcaddress?: string; btcsig?: string };
  const pool = parsePoolId(body.pool);
  const settings: Partial<PoolSettings> = { btcaddress: body.btcaddress };
  if (body.btcsig) settings.btcsig = body.btcsig;

  const v = validatePoolSettings(settings, pool);
  if (!v.ok) return new NextResponse(v.error ?? "Invalid", { status: 400 });

  try {
    await writeConfig({ btcaddress: body.btcaddress!, ...(body.btcsig ? { btcsig: body.btcsig } : {}) }, pool);
  } catch (e) {
    return new NextResponse(
      `Write ckpool.conf failed: ${e instanceof Error ? e.message : String(e)}`,
      { status: 500 }
    );
  }

  try {
    await startPool(pool);
  } catch (e) {
    return new NextResponse(
      `Start containers failed: ${e instanceof Error ? e.message : String(e)}`,
      { status: 500 }
    );
  }

  try {
    const enabled = await setPoolEnabled(pool, true);
    return NextResponse.json({ ok: true, pool, enabled });
  } catch (e) {
    return new NextResponse(
      `Mark enabled failed: ${e instanceof Error ? e.message : String(e)}`,
      { status: 500 }
    );
  }
}
