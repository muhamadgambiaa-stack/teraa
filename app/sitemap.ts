import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const SITE_URL = "https://www.getteraa.com";

export const revalidate = 3600;

const publicPages: MetadataRoute.Sitemap = [
  { url: SITE_URL, changeFrequency: "daily", priority: 1 },
  { url: `${SITE_URL}/search`, changeFrequency: "daily", priority: 0.9 },
  { url: `${SITE_URL}/signup`, changeFrequency: "monthly", priority: 0.6 },
  {
    url: `${SITE_URL}/seller/register`,
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    url: `${SITE_URL}/marketplace-rules`,
    changeFrequency: "monthly",
    priority: 0.5,
  },
  { url: `${SITE_URL}/safety`, changeFrequency: "monthly", priority: 0.5 },
  { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
  {
    url: `${SITE_URL}/seller/terms`,
    changeFrequency: "yearly",
    priority: 0.3,
  },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return publicPages;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await supabase
      .from("products")
      .select("id, created_at")
      .in("status", ["active", "out_of_stock"])
      .order("created_at", { ascending: false })
      .limit(10000);

    if (error || !data) {
      console.error("Could not load products for sitemap:", error);
      return publicPages;
    }

    const productPages: MetadataRoute.Sitemap = data.map((product) => ({
      url: `${SITE_URL}/products/${product.id}`,
      lastModified: new Date(product.created_at),
      changeFrequency: "weekly",
      priority: 0.8,
    }));

    return [...publicPages, ...productPages];
  } catch (error) {
    console.error("Could not generate product sitemap:", error);
    return publicPages;
  }
}
