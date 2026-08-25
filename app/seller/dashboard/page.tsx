import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import { SellerNav } from "@/components/SellerNav";
import { CONDITION_LABELS, type ProductCondition } from "@/types/database";

export default async function SellerDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  // User is not authenticated.
  if (userError || !user) {
    redirect("/login");
  }

  /*
   * Try to load the seller profile.
   *
   * We use maybeSingle() instead of single() because older accounts
   * may not have a sellers row yet due to the previous signup bug.
   */
  const { data: initialSeller, error: sellerLookupError } = await supabase
    .from("sellers")
    .select(
      "id, business_name, verification_status, id_document_url, rating_avg, total_sales",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (sellerLookupError) {
    console.error("Seller lookup failed:", sellerLookupError);
  }

  let seller = initialSeller;

  /*
   * RECOVERY FOR OLD ACCOUNTS
   *
   * Previous versions of signup could successfully create:
   *
   * auth.users
   * public.users
   *
   * but fail to create:
   *
   * public.sellers
   *
   * This caused:
   *
   * Seller dashboard
   *      ↓
   * No sellers record
   *      ↓
   * /signup
   *      ↓
   * User already has an account
   *      ↓
   * endless loop
   *
   * If the user's profile says they are a seller, automatically
   * recreate the missing sellers row.
   */
  if (!seller) {
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("full_name, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("User profile lookup failed:", profileError);
    }

    if (profile?.role === "seller") {
      const { error: repairError } = await supabase.from("sellers").insert({
        id: user.id,
        business_name: profile.full_name?.trim() || "Teraa Seller",
      });

      if (repairError) {
        console.error("Could not create missing seller profile:", repairError);
      } else {
        /*
         * Load the newly created seller row so the dashboard
         * can continue normally without requiring another request.
         */
        const { data: repairedSeller, error: repairedSellerError } =
          await supabase
            .from("sellers")
            .select(
              "id, business_name, verification_status, id_document_url, rating_avg, total_sales",
            )
            .eq("id", user.id)
            .maybeSingle();

        if (repairedSellerError) {
          console.error(
            "Could not reload repaired seller profile:",
            repairedSellerError,
          );
        }

        seller = repairedSeller;
      }
    }
  }

  /*
   * User is logged in but is not registered as a seller.
   *
   * Do NOT redirect them to signup because they already have
   * an account. Send them to their account page instead.
   */
  if (!seller) {
    redirect("/account");
  }

  return (
    <>
      <SiteHeader />

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">Seller dashboard</p>

            <h1
              className="font-display text-2xl"
              style={{
                color: "var(--ink)",
              }}
            >
              {seller.business_name}
            </h1>
          </div>

          {seller.verification_status === "approved" && (
            <Link
              href="/seller/dashboard/new"
              className="rounded-full px-4 py-2 text-white text-sm font-medium"
              style={{
                background: "var(--indigo)",
              }}
            >
              + New listing
            </Link>
          )}
        </div>

        {seller.verification_status === "pending" && (
          <VerificationPending hasDocument={Boolean(seller.id_document_url)} />
        )}

        {seller.verification_status === "rejected" && <VerificationRejected />}

        {seller.verification_status === "approved" && (
          <>
            <SellerNav active="listings" />

            <SellerListings sellerId={seller.id} />
          </>
        )}
      </main>
    </>
  );
}

function VerificationPending({ hasDocument }: { hasDocument: boolean }) {
  return (
    <div
      className="rounded-xl border p-6"
      style={{
        borderColor: "var(--gold)",
        background: "#fbf3df",
      }}
    >
      <p className="font-semibold mb-1">
        {hasDocument
          ? "Your ID is under review"
          : "Verify your identity to start selling"}
      </p>

      <p className="text-sm text-gray-700 mb-4 max-w-md">
        {hasDocument
          ? "Your verification document has been submitted. You'll be able to create listings once your seller account is approved."
          : "Upload a Gambian ID or business registration document. Once approved, you'll be able to publish products on Teraa."}
      </p>

      {!hasDocument && (
        <Link
          href="/seller/dashboard/verify"
          className="inline-block rounded-full px-5 py-2 text-white text-sm font-medium"
          style={{
            background: "var(--indigo)",
          }}
        >
          Upload ID document
        </Link>
      )}
    </div>
  );
}

