import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { SiteHeader } from "@/components/SiteHeader";

type PublicSellerProfile = {
  id: string;
  public_role: "buyer" | "seller";
  business_name: string | null;
  verification_status: string | null;
};

async function getProducts(): Promise<{
  products: ProductCardData[];
  error: string | null;
}> {
  try {
    const supabase = await createClient();

    /*
     * --------------------------------------------------------
     * PRODUCTS
     * --------------------------------------------------------
     *
     * Do not join directly to public.sellers here.
     *
     * The sellers table contains private seller information
     * and its RLS intentionally prevents normal users from
     * reading another seller's row.
     *
     * Public seller information is loaded separately through
     * get_public_profile().
     * --------------------------------------------------------
     */

    const { data, error } = await supabase
      .from("products")
      .select(
        `
        id,
        seller_id,
        title,
        price,
        status,
        condition,
        location_city,

        product_photos(
          photo_url,
          is_cover
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

    const rawProducts = data ?? [];

    /*
     * --------------------------------------------------------
     * UNIQUE SELLERS
     * --------------------------------------------------------
     *
     * If one seller has several listings we only need to load
     * their public profile once.
     * --------------------------------------------------------
     */

    const sellerIds = [
      ...new Set(
        rawProducts.map((product) => product.seller_id).filter(Boolean),
      ),
    ];

    /*
     * --------------------------------------------------------
     * PUBLIC SELLER PROFILES
     * --------------------------------------------------------
     *
     * get_public_profile() is SECURITY DEFINER and exposes only
     * the public seller information that Teraa intentionally
     * allows marketplace users to see.
     * --------------------------------------------------------
     */

    const sellerEntries = await Promise.all(
      sellerIds.map(async (sellerId) => {
        const { data: profileData, error: profileError } = await supabase.rpc(
          "get_public_profile",
          {
            p_user_id: sellerId,
          },
        );

        if (profileError) {
          console.error(
            `Could not load public seller profile ${sellerId}:`,
            profileError,
          );

          return [sellerId, null] as const;
        }

        const rawProfile = Array.isArray(profileData)
          ? profileData[0]
          : profileData;

        const profile = rawProfile as PublicSellerProfile | null;

        /*
         * Only approved/active sellers come back from the RPC
         * with public_role = seller.
         */
        if (!profile || profile.public_role !== "seller") {
          return [sellerId, null] as const;
        }

        return [sellerId, profile] as const;
      }),
    );

    const sellerMap = new Map<string, PublicSellerProfile | null>(
      sellerEntries,
    );

    /*
     * --------------------------------------------------------
     * PRODUCT CARDS
     * --------------------------------------------------------
     */

    const products: ProductCardData[] = rawProducts.map((product) => {
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

      const seller = sellerMap.get(product.seller_id) ?? null;

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
  } catch (error) {
    console.error("Could not load homepage listings:", error);

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

      <main className="flex-1 max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 w-full sm:pb-6">
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
