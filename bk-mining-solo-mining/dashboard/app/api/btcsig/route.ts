import { NextResponse } from "next/server";
import { writeConfig } from "@/lib/ckpoolConfig";
import { restartContainer } from "@/lib/docker";
import { getInstance, parsePoolId } from "@/lib/poolRegistry";

// Legacy endpoint kept for back-compat — the new admin form uses
// PUT /api/pool-settings?instance=… which covers btcsig + everything else.
// This applies to the coin's low-diff instance.
export async function PATCH(req: Request) {
  const url = new URL(req.url);
  const coin = parsePoolId(url.searchParams.get("pool"));
  const id = `${coin}-low`;
  const inst = getInstance(id);
  if (!inst) return new NextResponse(`Unknown instance: ${id}`, { status: 400 });

  const body = (await req.json()) as { btcsig?: string };
  const sig = (body.btcsig ?? "").trim();
  if (!sig) return new NextResponse("btcsig is required", { status: 400 });
  if (!sig.startsWith("/") || !sig.endsWith("/")) {
    return new NextResponse("btcsig must start and end with / (e.g. /solo mined by BK/)", {
      status: 400,
    });
  }
  if (sig.length > 100) {
    return new NextResponse("btcsig too long (max 100 chars)", { status: 400 });
  }

  await writeConfig({ btcsig: sig }, id);
  restartContainer(inst.container).catch((e) => {
    console.error(`[btcsig:${id}] ${inst.container} restart failed:`, e);
  });
  return NextResponse.json({ ok: true, btcsig: sig });
}
