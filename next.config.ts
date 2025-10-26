import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stabilize file watching on Windows to mitigate transient ENOENT on temp files
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      // Use polling watcher in dev to avoid race conditions on some filesystems/antivirus setups
      // Only set when available (webpack 5) — safe no-op otherwise
      (config as any).watchOptions = {
        ...(config as any).watchOptions,
        poll: 1000,
        aggregateTimeout: 300,
        ignored: ["**/.git/**", "**/node_modules/**"],
      };
    }
    return config;
  },
};

export default nextConfig;
