#!/bin/sh
# btc-bitcoind entrypoint. The base image
# (ghcr.io/willitmod/axebtc-bitcoind-switch:0.7.44) defaults to running a
# Node.js orchestrator (`node dist/server.js`) but we don't want that — we
# just want bitcoind. The image bundles Bitcoin Core binaries at
# /opt/bitcoind/current/bitcoind (symlinked to a specific version), and
# /opt/bitcoind/current is on PATH, so we can `exec bitcoind` directly.
#
# Mirrors AxeBTC's own minimal entrypoint pattern.

set -u

echo "[btc-bitcoind] entrypoint starting"

if ! command -v bitcoind >/dev/null 2>&1; then
  echo "[btc-bitcoind] ERROR: bitcoind not found in PATH"
  exit 127
fi

extra=""
if [ -f /data/.reindex-chainstate ]; then
  echo "[btc-bitcoind] reindex-chainstate flag present"
  rm -f /data/.reindex-chainstate || true
  extra="-reindex-chainstate"
fi

# Solo-mining tuning. bitcoin.conf has these too, but specifying on the
# command line guarantees they apply even if a future migration rewrites
# the conf file.
TUNING="-dbcache=6144-rpcworkqueue=64 -rpcthreads=8"

echo "[btc-bitcoind] exec: bitcoind -datadir=/data -printtoconsole $TUNING $extra"
exec bitcoind -datadir=/data -printtoconsole $TUNING $extra
