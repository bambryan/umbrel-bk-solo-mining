import { promises as fs } from "fs";

const CONFIG_PATH = process.env.CKPOOL_CONFIG_PATH || "/ckpool-config/ckpool.conf";

export interface CkpoolConfig {
  btcaddress: string;
  btcsig: string;
  mindiff: number;
  maxdiff: number;
  startdiff: number;
  [k: string]: unknown;
}

export async function readConfig(): Promise<CkpoolConfig> {
  const text = await fs.readFile(CONFIG_PATH, "utf8");
  return JSON.parse(text);
}

export async function writeConfig(patch: Partial<CkpoolConfig>): Promise<CkpoolConfig> {
  const current = await readConfig();
  const next = { ...current, ...patch };
  await fs.writeFile(CONFIG_PATH, JSON.stringify(next, null, 2) + "\n", "utf8");
  return next;
}
