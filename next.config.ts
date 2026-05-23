import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  allowedDevOrigins: ["192.168.0.102", "192.168.0.*", "192.168.1.*"],
};

export default nextConfig;
