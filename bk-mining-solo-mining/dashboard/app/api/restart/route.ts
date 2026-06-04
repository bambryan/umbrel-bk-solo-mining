import { NextResponse } from "next/server";
import { restartContainer } from "@/lib/docker";
import { getInstance, getPool, parsePoolId } from "@/lib/poolRegistry";

export async function POST(req: Request) {
  const body = (await req.json()) as { service?: string; instance?: string; pool?: string };
  const url = new URL(req.url);

  let name: string | undefined;
  if (body.service === "ckpool") {
    // ckpool restart targets one stratum instance (e.g. bch-high).
    const id = body.instance || url.searchParams.get("instance") || "bch-low";
    name = getInstance(id)?.container;
  } else if (body.service === "node" || body.service === "bchn" || body.service === "bitcoind") {
    // node restart targets the coin's shared node.
    const coin = parsePoolId(body.pool ?? url.searchParams.get("pool"));
    name = getPool(coin).nodeContainer;
  }
  if (!name) return new NextResponse("Unknown service or instance", { status: 400 });

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
