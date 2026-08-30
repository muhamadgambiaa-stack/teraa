import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/require-admin";
import { SiteHeader } from "@/components/SiteHeader";

import {
  approveSeller,
  banSeller,
  reinstateSeller,
  rejectSeller,
  requestAdditionalVerification,
  saveAdminSellerNote,
  suspendSeller,
} from "../actions";

export default async function AdminSellerDetailPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;

  const { supabase } = await requireAdmin();

  const { data: seller, error } = await supabase
    .from("sellers")
    .select(
      `
      id,
      business_name,
      legal_name,
      document_sha256,
      id_document_url,
      verification_status,
      account_status,
      rating_avg,
      total_sales,
      created_at,
      verification_request_reason,
      admin_note,
      status_updated_at
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !seller) {
    notFound();
  }

  const { data: profile } = await supabase
    .from("users")
    .select(
      `
      id,
      full_name,
      phone_number,
      city,
      role
      `,
    )
    .eq("id", seller.id)
    .maybeSingle();

  const { data: matchingDocuments } = seller.document_sha256
    ? await supabase
        .from("sellers")
        .select(`
          id,
          business_name,
          legal_name,
          verification_status,
          account_status,
          created_at
        `)
        .eq("document_sha256", seller.document_sha256)
        .neq("id", seller.id)
        .limit(10)
    : { data: [] };
  const [productResult, orderResult, reportResult] = await Promise.all([
    supabase
      .from("products")
      .select("id, title, price, status, stock_quantity")
      .eq("seller_id", seller.id)
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("orders")
      .select("id, status, payment_status, created_at")
      .eq("seller_id", seller.id)
      .order("created_at", {
        ascending: false,
      })
      .limit(20),

    supabase
      .from("reports")
      .select("id, target_id, reason, status, created_at")
      .order("created_at", {
        ascending: false,
      })
      .limit(100),
  ]);

  const products = productResult.data ?? [];

  const productIds = products.map((product) => product.id);

  const sellerReports = (reportResult.data ?? []).filter((report) =>
    productIds.includes(report.target_id),
  );

  let signedDocumentUrl: string | null = null;

  if (seller.id_document_url) {
    const { data } = await supabase.storage
      .from("seller-documents")
      .createSignedUrl(seller.id_document_url, 300);

    signedDocumentUrl = data?.signedUrl ?? null;
  }

  return (
    <>
      <SiteHeader />

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Link
          href="/admin/sellers"
          className="text-xs text-gray-500 hover:underline"
        >
          ← All sellers
        </Link>

        <div className="flex items-start justify-between flex-wrap gap-4 mt-3 mb-6">
          <div>
            <p className="text-xs text-gray-500">Seller</p>

            <h1
              className="font-display text-3xl"
              style={{
                color: "var(--ink)",
              }}
            >
              {seller.business_name}
            </h1>

            {profile && (
              <p className="text-sm text-gray-500 mt-1">
                {profile.full_name}

                {profile.city ? ` · ${profile.city}` : ""}

                {profile.phone_number ? ` · ${profile.phone_number}` : ""}
              </p>
            )}
          </div>

          <div className="text-right">
            <p className="text-sm font-medium capitalize">
              Verification: {seller.verification_status}
            </p>

            <p className="text-sm font-medium capitalize">
              Account: {seller.account_status}
            </p>
          </div>
        </div>

        {(matchingDocuments ?? []).length > 0 && (
          <section
            className="mb-6 rounded-xl border p-5"
            style={{
              borderColor: "var(--clay)",
              background: "#fff5f5",
            }}
          >
            <p className="text-sm font-bold text-red-700">
              Exact identity document reuse detected
            </p>

            <p className="mt-1 text-xs leading-5 text-red-600">
              The exact same uploaded file was submitted by another seller
              account. Review both accounts manually before approving,
              suspending, or banning anyone.
            </p>

            <div className="mt-4 space-y-2">
              {(matchingDocuments ?? []).map((match) => (
                <Link
                  key={match.id}
                  href={`/admin/sellers/${match.id}`}
                  className="block rounded-lg border bg-white p-3"
                  style={{ borderColor: "#efb4b4" }}
                >
                  <p className="text-sm font-semibold">
                    {match.business_name}
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    {match.legal_name || "Legal name unavailable"}
                    {" · "}
                    Verification: {match.verification_status}
                    {" · "}
                    Account: {match.account_status}
                  </p>

                  <p
                    className="mt-2 text-xs font-medium"
                    style={{ color: "var(--indigo)" }}
                  >
                    Review matching seller →
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
        <div className="grid sm:grid-cols-3 gap-3 mb-8">
          <Stat label="Listings" value={products.length} />

          <Stat label="Orders" value={orderResult.data?.length ?? 0} />

          <Stat label="Reports" value={sellerReports.length} />
        </div>

        <section className="grid md:grid-cols-2 gap-5 mb-8">
          <div
            className="rounded-xl border p-5 bg-white"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <h2 className="font-semibold mb-4">Verification</h2>

            {signedDocumentUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={signedDocumentUrl}
                alt="Seller verification document"
                className="w-full max-h-72 object-contain rounded-lg border mb-4"
              />
            ) : (
              <div
                className="rounded-lg border p-8 text-center text-sm text-gray-500 mb-4"
                style={{
                  borderColor: "var(--sand)",
                }}
              >
                No verification document available.
              </div>
            )}

            {seller.verification_request_reason && (
              <div
                className="rounded-lg p-3 mb-4 text-sm"
                style={{
                  background: "#fbf3df",
                }}
              >
                <p className="font-medium">Verification note</p>

                <p className="mt-1">{seller.verification_request_reason}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {seller.verification_status !== "approved" && (
                <form action={approveSeller.bind(null, seller.id)}>
                  <button
                    type="submit"
                    className="rounded-full px-4 py-2 text-xs text-white font-medium"
                    style={{
                      background: "var(--leaf)",
                    }}
                  >
                    Approve
                  </button>
                </form>
              )}

              <details>
                <summary
                  className="list-none cursor-pointer rounded-full border px-4 py-2 text-xs font-medium"
                  style={{
                    borderColor: "var(--gold)",
                  }}
                >
                  Request verification
                </summary>

                <form
                  action={requestAdditionalVerification.bind(null, seller.id)}
                  className="mt-3 space-y-2"
                >
                  <textarea
                    name="reason"
                    required
                    rows={3}
                    placeholder="Example: Please submit a clearer photo of your Gambian ID."
                    className="w-full rounded-lg border p-3 text-sm"
                  />

                  <button
                    type="submit"
                    className="rounded-full px-4 py-2 text-xs text-white"
                    style={{
                      background: "var(--gold)",
                    }}
                  >
                    Send request
                  </button>
                </form>
              </details>

              <details>
                <summary
                  className="list-none cursor-pointer rounded-full border px-4 py-2 text-xs font-medium"
                  style={{
                    borderColor: "var(--clay)",
                    color: "var(--clay)",
                  }}
                >
                  Reject verification
                </summary>

                <form
                  action={rejectSeller.bind(null, seller.id)}
                  className="mt-3 space-y-2"
                >
                  <textarea
                    name="reason"
                    required
                    rows={3}
                    placeholder="Why was verification rejected?"
                    className="w-full rounded-lg border p-3 text-sm"
                  />

                  <button
                    type="submit"
                    className="rounded-full px-4 py-2 text-xs text-white"
                    style={{
                      background: "var(--clay)",
                    }}
                  >
                    Reject
                  </button>
                </form>
              </details>
            </div>
          </div>

          <div
            className="rounded-xl border p-5 bg-white"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <h2 className="font-semibold mb-4">Account moderation</h2>

            {seller.account_status === "active" ? (
              <div className="space-y-3">
                <details>
                  <summary
                    className="list-none cursor-pointer rounded-full border px-4 py-2 text-xs font-medium w-fit"
                    style={{
                      borderColor: "var(--gold)",
                    }}
                  >
                    Suspend seller
                  </summary>

                  <form
                    action={suspendSeller.bind(null, seller.id)}
                    className="mt-3 space-y-2"
                  >
                    <textarea
                      name="reason"
                      required
                      rows={3}
                      placeholder="Reason for suspension..."
                      className="w-full rounded-lg border p-3 text-sm"
                    />

                    <button
                      className="rounded-full px-4 py-2 text-xs text-white"
                      style={{
                        background: "var(--gold)",
                      }}
                    >
                      Confirm suspension
                    </button>
                  </form>
                </details>

                <details>
                  <summary
                    className="list-none cursor-pointer rounded-full border px-4 py-2 text-xs font-medium w-fit"
                    style={{
                      borderColor: "var(--clay)",
                      color: "var(--clay)",
                    }}
                  >
                    Ban seller
                  </summary>

                  <form
                    action={banSeller.bind(null, seller.id)}
                    className="mt-3 space-y-2"
                  >
                    <textarea
                      name="reason"
                      required
                      rows={3}
                      placeholder="Reason for permanent ban..."
                      className="w-full rounded-lg border p-3 text-sm"
                    />

                    <button
                      className="rounded-full px-4 py-2 text-xs text-white"
                      style={{
                        background: "var(--clay)",
                      }}
                    >
                      Confirm ban
                    </button>
                  </form>
                </details>
              </div>
            ) : (
              <form action={reinstateSeller.bind(null, seller.id)}>
                <button
                  className="rounded-full px-5 py-2 text-sm text-white font-medium"
                  style={{
                    background: "var(--leaf)",
                  }}
                >
                  Reinstate seller
                </button>
              </form>
            )}

            {seller.admin_note && (
              <div
                className="rounded-lg p-3 mt-5 text-sm"
                style={{
                  background: "#f5f5f5",
                }}
              >
                <p className="font-medium">Current admin note</p>

                <p className="mt-1">{seller.admin_note}</p>
              </div>
            )}

            <form
              action={saveAdminSellerNote.bind(null, seller.id)}
              className="mt-5"
            >
              <label className="text-xs font-medium">Internal admin note</label>

              <textarea
                name="note"
                rows={4}
                defaultValue={seller.admin_note ?? ""}
                className="w-full rounded-lg border p-3 text-sm mt-1"
                placeholder="Only Teraa admins see this."
              />

              <button
                type="submit"
                className="rounded-full border px-4 py-2 text-xs font-medium mt-2"
              >
                Save note
              </button>
            </form>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="font-semibold mb-3">Listings</h2>

          {products.length === 0 ? (
            <p className="text-sm text-gray-500">No listings.</p>
          ) : (
            <div className="space-y-2">
              {products.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className="flex justify-between items-center gap-4 rounded-lg border p-3 bg-white"
                >
                  <div>
                    <p className="text-sm font-medium">{product.title}</p>

                    <p className="text-xs text-gray-500">
                      GMD {Number(product.price).toLocaleString()}
                      {" · "}
                      Stock {product.stock_quantity}
                    </p>
                  </div>

                  <span className="text-xs capitalize">
                    {String(product.status).replace("_", " ")}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="mb-8">
          <h2 className="font-semibold mb-3">Recent orders</h2>

          {(orderResult.data ?? []).length === 0 ? (
            <p className="text-sm text-gray-500">No orders.</p>
          ) : (
            <div className="space-y-2">
              {(orderResult.data ?? []).map((order) => (
                <div key={order.id} className="rounded-lg border p-3 bg-white">
                  <p className="text-sm">Order #{order.id.slice(0, 8)}</p>

                  <p className="text-xs text-gray-500">
                    {order.status}
                    {" · "}
                    Payment: {order.payment_status}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="font-semibold mb-3">
            Reports involving seller listings
          </h2>

          {sellerReports.length === 0 ? (
            <p className="text-sm text-gray-500">No reports.</p>
          ) : (
            <div className="space-y-2">
              {sellerReports.map((report) => (
                <Link
                  key={report.id}
                  href="/admin/reports"
                  className="block rounded-lg border p-3 bg-white"
                >
                  <p className="text-sm">{report.reason}</p>

                  <p className="text-xs text-gray-500 capitalize">
                    {report.status}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-xl border bg-white p-4"
      style={{
        borderColor: "var(--sand)",
      }}
    >
      <p className="text-2xl font-bold">{value}</p>

      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}


