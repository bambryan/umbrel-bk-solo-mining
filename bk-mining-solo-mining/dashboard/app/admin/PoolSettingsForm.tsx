"use client";

import { useState } from "react";
import { type PoolSettings, VARDIFF_PRESETS } from "@/lib/poolSettings.types";

type Props = { initial: PoolSettings; pool: "bch" | "btc" };

const PRESET_NAMES = Object.keys(VARDIFF_PRESETS);
const CUSTOM = "Custom";

// Match the loaded mindiff/start/max against a preset name so the dropdown
// shows the right value when the page first loads.
function detectPreset(p: PoolSettings): string {
  for (const [name, cfg] of Object.entries(VARDIFF_PRESETS)) {
    if (p.mindiff === cfg.mindiff && p.startdiff === cfg.startdiff && p.maxdiff === cfg.maxdiff) {
      return name;
    }
  }
  return CUSTOM;
}

export function PoolSettingsForm({ initial, pool }: Props) {
  const [s, setS] = useState<PoolSettings>(initial);
  const [preset, setPreset] = useState<string>(detectPreset(initial));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function update<K extends keyof PoolSettings>(k: K, v: PoolSettings[K]) {
    setS((cur) => ({ ...cur, [k]: v }));
    if (k === "mindiff" || k === "startdiff" || k === "maxdiff") setPreset(CUSTOM);
  }

  function applyPreset(name: string) {
    setPreset(name);
    if (name === CUSTOM) return;
    const cfg = VARDIFF_PRESETS[name];
    if (!cfg) return;
    setS((cur) => ({ ...cur, ...cfg }));
  }

  async function onSave() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/pool-settings?pool=${pool}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      });
      if (!res.ok) throw new Error(await res.text());
      setMsg({ kind: "ok", text: "Saved. ckpool restarting — miners will reconnect in seconds." });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Payout */}
      <div>
        <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Payout address</label>
        <input
          value={s.btcaddress}
          onChange={(e) => update("btcaddress", e.target.value.trim())}
          className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
          placeholder={pool === "btc" ? "1… or 3… or bc1…" : "1… or 3… or bitcoincash:…"}
        />
        <p className="text-xs text-slate-500 mt-1">
          Default coinbase address when{" "}
          <span className="text-slate-300">Use miner username</span>{" "}
          is off (or when a miner connects without a valid address).{" "}
          {pool === "btc"
            ? "Legacy (1…/3…) and bech32 (bc1…) accepted."
            : "Legacy (1…/3…) and CashAddr (q…/p…) accepted."}
        </p>
      </div>

      {/* -B toggle */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={s.useMinerUsername}
          onChange={(e) => update("useMinerUsername", e.target.checked)}
          className="mt-1 accent-amber-500"
        />
        <div>
          <div className="text-sm text-slate-200">Use miner username as payout (-B)</div>
          <div className="text-xs text-slate-500 mt-0.5">
            On: each miner's stratum username becomes their own payout address when they solve a block —
            useful if you let others mine. Off: every block pays the address above no matter what miners send.
          </div>
        </div>
      </label>

      {/* Coinbase sig */}
      <div>
        <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Coinbase signature</label>
        <input
          value={s.btcsig}
          onChange={(e) => update("btcsig", e.target.value)}
          className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
          placeholder="/solo mined by BK/"
        />
        <p className="text-xs text-slate-500 mt-1">Shows on block explorers next to your block's txid.</p>
      </div>

      {/* Vardiff */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm text-slate-200">Difficulty (vardiff)</div>
            <div className="text-xs text-slate-500 mt-0.5">
              ckpool auto-tunes share difficulty per miner. Pick a preset based on your largest ASIC,
              or hand-tune the three values.
            </div>
          </div>
          <select
            value={preset}
            onChange={(e) => applyPreset(e.target.value)}
            className="rounded-md bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm shrink-0"
          >
            {PRESET_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
            <option value={CUSTOM}>Custom</option>
          </select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Min diff</label>
            <input
              type="number"
              min={0}
              value={s.mindiff}
              onChange={(e) => update("mindiff", parseInt(e.target.value, 10) || 0)}
              className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Start diff</label>
            <input
              type="number"
              min={0}
              value={s.startdiff}
              onChange={(e) => update("startdiff", parseInt(e.target.value, 10) || 0)}
              className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Max diff</label>
            <input
              type="number"
              min={0}
              value={s.maxdiff}
              onChange={(e) => update("maxdiff", parseInt(e.target.value, 10) || 0)}
              className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm font-mono"
            />
            <p className="text-xs text-slate-500 mt-1">0 = no upper limit.</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={saving}
          className="rounded-md bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-semibold px-4 py-2 text-sm"
        >
          {saving ? "Saving…" : "Save & restart ckpool"}
        </button>
        {msg && (
          <span className={"text-sm " + (msg.kind === "ok" ? "text-emerald-400" : "text-red-400")}>
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
