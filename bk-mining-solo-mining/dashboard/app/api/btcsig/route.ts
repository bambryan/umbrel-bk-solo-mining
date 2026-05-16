import { NextResponse } from "next/server";
import { writeConfig } from "@/lib/ckpoolConfig";
import { restartContainer } from "@/lib/docker";

const CKPOOL_CONTAINER = process.env.CKPOOL_CONTAINER || "bk-mining-solo-mining_ckpool_1";

export async function PATCH(req: Request) {
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

  await writeConfig({ btcsig: sig });
  // Fire-and-forget restart — don't make the client wait.
  restartContainer(CKPOOL_CONTAINER).catch((e) => {
    console.error("[btcsig] ckpool restart failed:", e);
  });
  return NextResponse.json({ ok: true, btcsig: sig });
}
