import { NextResponse } from "next/server";
import {
  getPoolSettings,
  writeConfig,
  setUseMinerUsername,
  validatePoolSettings,
  type PoolSettings,
} from "@/lib/ckpoolConfig";
import { restartContainer } from "@/lib/docker";

const CKPOOL_CONTAINER = process.env.CKPOOL_CONTAINER || "bk-mining-solo-mining_ckpool_1";

export async function GET() {
  try {
    const settings = await getPoolSettings();
    return NextResponse.json(settings);
  } catch (err) {
    return new NextResponse(
      `Read failed: ${err instanceof Error ? err.message : String(err)}`,
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  const body = (await req.json()) as Partial<PoolSettings>;
  const v = validatePoolSettings(body);
  if (!v.ok) return new NextResponse(v.error ?? "Invalid", { status: 400 });

  try {
    const patch: Record<string, unknown> = {};
    for (const k of ["btcaddress", "btcsig", "mindiff", "maxdiff", "startdiff"] as const) {
      if (body[k] !== undefined) patch[k] = body[k];
    }
    if (Object.keys(patch).length > 0) await writeConfig(patch);
    if (body.useMinerUsername !== undefined) await setUseMinerUsername(body.useMinerUsername);

    // Fire-and-forget restart so the client gets a fast response.
    restartContainer(CKPOOL_CONTAINER).catch((e) => {
      console.error("[pool-settings] ckpool restart failed:", e);
    });

    const next = await getPoolSettings();
    return NextResponse.json({ ok: true, settings: next });
  } catch (err) {
    return new NextResponse(
      `Save failed: ${err instanceof Error ? err.message : String(err)}`,
      { status: 500 }
    );
  }
}
