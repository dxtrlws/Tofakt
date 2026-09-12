import type { NextConfig } from "next";
import { lanDevOrigins } from "./lib/dev-origins";

const nextConfig: NextConfig = {
  allowedDevOrigins: lanDevOrigins(),
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "argon2", "pino"],
  outputFileTracingIncludes: {
    "/*": ["./drizzle/**/*"],
  },
  outputFileTracingExcludes: {
    "/*": ["./data/**/*"],
  },
};

export default nextConfig;
