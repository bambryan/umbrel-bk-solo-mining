import { NextResponse } from "next/server";

export async function GET() {
  const port = Number(process.env.STRATUM_PORT) || 4567;
  return NextResponse.json({ port });
}
