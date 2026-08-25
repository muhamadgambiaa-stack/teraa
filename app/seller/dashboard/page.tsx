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

  if (userError || !user) {
    redirect("/login");
  }

  const { data: initialSeller, error: sellerLookupError } = await supabase
    .from("sellers")
    .select(
      `
      id,
      business_name,
      verification_status,
      id_document_url,
      rating_avg,
      total_sales,
      account_status,
      admin_note,
      verification_request_reason,
      status_updated_at
      `,
    )
    .eq("id", user.id)
    .maybeSingle();

  if (sellerLookupError) {
    console.error("Seller lookup failed:", sellerLookupError);
  }

  let seller = initialSeller;

  // Repair older seller accounts that are missing a sellers row.
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
        const { data: repairedSeller } = await supabase
          .from("sellers")
          .select(
            `
            id,
            business_name,
            verification_status,
            id_document_url,
            rating_avg,
            total_sales,
            account_status,
            admin_note,
            verification_request_reason,
            status_updated_at
            `,
          )
          .eq("id", user.id)
          .maybeSingle();

        seller = repairedSeller;
      }
    }
  }

  if (!seller) {
    redirect("/account");
  }

  const isSuspended = seller.account_status === "suspended";

  const isBanned = seller.account_status === "banned";

  const requiresVerification =
    seller.verification_status === "pending" &&
    Boolean(seller.verification_request_reason);

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

          {seller.verification_status === "approved" &&
            seller.account_status === "active" && (
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

        {/* BANNED SELLER */}

        {isBanned && (
          <AccountBlockedNotice
            title="Your seller account has been banned"
            reason={seller.admin_note}
            permanent
          />
        )}

        {/* SUSPENDED SELLER */}

        {isSuspended && (
          <AccountBlockedNotice
            title="Your seller account is suspended"
            reason={seller.admin_note}
          />
        )}

        {/* ADDITIONAL VERIFICATION REQUEST */}

        {!isBanned && !isSuspended && requiresVerification && (
          <AdditionalVerificationNotice
            reason={seller.verification_request_reason!}
          />
        )}

        {/* NORMAL FIRST VERIFICATION */}

        {!isBanned &&
          !isSuspended &&
          seller.verification_status === "pending" &&
          !requiresVerification && (
            <VerificationPending
              hasDocument={Boolean(seller.id_document_url)}
            />
          )}

        {/* REJECTED */}

        {!isBanned &&
          !isSuspended &&
          seller.verification_status === "rejected" && (
            <VerificationRejected reason={seller.verification_request_reason} />
          )}

        {/* ACTIVE VERIFIED SELLER */}

        {!isBanned &&
          !isSuspended &&
          seller.verification_status === "approved" && (
            <>
              <SellerNav active="listings" />

              <SellerListings sellerId={seller.id} />
            </>
          )}
      </main>
    </>
  );
}

function AccountBlockedNotice({
  title,
  reason,
  permanent = false,
}: {
  title: string;
  reason: string | null;
  permanent?: boolean;
}) {
  return (
    <div
      className="rounded-xl border p-6"
      style={{
        borderColor: "var(--clay)",
        background: "#fdf0f0",
      }}
    >
      <p
        className="font-semibold text-lg"
        style={{
          color: "var(--clay)",
        }}
      >
        {title}
      </p>

      <p className="text-sm text-gray-700 mt-2">
        {permanent
          ? "You can no longer publish or reactivate listings on Teraa."
          : "You temporarily cannot publish or reactivate listings on Teraa."}
      </p>

      {reason && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase text-gray-500">
            Reason
          </p>

          <p className="text-sm mt-1">{reason}</p>
        </div>
      )}

      <p className="text-xs text-gray-500 mt-4">
        Contact Teraa support if you believe this decision should be reviewed.
      </p>
    </div>
  );
}

function AdditionalVerificationNotice({ reason }: { reason: string }) {
  return (
    <div
      className="rounded-xl border p-6"
      style={{
        borderColor: "var(--gold)",
        background: "#fbf3df",
      }}
    >
      <p className="font-semibold text-lg">Additional verification required</p>

      <p className="text-sm text-gray-700 mt-2">
        Teraa needs additional information before your seller account can
        continue operating normally.
      </p>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase text-gray-500">
          What we need
        </p>

        <p className="text-sm mt-1">{reason}</p>
      </div>

      <Link
        href="/seller/dashboard/verify"
        className="inline-block rounded-full px-5 py-2 text-white text-sm font-medium mt-5"
        style={{
          background: "var(--gold)",
        }}
      >
        Submit verification
      </Link>
    </div>
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

function VerificationRejected({ reason }: { reason: string | null }) {
  return (
    <div
      className="rounded-xl border p-6"
      style={{
        borderColor: "#e0a0a0",
        background: "#fdf0f0",
      }}
    >
      <p className="font-semibold mb-1">Verification wasn&apos;t approved</p>

      {reason ? (
        <>
          <p className="text-xs font-semibold uppercase text-gray-500 mt-3">
            Reason
          </p>

          <p className="text-sm mt-1 mb-4">{reason}</p>
        </>
      ) : (
        <p className="text-sm text-gray-700 my-3">
          Your submitted document couldn&apos;t be verified.
        </p>
      )}

      <Link
        href="/seller/dashboard/verify"
        className="inline-block rounded-full px-5 py-2 text-white text-sm font-medium"
        style={{
          background: "var(--indigo)",
        }}
      >
        Submit new verification
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
      moderation_reason,
      product_photos(
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
    return (
      <div className="rounded-xl border p-8 text-center">
        Couldn&apos;t load your listings.
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
        <p className="font-medium">No listings yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {products.map((product) => {
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
          photos[0]?.photo_url;

        return (
          <Link
            key={product.id}
            href={`/seller/dashboard/products/${product.id}`}
            className="block rounded-lg border p-3 bg-white"
            style={{
              borderColor:
                product.status === "admin_hidden"
                  ? "var(--clay)"
                  : "var(--sand)",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-14 h-14 rounded-md overflow-hidden shrink-0"
                style={{
                  background: "var(--sand)",
                }}
              >
                {cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cover}
                    alt={product.title}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{product.title}</p>

                <p className="text-xs text-gray-500">
                  GMD {Number(product.price).toLocaleString()}
                  {" · "}
                  {CONDITION_LABELS[product.condition as ProductCondition]}
                  {" · Stock: "}
                  {product.stock_quantity}
                </p>
              </div>

              <StatusPill status={product.status} />
            </div>

            {product.status === "admin_hidden" && product.moderation_reason && (
              <div
                className="mt-3 rounded-md px-3 py-2 text-xs"
                style={{
                  background: "#fdf0f0",
                  color: "var(--clay)",
                }}
              >
                Teraa removed this listing: {product.moderation_reason}
              </div>
            )}
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
      bg: "#eee",
      color: "#666",
      label: "Hidden",
    },

    admin_hidden: {
      bg: "#fdf0f0",
      color: "var(--clay)",
      label: "Removed by Teraa",
    },
  };

  const selected = styles[status] ?? styles.hidden;

  return (
    <span
      className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
      style={{
        background: selected.bg,
        color: selected.color,
      }}
    >
      {selected.label}
    </span>
  );
}
