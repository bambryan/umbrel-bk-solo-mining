import { NextRequest, NextResponse } from "next/server";

// HTTP Basic Auth gate for the admin UI and every mutating/admin API route.
// Hiding the nav link is not enough — these endpoints can restart the node and
// ckpool and rewrite pool config, so the routes themselves must be protected.
//
// Credentials come from env: ADMIN_USER (default "admin") + ADMIN_PASSWORD.
// Fail closed: if ADMIN_PASSWORD is unset, admin returns 503 (never wide open).

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

function unauthorized() {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="BK Mining Admin", charset="UTF-8"' },
  });
}

export function middleware(req: NextRequest) {
  if (!ADMIN_PASSWORD) {
    return new NextResponse(
      "Admin is disabled: set ADMIN_PASSWORD to enable it.",
      { status: 503 },
    );
  }

  const header = req.headers.get("authorization") || "";
  if (header.startsWith("Basic ")) {
    let decoded = "";
    try {
      decoded = atob(header.slice(6));
    } catch {
      return unauthorized();
    }
    const sep = decoded.indexOf(":");
    const user = sep >= 0 ? decoded.slice(0, sep) : decoded;
    const pass = sep >= 0 ? decoded.slice(sep + 1) : "";
    if (user === ADMIN_USER && pass === ADMIN_PASSWORD) {
      return NextResponse.next();
    }
  }
  return unauthorized();
}

// Gate the admin page + every admin/mutating API route. Public read-only stats
// (overview, workers, blocks, pools, profit) stay open.
export const config = {
  matcher: [
    "/admin/:path*",
    "/api/pool-settings/:path*",
    "/api/restart/:path*",
    "/api/btcsig/:path*",
    "/api/pools/enable/:path*",
    "/api/pools/disable/:path*",
    "/api/logs/:path*",
  ],
};
