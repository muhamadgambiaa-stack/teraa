import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { SiteHeader } from "@/components/SiteHeader";

async function getProducts(): Promise<{
  products: ProductCardData[];
  error: string | null;
}> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("products")
      .select(
        `
        id,
        title,
        price,
        status,
        condition,
        location_city,
        product_photos(
          photo_url,
          is_cover
        ),
        sellers(
          business_name,
          verification_status
        )
        `,
      )
      .eq("status", "active")
      .order("created_at", {
        ascending: false,
      })
      .limit(30);

    if (error) {
      return {
        products: [],
        error: error.message,
      };
    }

    const products: ProductCardData[] = (data ?? []).map((product) => {
      const photos =
        (
          product as {
            product_photos?: {
              photo_url: string;
              is_cover: boolean;
            }[];
          }
        ).product_photos ?? [];

      const cover =
        photos.find((photo) => photo.is_cover)?.photo_url ??
        photos[0]?.photo_url ??
        null;

      const sellerRaw = (
        product as {
          sellers?:
            | {
                business_name: string;
                verification_status: string;
              }
            | {
                business_name: string;
                verification_status: string;
              }[];
        }
      ).sellers;

      const seller = Array.isArray(sellerRaw) ? sellerRaw[0] : sellerRaw;

      return {
        id: product.id,
        title: product.title,
        price: product.price,
        condition: product.condition,
        location_city: product.location_city,
        coverPhoto: cover,
        sellerName: seller?.business_name ?? null,
        sellerVerified: seller?.verification_status === "approved",
      };
    });

    return {
      products,
      error: null,
    };
  } catch {
    return {
      products: [],
      error: "not_configured",
    };
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

      {/* CATEGORY BAR */}

      {categories.length > 0 && (
        <div
          className="border-b bg-white"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/search?category=${category.id}`}
                className="whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] sm:text-xs hover:bg-gray-50 transition"
                style={{
                  borderColor: "var(--sand)",
                }}
              >
                {category.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* MAIN */}

      <main className="flex-1 max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 w-full pb-24 sm:pb-6">
        {error === "not_configured" && (
          <div
            className="rounded-xl border p-5 mb-6 text-sm"
            style={{
              borderColor: "var(--gold)",
              background: "#fbf3df",
            }}
          >
            <p className="font-medium mb-1">
              Supabase isn&apos;t connected yet
            </p>

            <p className="text-gray-600">
              Add your Supabase project URL and anon key to your environment
              variables, then restart the development server.
            </p>
          </div>
        )}

        {error && error !== "not_configured" && (
          <div
            className="rounded-xl border p-5 mb-6 text-sm"
            style={{
              borderColor: "#e0a0a0",
              background: "#fdf0f0",
            }}
          >
            <p className="font-medium mb-1">Couldn&apos;t load listings</p>

            <p className="text-gray-600">{error}. Try refreshing the page.</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 mb-3 sm:mb-4">
          <div>
            <h1
              className="font-display text-xl sm:text-2xl"
              style={{
                color: "var(--ink)",
              }}
            >
              Fresh listings
            </h1>

            <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5">
              Latest products on Teraa
            </p>
          </div>

          <Link
            href="/search"
            className="text-xs font-medium hover:underline"
            style={{
              color: "var(--indigo)",
            }}
          >
            View all
          </Link>
        </div>

        {products.length === 0 && error !== "not_configured" && !error && (
          <div
            className="rounded-xl border p-10 text-center bg-white"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <p className="font-medium mb-1">No listings yet</p>

            <p className="text-sm text-gray-500 mb-4">
              Be the first seller in your area.
            </p>

            <Link
              href="/signup"
              className="inline-block rounded-full px-5 py-2 text-white text-sm font-medium"
              style={{
                background: "var(--indigo)",
              }}
            >
              Start selling
            </Link>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </main>
    </>
  );
}
