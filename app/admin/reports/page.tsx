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
  account_status: string;
};

export default async function AdminReportsPage() {
  const { supabase } = await requireAdmin();

  /*
   * LOAD REPORTS
   */
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
   * LOAD REPORTERS
   *
   * Load separately instead of relying
   * on an embedded Supabase relationship.
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
   * LOAD REPORTED PRODUCTS
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
      console.error("Reported product lookup failed:", error);
    } else {
      products = (data ?? []) as Product[];
    }
  }

  /*
   * LOAD SELLERS
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
        verification_status,
        account_status
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
   * COMBINE REPORT +
   * REPORTER +
   * PRODUCT +
   * SELLER
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

  const openReports = enrichedReports.filter(
    (report) => report.status === "open",
  );

  const closedReports = enrichedReports.filter(
    (report) => report.status !== "open",
  );

  return (
    <>
      <SiteHeader />

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* PAGE HEADER */}

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
            {openReports.length} open report
            {openReports.length === 1 ? "" : "s"}
          </p>
        </div>

        {/* QUERY ERROR */}

        {reportsError && (
          <div
            className="rounded-xl border p-5 mb-6 text-sm"
            style={{
              borderColor: "#e0a0a0",

              background: "#fdf0f0",
            }}
          >
            Couldn&apos;t load reports.
          </div>
        )}

        {/* NO OPEN REPORTS */}

        {!reportsError && openReports.length === 0 && (
          <div
            className="rounded-xl border p-8 text-center text-sm text-gray-500 mb-8"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            No open reports.
          </div>
        )}

        {/* OPEN REPORTS */}

        <div className="space-y-4 mb-10">
          {openReports.map((report) => {
            const alreadyRemoved = report.product?.status === "admin_hidden";

            return (
              <article
                key={report.id}
                className="rounded-xl border p-5 bg-white"
                style={{
                  borderColor: "var(--clay)",
                }}
              >
                {/* TOP */}

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

                <div className="grid sm:grid-cols-2 gap-6">
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
                          ID: {report.reporter.id}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">
                        Reporter information unavailable.
                      </p>
                    )}
                  </div>

                  {/* PRODUCT */}

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
                              Verification: {report.seller.verification_status}
                            </p>

                            <p className="text-gray-500">
                              Account: {report.seller.account_status}
                            </p>
                          </>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">
                        Listing no longer available.
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

                {/* EXISTING MODERATION */}

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
                  {/* OPEN FULL REPORT */}

                  <Link
                    href={`/admin/reports/${report.id}`}
                    className="rounded-full px-4 py-2 text-xs font-medium border"
                    style={{
                      borderColor: "var(--sand)",
                    }}
                  >
                    Open report
                  </Link>

                  {/* PUBLIC LISTING */}

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

                  {/* SELLER ADMIN */}

                  {report.seller && (
                    <Link
                      href={`/admin/sellers/${report.seller.id}`}
                      className="rounded-full px-4 py-2 text-xs font-medium border"
                      style={{
                        borderColor: "var(--sand)",
                      }}
                    >
                      View seller
                    </Link>
                  )}

                  {/* REMOVE LISTING */}

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
                          Reason shown to seller
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

                  {/* REVIEW */}

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

                  {/* RESOLVE */}

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

        {/* CLOSED REPORTS */}

        {closedReports.length > 0 && (
          <section>
            <div className="flex items-center justify-between gap-4 mb-3">
              <h2 className="font-semibold">Closed reports</h2>

              <span className="text-xs text-gray-500">
                {closedReports.length} report
                {closedReports.length === 1 ? "" : "s"}
              </span>
            </div>

            <div
              className="rounded-xl border bg-white overflow-hidden"
              style={{
                borderColor: "var(--sand)",
              }}
            >
              {closedReports.map((report) => (
                <Link
                  key={report.id}
                  href={`/admin/reports/${report.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 transition"
                  style={{
                    borderColor: "var(--sand)",
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {report.product?.title ?? "Report"}
                    </p>

                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {report.reason}
                    </p>

                    {report.seller && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">
                        Seller: {report.seller.business_name}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className="rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize"
                      style={{
                        background:
                          report.status === "resolved" ? "#e3f0e8" : "#fbf3df",

                        color:
                          report.status === "resolved"
                            ? "var(--leaf)"
                            : "var(--gold)",
                      }}
                    >
                      {report.status}
                    </span>

                    <span className="text-gray-400">→</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
