import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { SiteHeader } from "@/components/SiteHeader";

async function getProducts(): Promise<{ products: ProductCardData[]; error: string | null }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, title, price, status, condition, location_city, product_photos(photo_url, is_cover), sellers(business_name, verification_status)"
      )
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(24);

    if (error) return { products: [], error: error.message };

    const products: ProductCardData[] = (data ?? []).map((p) => {
      const photos = (p as { product_photos?: { photo_url: string; is_cover: boolean }[] }).product_photos;
      const cover = photos?.find((ph) => ph.is_cover)?.photo_url ?? photos?.[0]?.photo_url ?? null;
      const sellerRaw = (p as { sellers?: { business_name: string; verification_status: string }[] }).sellers;
      const seller = sellerRaw?.[0];

      return {
        id: p.id,
        title: p.title,
        price: p.price,
        condition: p.condition,
        location_city: p.location_city,
        coverPhoto: cover,
        sellerName: seller?.business_name ?? null,
        sellerVerified: seller?.verification_status === "approved",
      };
    });

    return { products, error: null };
  } catch {
    return { products: [], error: "not_configured" };
  }
}

async function getCategories() {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("categories")
      .select("id, name")
      .is("parent_category_id", null)
      .order("name");
    return data ?? [];
  } catch {
    return [];
  }
}

export default async function Home() {
  const [{ products, error }, categories] = await Promise.all([
    getProducts(),
    getCategories(),
  ]);

  return (
    <>
      <SiteHeader />

      {categories.length > 0 && (
        <div className="border-b bg-white" style={{ borderColor: "var(--sand)" }}>
          <div className="max-w-6xl mx-auto px-4 py-2.5 flex gap-2 overflow-x-auto">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/search?category=${c.id}`}
                className="whitespace-nowrap rounded-full border px-3 py-1 text-xs hover:bg-[--sand] transition-colors"
                style={{ borderColor: "var(--sand)" }}
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <main className="flex-1 max-w-6xl mx-auto px-4 py-6 w-full">
        {error === "not_configured" && (
          <div
            className="rounded-lg border p-6 mb-8 text-sm"
            style={{ borderColor: "var(--gold)", background: "#fbf3df" }}
          >
            <p className="font-medium mb-1">⚠ Supabase isn&apos;t connected yet</p>
            <p>
              Copy <code>.env.local.example</code> to <code>.env.local</code>, add your
              Project URL and anon key from Supabase → Settings → API, then restart the
              dev server. This page will populate automatically once it&apos;s connected.
            </p>
          </div>
        )}

        {error && error !== "not_configured" && (
          <div className="rounded-lg border p-6 mb-8 text-sm" style={{ borderColor: "#e0a0a0", background: "#fdf0f0" }}>
            <p className="font-medium mb-1">Couldn&apos;t load listings</p>
            <p>{error}. Try refreshing. If this keeps happening, check your Supabase connection.</p>
          </div>
        )}

        <h1 className="font-display text-2xl mb-4" style={{ color: "var(--ink)" }}>
          Fresh listings
        </h1>

        {products.length === 0 && error !== "not_configured" && !error && (
          <div
            className="rounded-lg border p-10 text-center"
            style={{ borderColor: "var(--sand)" }}
          >
            <p className="font-medium mb-1">No listings yet</p>
            <p className="text-sm text-gray-500 mb-4">
              Be the first seller in your area. Verification takes just a few minutes.
            </p>
            <Link
              href="/signup"
              className="inline-block rounded-full px-5 py-2 text-white text-sm font-medium"
              style={{ background: "var(--indigo)" }}
            >
              Start selling
            </Link>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </main>

      <footer className="border-t py-6 text-center text-xs text-gray-500" style={{ borderColor: "var(--sand)" }}>
        Teraa · Bank transfer, mobile money, and cash on delivery available ·{" "}
        <Link href="/safety" className="underline">How safety works</Link>
      </footer>
    </>
  );
}
