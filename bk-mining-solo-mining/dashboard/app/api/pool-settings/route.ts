import { NextResponse } from "next/server";
import {
  getPoolSettings,
  writeConfig,
  setUseMinerUsername,
  validatePoolSettings,
  type PoolSettings,
} from "@/lib/ckpoolConfig";
import { restartContainer } from "@/lib/docker";
import { getInstance } from "@/lib/poolRegistry";

// Settings are managed per stratum instance (?instance=bch-low / bch-high / …).
function instanceId(req: Request): string {
  return new URL(req.url).searchParams.get("instance") || "bch-low";
}

export async function GET(req: Request) {
  const id = instanceId(req);
  try {
    const settings = await getPoolSettings(id);
    return NextResponse.json(settings);
  } catch (err) {
    return new NextResponse(
      `Read failed: ${err instanceof Error ? err.message : String(err)}`,
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  const id = instanceId(req);
  const inst = getInstance(id);
  if (!inst) return new NextResponse(`Unknown stratum instance: ${id}`, { status: 400 });

  const body = (await req.json()) as Partial<PoolSettings>;
  const v = validatePoolSettings(body, inst.coin);
  if (!v.ok) return new NextResponse(v.error ?? "Invalid", { status: 400 });

  try {
    const patch: Record<string, unknown> = {};
    for (const k of ["btcaddress", "btcsig", "mindiff", "maxdiff", "startdiff"] as const) {
      if (body[k] !== undefined) patch[k] = body[k];
    }
    if (Object.keys(patch).length > 0) await writeConfig(patch, id);
    if (body.useMinerUsername !== undefined) await setUseMinerUsername(body.useMinerUsername, id);

    // Fire-and-forget restart of THIS instance's ckpool container only.
    restartContainer(inst.container).catch((e) => {
      console.error(`[pool-settings:${id}] ${inst.container} restart failed:`, e);
    });

    const next = await getPoolSettings(id);
    return NextResponse.json({ ok: true, settings: next });
  } catch (err) {
    return new NextResponse(
      `Save failed: ${err instanceof Error ? err.message : String(err)}`,
      { status: 500 }
    );
  }
}
