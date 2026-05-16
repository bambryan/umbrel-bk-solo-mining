import { NextResponse } from "next/server";
import { tailLogs } from "@/lib/docker";

const MAP: Record<string, string> = {
  ckpool: process.env.CKPOOL_CONTAINER || "bk-mining-solo-mining_ckpool_1",
  bchn: process.env.BCHN_CONTAINER || "bk-mining-solo-mining_bchn_1",
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const service = url.searchParams.get("service") ?? "ckpool";
  const tail = Math.min(2000, Math.max(10, parseInt(url.searchParams.get("tail") ?? "200", 10)));
  const name = MAP[service];
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
