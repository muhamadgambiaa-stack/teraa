import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { SiteHeader } from "@/components/SiteHeader";
import { GAMBIA_CITIES } from "@/types/database";

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

type Category = {
  id: string;
  name: string;
};

async function getCategories(): Promise<Category[]> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("categories")
      .select("id, name")
      .is("parent_category_id", null)
      .order("name", {
        ascending: true,
      });

    if (error) {
      console.error("Could not load categories:", error);
      return [];
    }

    return data ?? [];
  } catch {
    return [];
  }
}

async function searchProducts(params: SearchParams): Promise<{
  products: ProductCardData[];
  error: string | null;
}> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("products")
      .select(
        `
        id,
        title,
        price,
        status,
        condition,
        location_city,
        category_id,

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
      .eq("status", "active");

    if (params.q?.trim()) {
      query = query.ilike("title", `%${params.q.trim()}%`);
    }

    if (params.city) {
      query = query.eq("location_city", params.city);
    }

    if (params.condition) {
      query = query.eq("condition", params.condition);
    }

    if (params.category) {
      query = query.eq("category_id", params.category);
    }

    if (params.min && Number.isFinite(Number(params.min))) {
      query = query.gte("price", Number(params.min));
    }

    if (params.max && Number.isFinite(Number(params.max))) {
      query = query.lte("price", Number(params.max));
    }

    if (params.sort === "price_asc") {
      query = query.order("price", {
        ascending: true,
      });
    } else if (params.sort === "price_desc") {
      query = query.order("price", {
        ascending: false,
      });
    } else {
      query = query.order("created_at", {
        ascending: false,
      });
    }

    const { data, error } = await query.limit(60);

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
        condition: product.condition as ProductCondition,
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

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const [{ products, error }, categories] = await Promise.all([
    searchProducts(params),
    getCategories(),
  ]);

  const selectedCategory =
    categories.find((category) => category.id === params.category) ?? null;

  const hasFilters = Boolean(
    params.q ||
    params.category ||
    params.city ||
    params.condition ||
    params.min ||
    params.max ||
    params.sort,
  );

  return (
    <>
      <SiteHeader />

      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-24 sm:pb-8">
        {/* SEARCH HEADER */}

        <div className="mb-5">
          <h1
            className="font-display text-xl sm:text-2xl"
            style={{
              color: "var(--ink)",
            }}
          >
            Browse Teraa
          </h1>

          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Search products and narrow the results using the filters below.
          </p>
        </div>

        {/* SEARCH + FILTERS */}

        <form
          method="GET"
          action="/search"
          className="rounded-xl border bg-white p-3 sm:p-4 mb-5"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          {/* SEARCH FIELD */}

          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <SearchIcon />
            </div>

            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Search products..."
              className="w-full rounded-lg border pl-10 pr-3 py-3 text-sm outline-none"
              style={{
                borderColor: "var(--sand)",
              }}
            />
          </div>

          {/* FILTER GRID */}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-3">
            {/* CATEGORY */}

            <select
              name="category"
              defaultValue={params.category ?? ""}
              className="rounded-lg border px-3 py-2.5 text-xs sm:text-sm bg-white outline-none min-w-0"
              style={{
                borderColor: "var(--sand)",
              }}
            >
              <option value="">All categories</option>

              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            {/* CITY */}

            <select
              name="city"
              defaultValue={params.city ?? ""}
              className="rounded-lg border px-3 py-2.5 text-xs sm:text-sm bg-white outline-none min-w-0"
              style={{
                borderColor: "var(--sand)",
              }}
            >
              <option value="">All locations</option>

              {GAMBIA_CITIES.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>

            {/* CONDITION */}

            <select
              name="condition"
              defaultValue={params.condition ?? ""}
              className="rounded-lg border px-3 py-2.5 text-xs sm:text-sm bg-white outline-none min-w-0"
              style={{
                borderColor: "var(--sand)",
              }}
            >
              <option value="">Any condition</option>

              <option value="new">Brand new</option>

              <option value="used">Used</option>
            </select>

            {/* SORT */}

            <select
              name="sort"
              defaultValue={params.sort ?? "newest"}
              className="rounded-lg border px-3 py-2.5 text-xs sm:text-sm bg-white outline-none min-w-0"
              style={{
                borderColor: "var(--sand)",
              }}
            >
              <option value="newest">Newest first</option>

              <option value="price_asc">Price: low to high</option>

              <option value="price_desc">Price: high to low</option>
            </select>
          </div>

          {/* PRICE */}

          <div className="grid grid-cols-2 gap-2 mt-2">
            <input
              name="min"
              type="number"
              min="0"
              step="1"
              defaultValue={params.min ?? ""}
              placeholder="Min price (GMD)"
              className="rounded-lg border px-3 py-2.5 text-xs sm:text-sm outline-none min-w-0"
              style={{
                borderColor: "var(--sand)",
              }}
            />

            <input
              name="max"
              type="number"
              min="0"
              step="1"
              defaultValue={params.max ?? ""}
              placeholder="Max price (GMD)"
              className="rounded-lg border px-3 py-2.5 text-xs sm:text-sm outline-none min-w-0"
              style={{
                borderColor: "var(--sand)",
              }}
            />
          </div>

          {/* BUTTONS */}

          <div className="flex items-center gap-2 mt-3">
            <button
              type="submit"
              className="rounded-full px-5 py-2.5 text-white text-sm font-medium"
              style={{
                background: "var(--indigo)",
              }}
            >
              Search
            </button>

            {hasFilters && (
              <Link
                href="/search"
                className="rounded-full border px-4 py-2.5 text-sm"
                style={{
                  borderColor: "var(--sand)",
                }}
              >
                Clear
              </Link>
            )}
          </div>
        </form>

        {/* ACTIVE CATEGORY */}

        {selectedCategory && (
          <div className="mb-4">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
              style={{
                background: "var(--sand)",
                color: "var(--ink)",
              }}
            >
              <TagIcon />

              {selectedCategory.name}
            </span>
          </div>
        )}

        {/* DATABASE ERROR */}

        {error === "not_configured" && (
          <div
            className="rounded-xl border p-5 mb-6 text-sm"
            style={{
              borderColor: "var(--gold)",
              background: "#fbf3df",
            }}
          >
            <p className="font-medium">Supabase isn&apos;t connected.</p>
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
            <p className="font-medium">Couldn&apos;t load listings</p>

            <p className="text-gray-600 mt-1">{error}</p>
          </div>
        )}

        {/* RESULTS HEADER */}

        <div className="flex items-center justify-between gap-4 mb-3">
          <div>
            <h2
              className="font-display text-lg sm:text-xl"
              style={{
                color: "var(--ink)",
              }}
            >
              {params.q
                ? `Results for "${params.q}"`
                : selectedCategory
                  ? selectedCategory.name
                  : "All listings"}
            </h2>

            <p className="text-xs text-gray-500 mt-0.5">
              {products.length} {products.length === 1 ? "listing" : "listings"}
            </p>
          </div>
        </div>

        {/* EMPTY */}

        {products.length === 0 && !error && (
          <div
            className="rounded-xl border p-10 text-center bg-white"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <div
              className="w-11 h-11 rounded-full mx-auto flex items-center justify-center"
              style={{
                background: "#f3f4f6",
                color: "var(--indigo)",
              }}
            >
              <SearchIcon />
            </div>

            <p className="font-medium mt-3">No listings found</p>

            <p className="text-sm text-gray-500 mt-1 mb-4">
              Try another search or remove some filters.
            </p>

            <Link
              href="/search"
              className="text-sm font-medium"
              style={{
                color: "var(--indigo)",
              }}
            >
              View all listings
            </Link>
          </div>
        )}

        {/* RESULTS */}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </main>
    </>
  );
}

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />

      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 13 13 20 4 11V4h7l9 9Z" />

      <circle cx="8.5" cy="8.5" r="1" />
    </svg>
  );
}
