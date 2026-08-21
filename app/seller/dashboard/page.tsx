import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import { SellerNav } from "@/components/SellerNav";
import { CONDITION_LABELS, type ProductCondition } from "@/types/database";

export default async function SellerDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: seller } = await supabase
    .from("sellers")
    .select("id, business_name, verification_status, id_document_url, rating_avg, total_sales")
    .eq("id", user.id)
    .single();

  if (!seller) redirect("/signup");

  return (
    <>
      <SiteHeader />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="font-display text-2xl" style={{ color: "var(--ink)" }}>
            {seller.business_name}
          </h1>
          {seller.verification_status === "approved" && (
            <Link
              href="/seller/dashboard/new"
              className="rounded-full px-4 py-2 text-white text-sm font-medium"
              style={{ background: "var(--indigo)" }}
            >
              + New listing
            </Link>
          )}
        </div>

        {seller.verification_status === "pending" && (
          <VerificationPending hasDocument={!!seller.id_document_url} />
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
    <div className="rounded-xl border p-6" style={{ borderColor: "var(--gold)", background: "#fbf3df" }}>
      <p className="font-semibold mb-1">
        {hasDocument ? "Your ID is under review" : "Verify your identity to start selling"}
      </p>
      <p className="text-sm text-gray-700 mb-4 max-w-md">
        {hasDocument
          ? "This usually takes less than a day. You'll be able to create listings as soon as you're approved."
          : "Upload a Gambian ID or business registration document. Once approved, your listings go live immediately."}
      </p>
      {!hasDocument && (
        <Link
          href="/seller/dashboard/verify"
          className="inline-block rounded-full px-5 py-2 text-white text-sm font-medium"
          style={{ background: "var(--indigo)" }}
        >
          Upload ID document
        </Link>
      )}
    </div>
  );
}

function VerificationRejected() {
  return (
    <div className="rounded-xl border p-6" style={{ borderColor: "#e0a0a0", background: "#fdf0f0" }}>
      <p className="font-semibold mb-1">Verification wasn&apos;t approved</p>
      <p className="text-sm text-gray-700 mb-4 max-w-md">
        Your submitted document couldn&apos;t be verified. Make sure the photo is clear
        and the details are legible, then try again.
      </p>
      <Link
        href="/seller/dashboard/verify"
        className="inline-block rounded-full px-5 py-2 text-white text-sm font-medium"
        style={{ background: "var(--indigo)" }}
      >
        Resubmit document
      </Link>
    </div>
  );
}

async function SellerListings({ sellerId }: { sellerId: string }) {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, title, price, status, condition, stock_quantity, product_photos(photo_url, is_cover)")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });

  if (!products || products.length === 0) {
    return (
      <div className="rounded-xl border p-10 text-center" style={{ borderColor: "var(--sand)" }}>
        <p className="font-medium mb-1">No listings yet</p>
        <p className="text-sm text-gray-500 mb-4">Create your first listing to start selling on Teraa.</p>
        <Link
          href="/seller/dashboard/new"
          className="inline-block rounded-full px-5 py-2 text-white text-sm font-medium"
          style={{ background: "var(--indigo)" }}
        >
          + New listing
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {products.map((p) => {
        const photos = (p as { product_photos?: { photo_url: string; is_cover: boolean }[] }).product_photos;
        const cover = photos?.find((ph) => ph.is_cover)?.photo_url ?? photos?.[0]?.photo_url;
        return (
          <div
            key={p.id}
            className="flex items-center gap-3 rounded-lg border p-3 bg-white"
            style={{ borderColor: "var(--sand)" }}
          >
            <div className="w-14 h-14 rounded-md shrink-0 overflow-hidden" style={{ background: "var(--sand)" }}>
              {cover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover} alt="" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{p.title}</p>
              <p className="text-xs text-gray-500">
                GMD {Number(p.price).toLocaleString()} · {CONDITION_LABELS[p.condition as ProductCondition]} · Stock: {p.stock_quantity}
              </p>
            </div>
            <StatusPill status={p.status} />
          </div>
        );
      })}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    active: { bg: "#e3f0e8", color: "var(--leaf)", label: "Active" },
    out_of_stock: { bg: "#fbf3df", color: "var(--gold)", label: "Out of stock" },
    hidden: { bg: "#eee", color: "#888", label: "Hidden" },
  };
  const s = styles[status] ?? styles.hidden;
  return (
    <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}
