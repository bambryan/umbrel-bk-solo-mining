import { NextResponse } from "next/server";
import { tailLogs } from "@/lib/docker";
import { getPool, parsePoolId } from "@/lib/poolRegistry";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const pool = parsePoolId(url.searchParams.get("pool"));
  const service = url.searchParams.get("service") ?? "ckpool";
  const tail = Math.min(2000, Math.max(10, parseInt(url.searchParams.get("tail") ?? "200", 10)));

  const p = getPool(pool);
  // "ckpool" / "node" are the canonical service names; "bchn"/"bitcoind"
  // accepted as aliases for the node so existing front-end code keeps working.
  let name: string | undefined;
  if (service === "ckpool") name = p.ckpoolContainer;
  else if (service === "node" || service === "bchn" || service === "bitcoind") name = p.nodeContainer;
  if (!name) return new NextResponse("Unknown service", { status: 400 });

  try {
    const text = await tailLogs(name, tail);
    return new NextResponse(text, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    return new NextResponse(
      `Log fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      { status: 500 }
    );
  }
}
