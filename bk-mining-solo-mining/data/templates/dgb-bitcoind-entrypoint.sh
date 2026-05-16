#!/bin/sh
# dgb-bitcoind entrypoint. The willitmod/digibyte image is built around the
# `digibyted` binary (DGB's bitcoind fork) and `digibyte-cli` for RPC. We
# just need to exec digibyted with our datadir + tuning flags.

set -u

echo "[dgb-bitcoind] entrypoint starting"

if ! command -v digibyted >/dev/null 2>&1; then
  echo "[dgb-bitcoind] ERROR: digibyted not found in PATH"
  exit 127
fi

extra=""
if [ -f /data/.reindex-chainstate ]; then
  echo "[dgb-bitcoind] reindex-chainstate flag present"
  rm -f /data/.reindex-chainstate || true
  extra="-reindex-chainstate"
fi

# Same tuning as BCH/BTC — values come from bitcoin.conf too but command line
# wins, so this guarantees them.
TUNING="-dbcache=2048 -rpcworkqueue=64 -rpcthreads=8"

echo "[dgb-bitcoind] exec: digibyted -datadir=/data -printtoconsole $TUNING $extra"
exec digibyted -datadir=/data -printtoconsole $TUNING $extra
