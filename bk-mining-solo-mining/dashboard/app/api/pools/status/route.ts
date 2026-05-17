import { NextResponse } from "next/server";
import { getEnabledPoolIdsFromState, getAvailablePools } from "@/lib/poolEnabled";
import { poolContainerStatus } from "@/lib/poolControl";
import { getPool, type PoolId } from "@/lib/poolRegistry";

// GET /api/pools/status
// Returns the install/enable state for every available pool, plus container
// status, so the UI can decide what controls to show (Enable / Disable /
// Running / Container missing / etc).
export async function GET() {
  const available = getAvailablePools();
  const enabled = new Set(await getEnabledPoolIdsFromState());

  const pools = await Promise.all(
    available.map(async (id: PoolId) => {
      const def = getPool(id);
      const containers = await poolContainerStatus(id).catch(() => ({} as Record<string, string>));
      const containerStates = Object.values(containers);
      const allRunning = containerStates.length > 0 && containerStates.every((s) => s === "running");
      const allMissing = containerStates.length > 0 && containerStates.every((s) => s === "missing");
      return {
        pool: id,
        displayName: def.displayName,
        fullName: def.fullName,
        enabled: enabled.has(id),
        allRunning,
        allMissing,
        containers,
      };
    })
  );

  return NextResponse.json({ pools });
}
