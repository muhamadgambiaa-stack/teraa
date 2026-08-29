import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import {
  ProductCard,
  type ProductCardData,
} from "@/components/ProductCard";

import type { ProductCondition } from "@/types/database";

export default async function FavoritesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/favorites");
  }

  const { data, error } = await supabase
    .from("favorites")
    .select(
      `
      id,
      product_id,

      products(
        id,
        title,
        price,
        condition,
        location_city,
        status,

        product_photos(
          photo_url,
          is_cover
        ),

        sellers(
          business_name,
          verification_status
        )
      )
      `,
    )
    .eq("buyer_id", user.id)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error("Could not load favorites:", error);
  }

  const products: ProductCardData[] = [];

  for (const favorite of data ?? []) {
    const rawProduct = favorite.products;

    const product = Array.isArray(rawProduct)
      ? rawProduct[0]
      : rawProduct;

    if (!product || product.status !== "active") {
      continue;
    }

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
      photos.find(
        (photo) => photo.is_cover,
      )?.photo_url ??
      photos[0]?.photo_url ??
      null;

    const rawSeller = (
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

    const seller = Array.isArray(rawSeller)
      ? rawSeller[0]
      : rawSeller;

    products.push({
      id: product.id,
      title: product.title,
      price: Number(product.price),
      condition:
        product.condition as ProductCondition,
      location_city: product.location_city,
      coverPhoto: cover,
      sellerName:
        seller?.business_name ?? null,
      sellerVerified:
        seller?.verification_status ===
        "approved",
    });
  }

  return (
    <>
      <SiteHeader />

      <main className="max-w-6xl mx-auto px-4 py-6 sm:pb-8">
        <div className="mb-5">
          <h1
            className="font-display text-2xl"
            style={{
              color: "var(--ink)",
            }}
          >
            Favorites
          </h1>

          <p className="text-sm text-gray-500 mt-1">
            Products you&apos;ve saved.
          </p>
        </div>

        {products.length === 0 ? (
          <div
            className="rounded-xl border bg-white p-10 text-center"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <HeartIcon />

            <p className="font-medium mt-3">
              No favorites yet
            </p>

            <p className="text-sm text-gray-500 mt-1">
              Save products you like and they
              will appear here.
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-3">
              {products.length} saved{" "}
              {products.length === 1
                ? "product"
                : "products"}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}

function HeartIcon() {
  return (
    <div
      className="w-11 h-11 rounded-full mx-auto flex items-center justify-center"
      style={{
        background: "#f3f4f6",
        color: "var(--indigo)",
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
      </svg>
    </div>
  );
}