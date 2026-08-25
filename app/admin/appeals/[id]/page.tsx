import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/require-admin";
import { SiteHeader } from "@/components/SiteHeader";

import { approveListingAppeal, rejectListingAppeal } from "../actions";

export default async function AdminAppealDetailPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;

  const { supabase } = await requireAdmin();

  const { data: appeal, error } = await supabase
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
      reviewed_at,
      reviewed_by
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !appeal) {
    notFound();
  }

  const [productResult, sellerResult] = await Promise.all([
    supabase
      .from("products")
      .select(
        `
        id,
        seller_id,
        title,
        description,
        price,
        stock_quantity,
        status,
        condition,
        location_city,
        moderation_reason,
        moderated_at,
        product_photos(
          photo_url,
          is_cover
        )
        `,
      )
      .eq("id", appeal.product_id)
      .maybeSingle(),

    supabase
      .from("sellers")
      .select(
        `
        id,
        business_name,
        verification_status,
        account_status
        `,
      )
      .eq("id", appeal.seller_id)
      .maybeSingle(),
  ]);

  const product = productResult.data;

  const seller = sellerResult.data;

  if (!product) {
    notFound();
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
    photos.find((photo) => photo.is_cover)?.photo_url ?? photos[0]?.photo_url;

  const { data: reports } = await supabase
    .from("reports")
    .select(
      `
      id,
      reason,
      status,
      created_at
      `,
    )
    .eq("target_type", "product")
    .eq("target_id", product.id)
    .order("created_at", {
      ascending: false,
    });

  return (
    <>
      <SiteHeader />

      <main className="max-w-4xl mx-auto px-4 py-6">
        <Link
          href="/admin/appeals"
          className="text-xs text-gray-500 hover:underline"
        >
          ← Listing appeals
        </Link>

        <div className="flex flex-wrap justify-between gap-4 mt-3 mb-7">
          <div>
            <p className="text-xs text-gray-500">Appeal</p>

            <h1
              className="font-display text-2xl"
              style={{
                color: "var(--ink)",
              }}
            >
              {product.title}
            </h1>
          </div>

          <span className="capitalize font-medium text-sm">
            {appeal.status}
          </span>
        </div>

        <div className="grid md:grid-cols-2 gap-5 mb-6">
          <section
            className="rounded-xl border bg-white p-5"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <h2 className="font-semibold mb-4">Listing</h2>

            {cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover}
                alt={product.title}
                className="w-full max-h-60 object-cover rounded-lg mb-4"
              />
            )}

            <p className="font-medium">{product.title}</p>

            <p
              className="font-bold mt-1"
              style={{
                color: "var(--clay)",
              }}
            >
              GMD {Number(product.price).toLocaleString()}
            </p>

            <div className="text-sm text-gray-500 space-y-1 mt-3">
              <p>Status: {product.status}</p>

              <p>Stock: {product.stock_quantity}</p>

              <p>Condition: {product.condition}</p>

              <p>Location: {product.location_city}</p>
            </div>

            {product.moderation_reason && (
              <div
                className="rounded-lg p-3 mt-4 text-sm"
                style={{
                  background: "#fdf0f0",
                }}
              >
                <p className="font-semibold">Original removal reason</p>

                <p className="mt-1">{product.moderation_reason}</p>
              </div>
            )}

            <Link
              href={`/products/${product.id}`}
              className="inline-block text-sm underline mt-4"
            >
              View public listing
            </Link>
          </section>

          <section
            className="rounded-xl border bg-white p-5"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <h2 className="font-semibold mb-4">Seller request</h2>

            {seller && (
              <div className="mb-4">
                <p className="font-medium">{seller.business_name}</p>

                <p className="text-sm text-gray-500">
                  Verification: {seller.verification_status}
                </p>

                <p className="text-sm text-gray-500">
                  Account: {seller.account_status}
                </p>

                <Link
                  href={`/admin/sellers/${seller.id}`}
                  className="inline-block text-sm underline mt-2"
                >
                  Open seller profile
                </Link>
              </div>
            )}

            <div
              className="border-t pt-4"
              style={{
                borderColor: "var(--sand)",
              }}
            >
              <p className="text-xs font-semibold uppercase text-gray-500">
                Seller explanation
              </p>

              <p className="text-sm mt-2">{appeal.message}</p>

              <p className="text-xs text-gray-400 mt-3">
                Submitted {new Date(appeal.created_at).toLocaleString()}
              </p>
            </div>

            {appeal.admin_response && (
              <div
                className="border-t pt-4 mt-4"
                style={{
                  borderColor: "var(--sand)",
                }}
              >
                <p className="text-xs font-semibold uppercase text-gray-500">
                  Admin response
                </p>

                <p className="text-sm mt-2">{appeal.admin_response}</p>
              </div>
            )}
          </section>
        </div>

        {reports && reports.length > 0 && (
          <section
            className="rounded-xl border bg-white p-5 mb-6"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <h2 className="font-semibold mb-3">
              Reports involving this listing
            </h2>

            <div className="space-y-2">
              {reports.map((report) => (
                <Link
                  key={report.id}
                  href={`/admin/reports/${report.id}`}
                  className="block rounded-lg border p-3"
                  style={{
                    borderColor: "var(--sand)",
                  }}
                >
                  <p className="text-sm">{report.reason}</p>

                  <p className="text-xs text-gray-500 mt-1 capitalize">
                    {report.status}
                    {" · "}
                    {new Date(report.created_at).toLocaleDateString()}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {appeal.status === "pending" && (
          <section
            className="rounded-xl border bg-white p-5"
            style={{
              borderColor: "var(--gold)",
            }}
          >
            <h2 className="font-semibold mb-2">Review decision</h2>

            <p className="text-sm text-gray-500 mb-5">
              Inspect the corrected listing before making a decision.
            </p>

            <div className="grid md:grid-cols-2 gap-5">
              <form
                action={approveListingAppeal.bind(null, appeal.id, product.id)}
                className="rounded-lg border p-4 space-y-3"
                style={{
                  borderColor: "var(--leaf)",
                }}
              >
                <p className="font-medium">Restore listing</p>

                <textarea
                  name="admin_response"
                  required
                  rows={3}
                  placeholder="Example: The issue has been corrected. Your listing has been restored."
                  className="w-full rounded-lg border p-3 text-sm"
                  style={{
                    borderColor: "var(--sand)",
                  }}
                />

                <button
                  type="submit"
                  className="w-full rounded-full py-2.5 text-white text-sm font-medium"
                  style={{
                    background: "var(--leaf)",
                  }}
                >
                  Approve and restore
                </button>
              </form>

              <form
                action={rejectListingAppeal.bind(null, appeal.id, product.id)}
                className="rounded-lg border p-4 space-y-3"
                style={{
                  borderColor: "var(--clay)",
                }}
              >
                <p className="font-medium">Keep listing removed</p>

                <textarea
                  name="admin_response"
                  required
                  rows={3}
                  placeholder="Explain what still needs to be corrected."
                  className="w-full rounded-lg border p-3 text-sm"
                  style={{
                    borderColor: "var(--sand)",
                  }}
                />

                <button
                  type="submit"
                  className="w-full rounded-full py-2.5 text-white text-sm font-medium"
                  style={{
                    background: "var(--clay)",
                  }}
                >
                  Reject appeal
                </button>
              </form>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
