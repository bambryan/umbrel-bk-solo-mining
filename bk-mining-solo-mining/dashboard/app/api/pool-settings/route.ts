import { NextResponse } from "next/server";
import {
  getPoolSettings,
  writeConfig,
  setUseMinerUsername,
  validatePoolSettings,
  type PoolSettings,
} from "@/lib/ckpoolConfig";
import { restartContainer } from "@/lib/docker";
import { getPool, parsePoolId } from "@/lib/poolRegistry";

export async function GET(req: Request) {
  const pool = parsePoolId(new URL(req.url).searchParams.get("pool"));
  try {
    const settings = await getPoolSettings(pool);
    return NextResponse.json(settings);
  } catch (err) {
    return new NextResponse(
      `Read failed: ${err instanceof Error ? err.message : String(err)}`,
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  const pool = parsePoolId(new URL(req.url).searchParams.get("pool"));
  const body = (await req.json()) as Partial<PoolSettings>;
  const v = validatePoolSettings(body, pool);
  if (!v.ok) return new NextResponse(v.error ?? "Invalid", { status: 400 });

  try {
    const patch: Record<string, unknown> = {};
    for (const k of ["btcaddress", "btcsig", "mindiff", "maxdiff", "startdiff"] as const) {
      if (body[k] !== undefined) patch[k] = body[k];
    }
    if (Object.keys(patch).length > 0) await writeConfig(patch, pool);
    if (body.useMinerUsername !== undefined) await setUseMinerUsername(body.useMinerUsername, pool);

    // Fire-and-forget restart of the right pool's ckpool container.
    const container = getPool(pool).ckpoolContainer;
    restartContainer(container).catch((e) => {
      console.error(`[pool-settings:${pool}] ${container} restart failed:`, e);
    });

    const next = await getPoolSettings(pool);
    return NextResponse.json({ ok: true, settings: next });
  } catch (err) {
    return new NextResponse(
      `Save failed: ${err instanceof Error ? err.message : String(err)}`,
      { status: 500 }
    );
  }
}
