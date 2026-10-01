import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const storagePattern = storageUrl?.startsWith("https://")
  ? new URL("/storage/v1/object/public/**", storageUrl)
  : null;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: storagePattern ? [{ protocol: "https", hostname: storagePattern.hostname, port: storagePattern.port, pathname: storagePattern.pathname }] : [],
    formats: ["image/webp"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
