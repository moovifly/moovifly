import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
  /** Redirecionamento na própria Vercel (além do middleware) — garante apex → www em produção. */
  async redirects() {
    if (process.env.VERCEL_ENV !== "production") {
      return [];
    }
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "moovifly.com" }],
        destination: "https://www.moovifly.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
