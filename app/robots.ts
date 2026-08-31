import type { MetadataRoute } from "next";

const SITE_URL = "https://www.getteraa.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/account",
        "/admin",
        "/api",
        "/callback",
        "/check-email",
        "/favorites",
        "/messages",
        "/notifications",
        "/orders",
        "/reset-password",
        "/seller/dashboard",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
