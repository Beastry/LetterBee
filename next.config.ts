import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath:
    process.env.NEXT_PUBLIC_BASE_PATH ??
    (process.env.NODE_ENV === "production" ? "/letterbee" : ""),
  // User-owned runtime files and local secrets are never deployment assets.
  outputFileTracingExcludes: {
    "*": ["./data/mail/**", "./data/mail-media/**", "./.env*", "./.dev.vars*"],
  },
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
