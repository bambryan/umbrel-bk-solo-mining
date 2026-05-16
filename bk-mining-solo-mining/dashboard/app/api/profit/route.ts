import { NextResponse } from "next/server";
import { computeAllProfits } from "@/lib/profitability";

export async function GET() {
  try {
    const profits = await computeAllProfits();
    return NextResponse.json({ ts: Math.floor(Date.now() / 1000), profits });
  } catch (e) {
    return new NextResponse(
      `Profit calc failed: ${e instanceof Error ? e.message : String(e)}`,
      { status: 500 }
    );
  }
}
