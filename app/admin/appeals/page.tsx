import Link from "next/link";

import { requireAdmin } from "@/lib/require-admin";
import { SiteHeader } from "@/components/SiteHeader";

type SearchParams = Promise<{
  status?: string;
}>;

export default async function AdminAppealsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const statusFilter = params.status ?? "pending";

  const { supabase } = await requireAdmin();

  let query = supabase
    .from("listing_appeals")
    .select(
      `
      id,
      product_id,
      seller_id,
      message,
      status,
      admin_response,
      created_at,
      reviewed_at
      `,
    )
    .order("created_at", {
      ascending: false,
    })
    .limit(100);

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data: appeals, error } = await query;

  const productIds = [
    ...new Set((appeals ?? []).map((appeal) => appeal.product_id)),
  ];

  const sellerIds = [
    ...new Set((appeals ?? []).map((appeal) => appeal.seller_id)),
  ];

  let products: {
    id: string;
    title: string;
    price: number;
    status: string;
    moderation_reason: string | null;
  }[] = [];

  let sellers: {
    id: string;
    business_name: string;
    verification_status: string;
    account_status: string;
  }[] = [];

  if (productIds.length > 0) {
    const { data } = await supabase
      .from("products")
      .select(
        `
          id,
          title,
          price,
          status,
          moderation_reason
          `,
      )
      .in("id", productIds);

    products = data ?? [];
  }

  if (sellerIds.length > 0) {
    const { data } = await supabase
      .from("sellers")
      .select(
        `
          id,
          business_name,
          verification_status,
          account_status
          `,
      )
      .in("id", sellerIds);

    sellers = data ?? [];
  }

  return (
    <>
      <SiteHeader />

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-xs text-gray-500">Admin</p>

            <h1
              className="font-display text-2xl"
              style={{
                color: "var(--ink)",
              }}
            >
              Listing appeals
            </h1>

            <p className="text-sm text-gray-500 mt-1">
              Review seller requests to restore moderated listings.
            </p>
          </div>

          <form method="GET">
            <select
              name="status"
              defaultValue={statusFilter}
              className="rounded-full border px-4 py-2 text-sm bg-white"
              style={{
                borderColor: "var(--sand)",
              }}
            >
              <option value="pending">Pending</option>

              <option value="approved">Approved</option>

              <option value="rejected">Rejected</option>

              <option value="all">All appeals</option>
            </select>

            <button
              type="submit"
              className="ml-2 rounded-full px-4 py-2 text-sm text-white"
              style={{
                background: "var(--indigo)",
              }}
            >
              Filter
            </button>
          </form>
        </div>

        {error && (
          <div
            className="rounded-xl border p-5"
            style={{
              borderColor: "#e0a0a0",
            }}
          >
            Couldn&apos;t load appeals.
          </div>
        )}

        {!error && (!appeals || appeals.length === 0) && (
          <div
            className="rounded-xl border p-10 text-center text-sm text-gray-500"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            No appeals found.
          </div>
        )}

        <div className="space-y-3">
          {(appeals ?? []).map((appeal) => {
            const product =
              products.find((item) => item.id === appeal.product_id) ?? null;

            const seller =
              sellers.find((item) => item.id === appeal.seller_id) ?? null;

            return (
              <Link
                key={appeal.id}
                href={`/admin/appeals/${appeal.id}`}
                className="block rounded-xl border p-4 bg-white hover:shadow-sm transition"
                style={{
                  borderColor:
                    appeal.status === "pending" ? "var(--gold)" : "var(--sand)",
                }}
              >
                <div className="flex justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {product?.title ?? "Listing appeal"}
                    </p>

                    {seller && (
                      <p className="text-xs text-gray-500 mt-1">
                        Seller: {seller.business_name}
                      </p>
                    )}

                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                      {appeal.message}
                    </p>

                    {product?.moderation_reason && (
                      <p className="text-xs text-gray-400 mt-2">
                        Original removal: {product.moderation_reason}
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <AppealBadge status={appeal.status} />

                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(appeal.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </>
  );
}

function AppealBadge({ status }: { status: string }) {
  const styles: Record<
    string,
    {
      bg: string;
      color: string;
      label: string;
    }
  > = {
    pending: {
      bg: "#fbf3df",
      color: "var(--gold)",
      label: "Pending",
    },

    approved: {
      bg: "#e3f0e8",
      color: "var(--leaf)",
      label: "Approved",
    },

    rejected: {
      bg: "#fdf0f0",
      color: "var(--clay)",
      label: "Rejected",
    },
  };

  const selected = styles[status] ?? styles.pending;

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