function VerificationRejected() {
  return (
    <div
      className="rounded-xl border p-6"
      style={{
        borderColor: "#e0a0a0",
        background: "#fdf0f0",
      }}
    >
      <p className="font-semibold mb-1">Verification wasn&apos;t approved</p>

      <p className="text-sm text-gray-700 mb-4 max-w-md">
        Your submitted document couldn&apos;t be verified. Make sure the photo
        is clear and the details are readable, then submit it again.
      </p>

      <Link
        href="/seller/dashboard/verify"
        className="inline-block rounded-full px-5 py-2 text-white text-sm font-medium"
        style={{
          background: "var(--indigo)",
        }}
      >
        Resubmit document
      </Link>
    </div>
  );
}

async function SellerListings({ sellerId }: { sellerId: string }) {
  const supabase = await createClient();

  const { data: products, error } = await supabase
    .from("products")
    .select(
      `
        id,
        title,
        price,
        status,
        condition,
        stock_quantity,
        product_photos (
          photo_url,
          is_cover
        )
      `,
    )
    .eq("seller_id", sellerId)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error("Could not load seller listings:", error);

    return (
      <div
        className="rounded-xl border p-8 text-center"
        style={{
          borderColor: "var(--sand)",
        }}
      >
        <p className="font-medium mb-1">Couldn&apos;t load your listings</p>

        <p className="text-sm text-gray-500">
          Please refresh the page and try again.
        </p>
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div
        className="rounded-xl border p-10 text-center"
        style={{
          borderColor: "var(--sand)",
        }}
      >
        <p className="font-medium mb-1">No listings yet</p>

        <p className="text-sm text-gray-500 mb-4">
          Create your first listing to start selling on Teraa.
        </p>

        <Link
          href="/seller/dashboard/new"
          className="inline-block rounded-full px-5 py-2 text-white text-sm font-medium"
          style={{
            background: "var(--indigo)",
          }}
        >
          + New listing
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {products.map((product) => {
        const photos = (
          product as {
            product_photos?: {
              photo_url: string;
              is_cover: boolean;
            }[];
          }
        ).product_photos;

        const cover =
          photos?.find((photo) => photo.is_cover)?.photo_url ??
          photos?.[0]?.photo_url;

        return (
          <Link
            key={product.id}
            href={`/seller/dashboard/products/${product.id}`}
            className="flex items-center gap-3 rounded-lg border p-3 bg-white transition hover:shadow-sm"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <div
              className="w-14 h-14 rounded-md shrink-0 overflow-hidden"
              style={{
                background: "var(--sand)",
              }}
            >
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cover}
                  alt={product.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                  No image
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{product.title}</p>

              <p className="text-xs text-gray-500 truncate">
                GMD {Number(product.price).toLocaleString()}
                {" · "}
                {CONDITION_LABELS[product.condition as ProductCondition]}
                {" · "}
                Stock: {product.stock_quantity}
              </p>
            </div>

            <StatusPill status={product.status} />
          </Link>
        );
      })}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<
    string,
    {
      bg: string;
      color: string;
      label: string;
    }
  > = {
    active: {
      bg: "#e3f0e8",
      color: "var(--leaf)",
      label: "Active",
    },

    out_of_stock: {
      bg: "#fbf3df",
      color: "var(--gold)",
      label: "Out of stock",
    },

    hidden: {
      bg: "#eeeeee",
      color: "#666666",
      label: "Hidden",
    },
  };

  const selected = styles[status] ?? styles.hidden;

  return (
    <span
      className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold"
      style={{
        background: selected.bg,
        color: selected.color,
      }}
    >
      {selected.label}
    </span>
  );
}
