import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { SiteHeader } from "@/components/SiteHeader";
import { FilterBar } from "@/components/SearchBar";
import type { ProductCondition } from "@/types/database";

interface SearchParams {
  q?: string;
  city?: string;
  condition?: string;
  sort?: string;
  min?: string;
  max?: string;
  category?: string;
}

async function getCategoryName(id?: string) {
  if (!id) return null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("categories").select("name").eq("id", id).single();
    return data?.name ?? null;
  } catch {
    return null;
  }
}

async function searchProducts(params: SearchParams) {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("products")
      .select(
        "id, title, price, status, condition, location_city, product_photos(photo_url, is_cover), sellers(business_name, verification_status)"
      )
      .eq("status", "active");

    if (params.q) query = query.ilike("title", `%${params.q}%`);
    if (params.city) query = query.eq("location_city", params.city);
    if (params.condition) query = query.eq("condition", params.condition);
    if (params.category) query = query.eq("category_id", params.category);
    if (params.min) query = query.gte("price", Number(params.min));
    if (params.max) query = query.lte("price", Number(params.max));

    if (params.sort === "price_asc") query = query.order("price", { ascending: true });
    else if (params.sort === "price_desc") query = query.order("price", { ascending: false });
    else query = query.order("created_at", { ascending: false });

    const { data, error } = await query.limit(48);
    if (error) return { products: [] as ProductCardData[], error: error.message };

    const products: ProductCardData[] = (data ?? []).map((p) => {
      const photos = (p as { product_photos?: { photo_url: string; is_cover: boolean }[] }).product_photos;
      const cover = photos?.find((ph) => ph.is_cover)?.photo_url ?? photos?.[0]?.photo_url ?? null;
      const sellerRaw = (p as { sellers?: { business_name: string; verification_status: string }[] }).sellers;
      const seller = sellerRaw?.[0];
      return {
        id: p.id,
        title: p.title,
        price: p.price,
        condition: p.condition as ProductCondition,
        location_city: p.location_city,
        coverPhoto: cover,
        sellerName: seller?.business_name ?? null,
        sellerVerified: seller?.verification_status === "approved",
      };
    });

    return { products, error: null };
  } catch {
    return { products: [] as ProductCardData[], error: "not_configured" };
  }
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [{ products, error }, categoryName] = await Promise.all([
    searchProducts(params),
    getCategoryName(params.category),
  ]);

  const activeFilters: { label: string; clearHref: string }[] = [];
  const baseParams = new URLSearchParams(params as Record<string, string>);

  if (params.q) {
    const p = new URLSearchParams(baseParams); p.delete("q");
    activeFilters.push({ label: `"${params.q}"`, clearHref: `/search?${p.toString()}` });
  }
  if (categoryName) {
    const p = new URLSearchParams(baseParams); p.delete("category");
    activeFilters.push({ label: categoryName, clearHref: `/search?${p.toString()}` });
  }
  if (params.city) {
    const p = new URLSearchParams(baseParams); p.delete("city");
    activeFilters.push({ label: params.city, clearHref: `/search?${p.toString()}` });
  }
  if (params.condition) {
    const p = new URLSearchParams(baseParams); p.delete("condition");
    activeFilters.push({ label: params.condition.replace(/_/g, " "), clearHref: `/search?${p.toString()}` });
  }
  if (params.min || params.max) {
    const p = new URLSearchParams(baseParams); p.delete("min"); p.delete("max");
    activeFilters.push({
      label: `GMD ${params.min ?? "0"} – ${params.max ?? "∞"}`,
      clearHref: `/search?${p.toString()}`,
    });
  }

  return (
    <>
      <SiteHeader searchQuery={params.q} />

      <div className="border-b bg-white" style={{ borderColor: "var(--sand)" }}>
        <div className="max-w-6xl mx-auto px-4 py-3">
          <FilterBar
            activeCity={params.city}
            activeCondition={params.condition}
            activeSort={params.sort}
            activeMinPrice={params.min}
            activeMaxPrice={params.max}
          />
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {error === "not_configured" && (
          <div className="rounded-lg border p-6 mb-6 text-sm" style={{ borderColor: "var(--gold)", background: "#fbf3df" }}>
            <p className="font-medium mb-1">⚠ Supabase isn&apos;t connected yet</p>
            <p>Connect your Supabase project to see live search results.</p>
          </div>
        )}

        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h1 className="font-display text-xl" style={{ color: "var(--ink)" }}>
            {products.length} result{products.length === 1 ? "" : "s"}
          </h1>

          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {activeFilters.map((f) => (
                <Link
                  key={f.label}
                  href={f.clearHref}
                  className="rounded-full border px-2.5 py-1 text-xs flex items-center gap-1 bg-white hover:bg-[--sand]"
                  style={{ borderColor: "var(--sand)" }}
                >
                  {f.label} <span className="text-gray-400">×</span>
                </Link>
              ))}
              <Link
                href="/search"
                className="text-xs underline text-gray-500 px-1 py-1"
              >
                Clear all
              </Link>
            </div>
          )}
        </div>

        {products.length === 0 && error !== "not_configured" && (
          <div className="rounded-lg border p-10 text-center" style={{ borderColor: "var(--sand)" }}>
            <p className="font-medium mb-1">
              {params.q ? `No results for "${params.q}"` : "No listings match these filters"}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Try a broader search, fewer filters, or check back soon. New listings are added daily.
            </p>
            <Link href="/search" className="text-sm underline" style={{ color: "var(--indigo)" }}>
              Clear all filters
            </Link>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </main>
    </>
  );
}
