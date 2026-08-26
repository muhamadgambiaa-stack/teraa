import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import { ProductCard } from "@/components/ProductCard";

type PublicProfile = {
  id: string;
  full_name: string;
  city: string | null;
  profile_photo_url: string | null;
  public_role: "buyer" | "seller";

  business_name: string | null;
  shop_description: string | null;
  shop_banner_url: string | null;

  verification_status: string | null;
  rating_avg: number | null;
  total_sales: number | null;

  member_since: string | null;
};

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  /*
   * IMPORTANT:
   *
   * We deliberately use get_public_profile()
   * instead of selecting directly from users.
   *
   * That prevents private fields such as
   * phone numbers from becoming part of this page.
   */
  const { data, error } = await supabase.rpc("get_public_profile", {
    p_user_id: id,
  });

  if (error || !data || data.length === 0) {
    notFound();
  }

  const profile = data[0] as PublicProfile;

  const isSeller = profile.public_role === "seller";

  /*
   * Public seller listings.
   *
   * Only active listings are shown.
   * admin_hidden, hidden and out_of_stock
   * products do not belong on the public shop page.
   */
  let products: any[] = [];

  if (isSeller) {
    const { data: listingData } = await supabase
      .from("products")
      .select(
        `
        *,
        product_photos(
          photo_url,
          is_cover
        )
        `,
      )
      .eq("seller_id", profile.id)
      .eq("status", "active")
      .order("created_at", {
        ascending: false,
      });

    products = listingData ?? [];
  }

  /*
   * Public review count.
   */
  let reviewCount = 0;

  if (isSeller) {
    const { count } = await supabase
      .from("reviews")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("seller_id", profile.id);

    reviewCount = count ?? 0;
  }

  const displayName =
    isSeller && profile.business_name
      ? profile.business_name
      : profile.full_name;

  const initial = displayName?.trim().charAt(0).toUpperCase() || "T";

  return (
    <>
      <SiteHeader />

      <main className="max-w-5xl mx-auto pb-8">
        {/* SELLER BANNER */}

        {isSeller && profile.shop_banner_url && (
          <div className="w-full h-40 sm:h-52 overflow-hidden bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={profile.shop_banner_url}
              alt={`${displayName} shop banner`}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="px-4">
          {/* PROFILE HEADER */}

          <section
            className={
              isSeller && profile.shop_banner_url ? "-mt-8 relative" : "pt-6"
            }
          >
            <div className="flex items-start gap-4">
              {profile.profile_photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.profile_photo_url}
                  alt={displayName}
                  className="w-20 h-20 rounded-full object-cover border-4 border-white bg-white shrink-0"
                />
              ) : (
                <div
                  className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center text-2xl text-white font-bold shrink-0"
                  style={{
                    background: "var(--indigo)",
                  }}
                >
                  {initial}
                </div>
              )}

              <div className="min-w-0 pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1
                    className="font-display text-2xl font-bold"
                    style={{
                      color: "var(--ink)",
                    }}
                  >
                    {displayName}
                  </h1>

                  {isSeller && profile.verification_status === "approved" && (
                    <span
                      className="rounded-full px-2 py-1 text-[10px] font-semibold"
                      style={{
                        background: "#e3f0e8",
                        color: "var(--leaf)",
                      }}
                    >
                      ✓ Verified seller
                    </span>
                  )}
                </div>

                {isSeller &&
                  profile.business_name &&
                  profile.full_name !== profile.business_name && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      {profile.full_name}
                    </p>
                  )}

                {profile.city && (
                  <p className="text-sm text-gray-500 mt-1">
                    📍 {profile.city}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* SELLER STATS */}

          {isSeller && (
            <section
              className="grid grid-cols-3 rounded-xl border bg-white mt-6 overflow-hidden"
              style={{
                borderColor: "var(--sand)",
              }}
            >
              <ProfileStat
                value={`${Number(profile.rating_avg ?? 0).toFixed(1)}★`}
                label="Rating"
              />

              <ProfileStat
                value={String(profile.total_sales ?? 0)}
                label="Sales"
              />

              <ProfileStat value={String(reviewCount)} label="Reviews" last />
            </section>
          )}

          {/* ABOUT */}

          <section
            className="rounded-xl border bg-white p-4 mt-5"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <h2 className="font-semibold">About</h2>

            {isSeller && profile.shop_description ? (
              <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">
                {profile.shop_description}
              </p>
            ) : (
              <p className="text-sm text-gray-500 mt-2">
                Teraa marketplace member
                {profile.city ? ` from ${profile.city}` : ""}.
              </p>
            )}

            {profile.member_since && (
              <p className="text-xs text-gray-400 mt-3">
                Member since{" "}
                {new Date(profile.member_since).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
            )}
          </section>

          {/* SELLER PRODUCTS */}

          {isSeller && (
            <section className="mt-8">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="font-display text-xl">Listings</h2>

                  <p className="text-xs text-gray-500 mt-1">
                    {products.length} active{" "}
                    {products.length === 1 ? "listing" : "listings"}
                  </p>
                </div>
              </div>

              {products.length === 0 ? (
                <div
                  className="rounded-xl border p-8 text-center text-sm text-gray-500"
                  style={{
                    borderColor: "var(--sand)",
                  }}
                >
                  No active listings.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* BUYER PROFILE */}

          {!isSeller && (
            <section className="mt-6">
              <div
                className="rounded-xl border p-5 text-sm text-gray-500"
                style={{
                  borderColor: "var(--sand)",
                }}
              >
                This is a Teraa buyer profile. Purchase history, contact
                information and payment information are private.
              </div>
            </section>
          )}

          <div className="mt-8">
            <Link href="/" className="text-sm underline text-gray-500">
              Continue browsing
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

function ProfileStat({
  value,
  label,
  last = false,
}: {
  value: string;
  label: string;
  last?: boolean;
}) {
  return (
    <div
      className={`text-center px-2 py-4 ${last ? "" : "border-r"}`}
      style={{
        borderColor: "var(--sand)",
      }}
    >
      <p className="font-semibold text-sm">{value}</p>

      <p className="text-[10px] text-gray-500 mt-1">{label}</p>
    </div>
  );
}
