import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/require-admin";
import { SiteHeader } from "@/components/SiteHeader";

import {
  markReportReviewed,
  markReportResolved,
  reopenReport,
} from "../actions";

export default async function AdminReportDetailPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;

  const { supabase } = await requireAdmin();

  const { data: report, error } = await supabase
    .from("reports")
    .select(
      `
      id,
      reporter_id,
      target_type,
      target_id,
      reason,
      status,
      created_at
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !report) {
    notFound();
  }

  const { data: reporter } = await supabase
    .from("users")
    .select(
      `
        id,
        full_name,
        phone_number,
        city
        `,
    )
    .eq("id", report.reporter_id)
    .maybeSingle();

  let product: {
    id: string;
    seller_id: string;
    title: string;
    price: number;
    status: string;
    moderation_reason: string | null;
    moderated_at: string | null;
  } | null = null;

  let seller: {
    id: string;
    business_name: string;
    verification_status: string;
    account_status: string;
  } | null = null;

  if (report.target_type === "product") {
    const { data: productData } = await supabase
      .from("products")
      .select(
        `
        id,
        seller_id,
        title,
        price,
        status,
        moderation_reason,
        moderated_at
        `,
      )
      .eq("id", report.target_id)
      .maybeSingle();

    product = productData;

    if (productData) {
      const { data: sellerData } = await supabase
        .from("sellers")
        .select(
          `
          id,
          business_name,
          verification_status,
          account_status
          `,
        )
        .eq("id", productData.seller_id)
        .maybeSingle();

      seller = sellerData;
    }
  }

  return (
    <>
      <SiteHeader />

      <main className="max-w-3xl mx-auto px-4 py-6">
        <Link
          href="/admin/reports"
          className="text-xs text-gray-500 hover:underline"
        >
          ← All reports
        </Link>

        <div className="flex justify-between gap-4 mt-3 mb-7">
          <div>
            <p className="text-xs text-gray-500">Admin report</p>

            <h1
              className="font-display text-2xl"
              style={{
                color: "var(--ink)",
              }}
            >
              Report #{report.id.slice(0, 8)}
            </h1>
          </div>

          <span className="capitalize text-sm font-medium">
            {report.status}
          </span>
        </div>

        <section
          className="rounded-xl border bg-white p-5 mb-4"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          <h2 className="font-semibold mb-3">Report</h2>

          <p className="text-sm">{report.reason}</p>

          <p className="text-xs text-gray-400 mt-3">
            Submitted {new Date(report.created_at).toLocaleString()}
          </p>
        </section>

        <section
          className="rounded-xl border bg-white p-5 mb-4"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          <h2 className="font-semibold mb-3">Reporter</h2>

          {reporter ? (
            <div className="text-sm space-y-1">
              <p>{reporter.full_name ?? "Teraa user"}</p>

              {reporter.phone_number && (
                <p className="text-gray-500">Phone: {reporter.phone_number}</p>
              )}

              {reporter.city && (
                <p className="text-gray-500">Location: {reporter.city}</p>
              )}

              <p className="text-xs text-gray-400 break-all">
                ID: {reporter.id}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Reporter unavailable.</p>
          )}
        </section>

        <section
          className="rounded-xl border bg-white p-5 mb-4"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          <h2 className="font-semibold mb-3">Reported item</h2>

          {product ? (
            <>
              <p className="font-medium">{product.title}</p>

              <p
                className="font-bold mt-1"
                style={{
                  color: "var(--clay)",
                }}
              >
                GMD {Number(product.price).toLocaleString()}
              </p>

              <p className="text-sm text-gray-500 mt-2">
                Current status: {product.status}
              </p>

              {product.moderation_reason && (
                <div
                  className="rounded-lg p-3 mt-4 text-sm"
                  style={{
                    background: "#fdf0f0",
                  }}
                >
                  <p className="font-medium">Moderation reason</p>

                  <p className="mt-1">{product.moderation_reason}</p>
                </div>
              )}

              <Link
                href={`/products/${product.id}`}
                className="inline-block mt-4 underline text-sm"
              >
                View listing
              </Link>
            </>
          ) : (
            <p className="text-sm text-gray-500">
              The reported item is no longer available.
            </p>
          )}
        </section>

        {seller && (
          <section
            className="rounded-xl border bg-white p-5 mb-6"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <h2 className="font-semibold mb-3">Seller</h2>

            <p className="font-medium">{seller.business_name}</p>

            <p className="text-sm text-gray-500 mt-1">
              Verification: {seller.verification_status}
            </p>

            <p className="text-sm text-gray-500">
              Account: {seller.account_status}
            </p>

            <Link
              href={`/admin/sellers/${seller.id}`}
              className="inline-block underline text-sm mt-3"
            >
              Open seller profile
            </Link>
          </section>
        )}

        <div className="flex flex-wrap gap-2">
          {report.status === "open" && (
            <>
              <form action={markReportReviewed.bind(null, report.id)}>
                <button className="rounded-full border px-4 py-2 text-sm">
                  Mark reviewed
                </button>
              </form>

              <form action={markReportResolved.bind(null, report.id)}>
                <button
                  className="rounded-full px-4 py-2 text-sm text-white"
                  style={{
                    background: "var(--leaf)",
                  }}
                >
                  Resolve
                </button>
              </form>
            </>
          )}

          {report.status !== "open" && (
            <form action={reopenReport.bind(null, report.id)}>
              <button
                className="rounded-full px-4 py-2 text-sm text-white"
                style={{
                  background: "var(--indigo)",
                }}
              >
                Reopen report
              </button>
            </form>
          )}
        </div>
      </main>
    </>
  );
}
