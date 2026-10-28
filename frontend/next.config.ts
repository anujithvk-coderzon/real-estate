import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${process.env.BACKEND_ORIGIN}/:path*` },
    ];
  },
  allowedDevOrigins: [
    "192.168.1.5",
    "192.168.1.*",
    "planning-bald-police-kills.trycloudflare.com",
  ],
};

export default nextConfig;
