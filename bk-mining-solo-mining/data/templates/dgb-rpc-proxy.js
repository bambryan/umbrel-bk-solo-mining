// dgb-rpc-proxy.js — tiny HTTP proxy that sits between our ckpool and
// digibyted. Only purpose: inject "sha256d" as the positional algo arg on
// every getblocktemplate call. Everything else passes through unchanged.
//
// Why this exists: DGB uses 5 mining algos and its getblocktemplate's
// default is `scrypt` (version 0x20000002). ckpool is BTC-style and doesn't
// know to pass an algo arg, so it was distributing scrypt-tagged work that
// miners then hashed via SHA-256d (their only algo). Submitted blocks got
// rejected because digibyted ran scrypt() to verify, got a different hash,
// and rejected. With this proxy, ckpool gets sha256d-tagged templates
// (version 0x20000202) and miners' submissions verify correctly.
//
// Zero deps — uses only Node's built-in http module.

const http = require("http");

const UPSTREAM_HOST = process.env.UPSTREAM_HOST || "dgb-bitcoind";
const UPSTREAM_PORT = parseInt(process.env.UPSTREAM_PORT || "14022", 10);
const LISTEN_PORT = parseInt(process.env.LISTEN_PORT || "14022", 10);
const ALGO = process.env.DGB_ALGO || "sha256d";

function logRpcRewrite(method, before, after) {
  // Keep logs minimal — one short line per rewritten call.
  console.log(`[proxy] rewrote ${method}: params ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
}

function rewriteBody(bodyStr) {
  let body;
  try { body = JSON.parse(bodyStr); } catch { return bodyStr; }

  const items = Array.isArray(body) ? body : [body];
  let changed = false;
  for (const item of items) {
    if (!item || typeof item !== "object" || item.method !== "getblocktemplate") continue;
    const params = Array.isArray(item.params) ? item.params : [];
    // Standard call: getblocktemplate({rules:[...]}) - 1 param. We add algo as
    // a SECOND positional arg per DGB's RPC signature:
    //   getblocktemplate ( {...} "algo" )
    if (params.length <= 1) {
      const before = params.slice();
      params[0] = params[0] ?? { rules: ["segwit"] };
      params[1] = ALGO;
      item.params = params;
      logRpcRewrite("getblocktemplate", before, params);
      changed = true;
    } else if (params.length === 2 && params[1] !== ALGO) {
      // ckpool unexpectedly already passed an algo — overwrite if it's not ours.
      const before = params.slice();
      params[1] = ALGO;
      item.params = params;
      logRpcRewrite("getblocktemplate", before, params);
      changed = true;
    }
  }
  if (!changed) return bodyStr;
  return JSON.stringify(Array.isArray(body) ? items : items[0]);
}

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const inBody = Buffer.concat(chunks).toString("utf8");
    const outBody = inBody ? rewriteBody(inBody) : "";

    // Strip headers that depend on body content. Node sets these correctly
    // when we write the new body.
    const fwdHeaders = { ...req.headers };
    delete fwdHeaders["content-length"];
    delete fwdHeaders["host"];
    delete fwdHeaders["transfer-encoding"];

    const upstreamReq = http.request({
      host: UPSTREAM_HOST,
      port: UPSTREAM_PORT,
      method: req.method,
      path: req.url,
      headers: { ...fwdHeaders, "content-length": Buffer.byteLength(outBody) },
    }, (upstreamRes) => {
      // Stream the response straight back.
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    });

    upstreamReq.on("error", (err) => {
      console.error(`[proxy] upstream error: ${err.message}`);
      if (!res.headersSent) {
        res.writeHead(502, { "content-type": "text/plain" });
        res.end(`upstream error: ${err.message}`);
      } else {
        res.end();
      }
    });

    if (outBody) upstreamReq.write(outBody);
    upstreamReq.end();
  });

  req.on("error", (err) => {
    console.error(`[proxy] req error: ${err.message}`);
  });
});

server.listen(LISTEN_PORT, "0.0.0.0", () => {
  console.log(`[proxy] listening on :${LISTEN_PORT}, upstream=${UPSTREAM_HOST}:${UPSTREAM_PORT}, algo=${ALGO}`);
});
