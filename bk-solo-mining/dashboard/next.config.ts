import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // dockerode pulls in ssh2 (with native bindings) for the SSH transport.
  // Turbopack/webpack both choke on it. We don't use SSH transport — we
  // talk to /var/run/docker.sock directly — but bundling tries to follow
  // the import graph anyway. Keep these server-only and require'd at runtime.
  serverExternalPackages: ["dockerode", "docker-modem", "ssh2", "cpu-features"],
};

export default nextConfig;
