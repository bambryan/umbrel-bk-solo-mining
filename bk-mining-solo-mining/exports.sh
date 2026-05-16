# Umbrel sources this file before bringing the app up. Use it to compute /
# expose env vars referenced from docker-compose.yml. Keep secret-free —
# anything sensitive should be in APP_PASSWORD which Umbrel manages.

export APP_BCH_P2P_PORT="28333"
export APP_BCH_RPC_PORT="28332"
export APP_BCH_ZMQ_HASHBLOCK_PORT="28334"
export APP_CKPOOL_STRATUM_PORT="4567"
