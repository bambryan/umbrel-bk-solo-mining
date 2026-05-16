import { NextResponse } from "next/server";
import { restartContainer } from "@/lib/docker";
import { getPool, parsePoolId } from "@/lib/poolRegistry";

export async function POST(req: Request) {
  const body = (await req.json()) as { service?: string; pool?: string };
  const pool = parsePoolId(body.pool ?? new URL(req.url).searchParams.get("pool"));
  const p = getPool(pool);

  let name: string | undefined;
  if (body.service === "ckpool") name = p.ckpoolContainer;
  else if (body.service === "node" || body.service === "bchn" || body.service === "bitcoind") name = p.nodeContainer;
  if (!name) return new NextResponse("Unknown service", { status: 400 });

  try {
    await restartContainer(name);
    return NextResponse.json({ ok: true, restarted: name });
  } catch (err) {
    return new NextResponse(
      `Restart failed: ${err instanceof Error ? err.message : String(err)}`,
      { status: 500 }
    );
  }
}
