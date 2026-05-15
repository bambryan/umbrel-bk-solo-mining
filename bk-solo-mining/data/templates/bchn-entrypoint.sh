#!/bin/sh
set -eu

echo "[bk-solo-mining] BCHN entrypoint starting"

if ! command -v bitcoind >/dev/null 2>&1; then
  echo "[bk-solo-mining] ERROR: bitcoind not found in PATH"
  exit 127
fi

extra=""
if [ -f /data/.reindex-chainstate ]; then
  echo "[bk-solo-mining] Reindex requested (chainstate)."
  rm -f /data/.reindex-chainstate || true
  extra="-reindex-chainstate"
fi

# Solo-mining tuning. All non-default flags live in this entrypoint so a
# docker-compose pull never silently wipes them.
#   dbcache=2048      : larger UTXO cache for faster getblocktemplate
#   rpcworkqueue=64   : ckpool floods RPC after a new block; default 16 is small
#   rpcthreads=8      : default 4 caps parallel RPC handling
TUNING="-dbcache=2048 -rpcworkqueue=64 -rpcthreads=8"

echo "[bk-solo-mining] Exec: bitcoind -datadir=/data -printtoconsole $TUNING $extra"
exec bitcoind -datadir=/data -printtoconsole $TUNING $extra
