// Client-safe types + constants for pool settings. Keep this file free of
// fs/path/Node-only imports so the admin form (a client component) can use
// it without dragging server-only code into the browser bundle.

export interface PoolSettings {
  btcaddress: string;
  btcsig: string;
  mindiff: number;
  maxdiff: number;
  startdiff: number;
  useMinerUsername: boolean;
}

// Named vardiff presets. Matches AxeBTC's groupings so users coming from
// that UI find familiar names.
export const VARDIFF_PRESETS: Record<string, { mindiff: number; startdiff: number; maxdiff: number }> = {
  "Mixed default":           { mindiff: 128,  startdiff: 512,   maxdiff: 8192 },
  "Big fleet (high TH/s)":   { mindiff: 1024, startdiff: 65536, maxdiff: 0 },
  "Small ASICs (Bitaxe)":    { mindiff: 128,  startdiff: 128,   maxdiff: 2048 },
};
