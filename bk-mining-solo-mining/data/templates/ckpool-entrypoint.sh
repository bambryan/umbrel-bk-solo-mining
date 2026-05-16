#!/bin/sh
# ckpool entrypoint. Reads optional sentinel files from /config to build the
# argv. Externalized from docker-compose so the dashboard's admin UI can
# toggle ckpool flags by writing files instead of touching compose itself.
#
# Sentinels:
#   /config/_use_miner_username  if present  → add -B (btcsolo): each miner's
#                                              stratum username becomes their
#                                              own payout address when they
#                                              solve a block.
#                                if absent   → all blocks pay to btcaddress
#                                              from ckpool.conf regardless of
#                                              the miner's username.

set -u

# Clear stale pid files from a previous unclean stop (Docker preserves the
# container's writable layer across restarts, so ckpool can think it's still
# running).
rm -f /tmp/ckpool/*.pid 2>/dev/null || true

FLAGS="-k -L"
if [ -f /config/_use_miner_username ]; then
  FLAGS="$FLAGS -B"
  echo "[ckpool-entrypoint] -B (use miner username as payout) ENABLED"
else
  echo "[ckpool-entrypoint] -B disabled — all blocks pay to btcaddress in ckpool.conf"
fi

echo "[ckpool-entrypoint] exec: ckpool $FLAGS -c /config/ckpool.conf"

if command -v ckpool >/dev/null 2>&1; then
  exec ckpool $FLAGS -c /config/ckpool.conf
elif [ -x /bin/ckpool ]; then
  exec /bin/ckpool $FLAGS -c /config/ckpool.conf
elif [ -x /usr/bin/ckpool ]; then
  exec /usr/bin/ckpool $FLAGS -c /config/ckpool.conf
else
  echo "[ckpool-entrypoint] ckpool binary not found in image"
  exit 1
fi
