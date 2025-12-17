import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Do not fail production builds on ESLint errors; still run ESLint locally/CI
  async headers() {
    return [
      {
        source: "/invoices/receipt/:id",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/settings/barcodes/print/:productId/:labels",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
  // Enable Turbopack (Next.js 16+)
  turbopack: {},
};

export default nextConfig;
