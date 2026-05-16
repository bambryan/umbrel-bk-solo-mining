import { NextResponse } from "next/server";
import { restartContainer } from "@/lib/docker";

const MAP: Record<string, string> = {
  ckpool: process.env.CKPOOL_CONTAINER || "bk-mining-solo-mining_ckpool_1",
  bchn: process.env.BCHN_CONTAINER || "bk-mining-solo-mining_bchn_1",
};

export async function POST(req: Request) {
  const body = (await req.json()) as { service?: string };
  const name = MAP[body.service ?? ""];
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
