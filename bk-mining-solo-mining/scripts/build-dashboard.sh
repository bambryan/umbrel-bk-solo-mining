#!/bin/sh
# Build the dashboard image on the host.
# Run before installing / upgrading this app:
#   ssh umbrel@<host>
#   sudo bash /home/umbrel/umbrel/app-data/bk-mining-solo-mining/scripts/build-dashboard.sh
#
# Why this isn't done by Umbrel's install: umbreld runs docker compose with a
# working directory outside the app dir, so a `build:` directive's relative
# context path resolves to the wrong place. Building manually side-steps that.

set -eu

VERSION="${1:-0.1.0}"
DIR="$(cd "$(dirname "$0")/.." && pwd)/dashboard"

echo "[build-dashboard] context=$DIR tag=bk-mining-solo-mining-dashboard:$VERSION"
docker build -t "bk-mining-solo-mining-dashboard:$VERSION" "$DIR"
echo "[build-dashboard] done. Now (re)start the app from the Umbrel UI."
