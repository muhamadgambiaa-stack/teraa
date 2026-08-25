import Link from "next/link";

import { requireAdmin } from "@/lib/require-admin";
import { SiteHeader } from "@/components/SiteHeader";

import { adminHideListing, adminRestoreListing } from "./actions";

type SearchParams = Promise<{
  q?: string;
  status?: string;
}>;

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const search = params.q?.trim() ?? "";
  const statusFilter = params.status?.trim() ?? "all";

  const { supabase } = await requireAdmin();

  let request = supabase
    .from("products")
    .select(
      `
      id,
      title,
      description,
      price,
      stock_quantity,
      status,
      condition,
      location_city,
      seller_id,
      created_at,
      moderation_reason,
      moderated_at,
      product_photos(
        photo_url,
        is_cover
      )
      `,
    )
    .order("created_at", {
      ascending: false,
    })
    .limit(100);

  if (search) {
    request = request.ilike("title", `%${search}%`);
  }

  if (statusFilter !== "all") {
    request = request.eq("status", statusFilter);
  }

  const { data: products, error } = await request;

  const sellerIds = [
    ...new Set((products ?? []).map((product) => product.seller_id)),
  ];

  let sellers: {
    id: string;
    business_name: string;
    verification_status: string;
  }[] = [];

  if (sellerIds.length > 0) {
    const { data } = await supabase
      .from("sellers")
      .select("id, business_name, verification_status")
      .in("id", sellerIds);

    sellers = data ?? [];
  }

  return (
    <>
      <SiteHeader />

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-6">
          <p className="text-xs text-gray-500">Admin</p>

          <h1
            className="font-display text-2xl"
            style={{
              color: "var(--ink)",
            }}
          >
            Listings moderation
          </h1>

          <p className="text-sm text-gray-500 mt-1">
            Search, inspect and moderate listings across Teraa.
          </p>
        </div>

        <form method="GET" className="flex flex-wrap gap-2 mb-6">
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search product title..."
            className="flex-1 min-w-52 rounded-full border px-4 py-2 text-sm outline-none"
            style={{
              borderColor: "var(--sand)",
            }}
          />

          <select
            name="status"
            defaultValue={statusFilter}
            className="rounded-full border px-4 py-2 text-sm bg-white"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <option value="all">All listings</option>

            <option value="active">Active</option>

            <option value="out_of_stock">Out of stock</option>

            <option value="hidden">Hidden by seller</option>

            <option value="admin_hidden">Removed by Teraa</option>
          </select>

          <button
            type="submit"
            className="rounded-full px-5 py-2 text-white text-sm font-medium"
            style={{
              background: "var(--indigo)",
            }}
          >
            Search
          </button>
        </form>

        {error && (
          <div
            className="rounded-xl border p-5"
            style={{
              borderColor: "#e0a0a0",
            }}
          >
            Couldn&apos;t load listings.
          </div>
        )}

        {!error && (!products || products.length === 0) && (
          <div
            className="rounded-xl border p-10 text-center text-sm text-gray-500"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            No listings found.
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {(products ?? []).map((product) => {
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

            const seller =
              sellers.find((entry) => entry.id === product.seller_id) ?? null;

            const adminHidden = product.status === "admin_hidden";

            return (
              <article
                key={product.id}
                className="rounded-xl border bg-white overflow-hidden"
                style={{
                  borderColor: adminHidden ? "var(--clay)" : "var(--sand)",
                }}
              >
                {cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cover}
                    alt={product.title}
                    className="w-full h-48 object-cover"
                  />
                )}

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{product.title}</h2>

                      <p
                        className="font-bold mt-1"
                        style={{
                          color: "var(--clay)",
                        }}
                      >
                        GMD {Number(product.price).toLocaleString()}
                      </p>
                    </div>

                    <StatusBadge status={product.status} />
                  </div>

                  <div className="text-xs text-gray-500 space-y-1 mt-3">
                    {seller && (
                      <>
                        <p>Seller: {seller.business_name}</p>

                        <p>Verification: {seller.verification_status}</p>
                      </>
                    )}

                    <p>Location: {product.location_city}</p>

                    <p>Stock: {product.stock_quantity}</p>
                  </div>

                  {adminHidden && product.moderation_reason && (
                    <div
                      className="rounded-lg p-3 mt-4 text-sm"
                      style={{
                        background: "#fdf0f0",
                        color: "var(--clay)",
                      }}
                    >
                      <p className="font-semibold">Removal reason</p>

                      <p className="mt-1">{product.moderation_reason}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 mt-4">
                    <Link
                      href={`/products/${product.id}`}
                      className="rounded-full border px-4 py-1.5 text-xs font-medium"
                      style={{
                        borderColor: "var(--sand)",
                      }}
                    >
                      View
                    </Link>

                    {!adminHidden ? (
                      <details>
                        <summary
                          className="cursor-pointer list-none rounded-full px-4 py-1.5 text-xs font-medium text-white"
                          style={{
                            background: "var(--clay)",
                          }}
                        >
                          Remove listing
                        </summary>

                        <form
                          action={adminHideListing.bind(null, product.id)}
                          className="mt-3 rounded-xl border p-3 space-y-3"
                          style={{
                            borderColor: "var(--sand)",
                          }}
                        >
                          <label className="block text-xs font-medium">
                            Reason shown to seller
                          </label>

                          <select
                            name="moderation_reason"
                            required
                            defaultValue=""
                            className="w-full rounded-lg border px-3 py-2 text-sm bg-white"
                            style={{
                              borderColor: "var(--sand)",
                            }}
                          >
                            <option value="" disabled>
                              Select a reason
                            </option>

                            <option value="Prohibited item">
                              Prohibited item
                            </option>

                            <option value="Counterfeit or suspected counterfeit product">
                              Counterfeit or suspected counterfeit
                            </option>

                            <option value="Misleading or inaccurate listing information">
                              Misleading information
                            </option>

                            <option value="Suspected scam or fraudulent activity">
                              Suspected scam or fraud
                            </option>

                            <option value="Duplicate or spam listing">
                              Duplicate or spam
                            </option>

                            <option value="Violation of Teraa marketplace policy">
                              Marketplace policy violation
                            </option>
                          </select>

                          <button
                            type="submit"
                            className="w-full rounded-full py-2 text-xs font-medium text-white"
                            style={{
                              background: "var(--clay)",
                            }}
                          >
                            Confirm removal
                          </button>
                        </form>
                      </details>
                    ) : (
                      <form action={adminRestoreListing.bind(null, product.id)}>
                        <button
                          type="submit"
                          className="rounded-full px-4 py-1.5 text-xs font-medium text-white"
                          style={{
                            background: "var(--leaf)",
                          }}
                        >
                          Restore listing
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    active: "Active",
    out_of_stock: "Out of stock",
    hidden: "Hidden by seller",
    admin_hidden: "Removed by Teraa",
  };

  return (
    <span
      className="rounded-full px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap"
      style={{
        background: status === "admin_hidden" ? "#fdf0f0" : "var(--sand)",
        color: status === "admin_hidden" ? "var(--clay)" : "var(--ink)",
      }}
    >
      {labels[status] ?? status}
    </span>
  );
}
