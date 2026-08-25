import Link from "next/link";

import { requireAdmin } from "@/lib/require-admin";
import { SiteHeader } from "@/components/SiteHeader";

import {
  hideReportedListing,
  markReportReviewed,
  markReportResolved,
} from "./actions";

type Reporter = {
  id: string;
  full_name: string | null;
  phone_number: string | null;
  city: string | null;
};

type Product = {
  id: string;
  title: string;
  price: number;
  status: string;
  seller_id: string;
  moderation_reason: string | null;
};

type Seller = {
  id: string;
  business_name: string;
  verification_status: string;
};

export default async function AdminReportsPage() {
  const { supabase } = await requireAdmin();

  const { data: reports, error: reportsError } = await supabase
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
    .order("created_at", {
      ascending: false,
    })
    .limit(100);

  if (reportsError) {
    console.error("Reports query failed:", reportsError);
  }

  const rows = reports ?? [];

  /*
   * REPORTERS
   */
  const reporterIds = [
    ...new Set(rows.map((report) => report.reporter_id).filter(Boolean)),
  ];

  let reporters: Reporter[] = [];

  if (reporterIds.length > 0) {
    const { data, error } = await supabase
      .from("users")
      .select(
        `
        id,
        full_name,
        phone_number,
        city
        `,
      )
      .in("id", reporterIds);

    if (error) {
      console.error("Reporter lookup failed:", error);
    } else {
      reporters = (data ?? []) as Reporter[];
    }
  }

  /*
   * REPORTED PRODUCTS
   */
  const productIds = [
    ...new Set(
      rows
        .filter((report) => report.target_type === "product")
        .map((report) => report.target_id),
    ),
  ];

  let products: Product[] = [];

  if (productIds.length > 0) {
    const { data, error } = await supabase
      .from("products")
      .select(
        `
        id,
        title,
        price,
        status,
        seller_id,
        moderation_reason
        `,
      )
      .in("id", productIds);

    if (error) {
      console.error("Reported products lookup failed:", error);
    } else {
      products = (data ?? []) as Product[];
    }
  }

  /*
   * SELLERS
   */
  const sellerIds = [...new Set(products.map((product) => product.seller_id))];

  let sellers: Seller[] = [];

  if (sellerIds.length > 0) {
    const { data, error } = await supabase
      .from("sellers")
      .select(
        `
        id,
        business_name,
        verification_status
        `,
      )
      .in("id", sellerIds);

    if (error) {
      console.error("Seller lookup failed:", error);
    } else {
      sellers = (data ?? []) as Seller[];
    }
  }

  /*
   * COMBINE EVERYTHING
   */
  const enrichedReports = rows.map((report) => {
    const reporter =
      reporters.find((user) => user.id === report.reporter_id) ?? null;

    const product =
      report.target_type === "product"
        ? (products.find((item) => item.id === report.target_id) ?? null)
        : null;

    const seller = product
      ? (sellers.find((item) => item.id === product.seller_id) ?? null)
      : null;

    return {
      ...report,
      reporter,
      product,
      seller,
    };
  });

  const open = enrichedReports.filter((report) => report.status === "open");

  const other = enrichedReports.filter((report) => report.status !== "open");

  return (
    <>
      <SiteHeader />

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <p className="text-xs text-gray-500 mb-1">Admin</p>

          <h1
            className="font-display text-2xl"
            style={{
              color: "var(--ink)",
            }}
          >
            Reports
          </h1>

          <p className="text-sm text-gray-500 mt-1">
            {open.length} open report
            {open.length === 1 ? "" : "s"}
          </p>
        </div>

        {reportsError && (
          <div
            className="rounded-xl border p-4 mb-6 text-sm"
            style={{
              borderColor: "#e0a0a0",
              background: "#fdf0f0",
            }}
          >
            Couldn&apos;t load reports.
          </div>
        )}

        {!reportsError && open.length === 0 && (
          <div
            className="rounded-xl border p-8 text-center text-sm text-gray-500 mb-8"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            No open reports.
          </div>
        )}

        <div className="space-y-4 mb-10">
          {open.map((report) => {
            const alreadyRemoved = report.product?.status === "admin_hidden";

            return (
              <article
                key={report.id}
                className="rounded-xl border p-5 bg-white"
                style={{
                  borderColor: "var(--clay)",
                }}
              >
                <div className="flex items-center justify-between gap-4 mb-5">
                  <span
                    className="text-[10px] font-semibold uppercase rounded-full px-2 py-1"
                    style={{
                      background: "var(--sand)",
                      color: "var(--ink)",
                    }}
                  >
                    {report.target_type}
                  </span>

                  <span className="text-xs text-gray-400">
                    {new Date(report.created_at).toLocaleString()}
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  {/* REPORTER */}

                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                      Reported by
                    </p>

                    {report.reporter ? (
                      <div className="text-sm space-y-1">
                        <p className="font-medium">
                          {report.reporter.full_name ?? "Teraa user"}
                        </p>

                        {report.reporter.phone_number && (
                          <p className="text-gray-500">
                            Phone: {report.reporter.phone_number}
                          </p>
                        )}

                        {report.reporter.city && (
                          <p className="text-gray-500">
                            Location: {report.reporter.city}
                          </p>
                        )}

                        <p className="text-xs text-gray-400 break-all">
                          User ID: {report.reporter.id}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">
                        Reporter information unavailable.
                      </p>
                    )}
                  </div>

                  {/* LISTING / SELLER */}

                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                      Reported listing
                    </p>

                    {report.product ? (
                      <div className="text-sm space-y-1">
                        <p className="font-medium">{report.product.title}</p>

                        <p
                          className="font-semibold"
                          style={{
                            color: "var(--clay)",
                          }}
                        >
                          GMD {Number(report.product.price).toLocaleString()}
                        </p>

                        <p className="text-gray-500">
                          Status: {report.product.status}
                        </p>

                        {report.seller && (
                          <>
                            <p className="text-gray-500">
                              Seller: {report.seller.business_name}
                            </p>

                            <p className="text-gray-500">
                              Seller verification:{" "}
                              {report.seller.verification_status}
                            </p>
                          </>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">
                        Listing is no longer available.
                      </p>
                    )}
                  </div>
                </div>

                {/* REPORT REASON */}

                <div
                  className="border-t mt-5 pt-4"
                  style={{
                    borderColor: "var(--sand)",
                  }}
                >
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                    Report reason
                  </p>

                  <p className="text-sm">{report.reason}</p>
                </div>

                {alreadyRemoved && report.product?.moderation_reason && (
                  <div
                    className="rounded-lg p-3 mt-4 text-sm"
                    style={{
                      background: "#fdf0f0",
                      color: "var(--clay)",
                    }}
                  >
                    <p className="font-semibold">
                      Listing already removed by Teraa
                    </p>

                    <p className="mt-1">{report.product.moderation_reason}</p>
                  </div>
                )}

                {/* ACTIONS */}

                <div className="flex flex-wrap gap-2 mt-5">
                  {report.product && (
                    <Link
                      href={`/products/${report.product.id}`}
                      className="rounded-full px-4 py-2 text-xs font-medium border"
                      style={{
                        borderColor: "var(--sand)",
                      }}
                    >
                      View listing
                    </Link>
                  )}

                  {report.product && !alreadyRemoved && (
                    <details className="w-full sm:w-auto">
                      <summary
                        className="cursor-pointer list-none rounded-full px-4 py-2 text-xs font-medium text-white w-fit"
                        style={{
                          background: "var(--clay)",
                        }}
                      >
                        Remove listing
                      </summary>

                      <form
                        action={hideReportedListing.bind(
                          null,
                          report.id,
                          report.product.id,
                        )}
                        className="mt-3 rounded-xl border p-4 space-y-3 max-w-sm"
                        style={{
                          borderColor: "var(--sand)",
                        }}
                      >
                        <p className="text-xs font-medium">
                          Why is Teraa removing this listing?
                        </p>

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
                            Select reason
                          </option>

                          <option value="Prohibited item">
                            Prohibited item
                          </option>

                          <option value="Counterfeit or suspected counterfeit product">
                            Counterfeit or suspected counterfeit
                          </option>

                          <option value="Misleading or inaccurate listing information">
                            Misleading or inaccurate information
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
                          className="w-full rounded-full py-2 text-white text-xs font-medium"
                          style={{
                            background: "var(--clay)",
                          }}
                        >
                          Remove listing and resolve report
                        </button>
                      </form>
                    </details>
                  )}

                  <form action={markReportReviewed.bind(null, report.id)}>
                    <button
                      type="submit"
                      className="rounded-full px-4 py-2 text-xs font-medium border"
                      style={{
                        borderColor: "var(--sand)",
                      }}
                    >
                      Mark reviewed
                    </button>
                  </form>

                  <form action={markReportResolved.bind(null, report.id)}>
                    <button
                      type="submit"
                      className="rounded-full px-4 py-2 text-xs font-medium text-white"
                      style={{
                        background: "var(--leaf)",
                      }}
                    >
                      Resolve
                    </button>
                  </form>
                </div>
              </article>
            );
          })}
        </div>

        {other.length > 0 && (
          <>
            <h2 className="font-semibold mb-3">Closed reports</h2>

            <div
              className="rounded-xl border bg-white overflow-hidden"
              style={{
                borderColor: "var(--sand)",
              }}
            >
              {other.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between gap-4 px-4 py-3 border-b last:border-b-0"
                  style={{
                    borderColor: "var(--sand)",
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-sm truncate">
                      {report.product?.title ?? report.reason}
                    </p>

                    <p className="text-xs text-gray-400 truncate">
                      {report.reason}
                    </p>
                  </div>

                  <span className="text-xs text-gray-500 capitalize">
                    {report.status}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
