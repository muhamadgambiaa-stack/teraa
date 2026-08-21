import { requireAdmin } from "@/lib/require-admin";
import { SiteHeader } from "@/components/SiteHeader";
import { approveSeller, rejectSeller } from "./actions";

export default async function AdminSellersPage() {
  const { supabase } = await requireAdmin();

  const { data: pending } = await supabase
    .from("sellers")
    .select("id, business_name, id_document_url, created_at, users:id(phone_number, city)")
    .eq("verification_status", "pending")
    .order("created_at", { ascending: true });

  const { data: recent } = await supabase
    .from("sellers")
    .select("id, business_name, verification_status")
    .in("verification_status", ["approved", "rejected"])
    .order("created_at", { ascending: false })
    .limit(10);

  // Generate short-lived signed URLs for private ID documents
  const sellersWithUrls = await Promise.all(
    (pending ?? []).map(async (s) => {
      let signedUrl: string | null = null;
      if (s.id_document_url) {
        const { data } = await supabase.storage
          .from("seller-documents")
          .createSignedUrl(s.id_document_url, 300); // 5 min
        signedUrl = data?.signedUrl ?? null;
      }
      return { ...s, signedUrl };
    })
  );

  return (
    <>
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="font-display text-2xl mb-1" style={{ color: "var(--ink)" }}>
          Seller verification
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          {sellersWithUrls.length} seller{sellersWithUrls.length === 1 ? "" : "s"} awaiting review
        </p>

        {sellersWithUrls.length === 0 && (
          <div className="rounded-xl border p-8 text-center text-sm text-gray-500" style={{ borderColor: "var(--sand)" }}>
            No sellers waiting on review right now.
          </div>
        )}

        <div className="space-y-3">
          {sellersWithUrls.map((s) => {
            const userInfo = (s as { users?: { phone_number: string; city: string } | { phone_number: string; city: string }[] }).users;
            const info = Array.isArray(userInfo) ? userInfo[0] : userInfo;

            return (
              <div key={s.id} className="rounded-xl border p-4 bg-white" style={{ borderColor: "var(--sand)" }}>
                <div className="flex gap-4 flex-wrap sm:flex-nowrap">
                  <div className="w-full sm:w-40 shrink-0">
                    {s.signedUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.signedUrl}
                        alt="ID document"
                        className="w-full aspect-[4/3] object-cover rounded-lg border"
                        style={{ borderColor: "var(--sand)" }}
                      />
                    ) : (
                      <div
                        className="w-full aspect-[4/3] rounded-lg border flex items-center justify-center text-xs text-gray-400"
                        style={{ borderColor: "var(--sand)" }}
                      >
                        No document
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{s.business_name}</p>
                    {info && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {info.phone_number} · {info.city}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      Submitted {new Date(s.created_at).toLocaleDateString()}
                    </p>

                    <div className="flex gap-2 mt-3">
                      <form action={approveSeller.bind(null, s.id)}>
                        <button
                          type="submit"
                          className="rounded-full px-4 py-1.5 text-xs font-medium text-white"
                          style={{ background: "var(--leaf)" }}
                        >
                          Approve
                        </button>
                      </form>
                      <form action={rejectSeller.bind(null, s.id)}>
                        <button
                          type="submit"
                          className="rounded-full px-4 py-1.5 text-xs font-medium border"
                          style={{ borderColor: "var(--clay)", color: "var(--clay)" }}
                        >
                          Reject
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {recent && recent.length > 0 && (
          <>
            <h2 className="text-sm font-semibold mt-8 mb-3">Recent decisions</h2>
            <div className="space-y-1.5">
              {recent.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm py-1.5 border-b" style={{ borderColor: "var(--sand)" }}>
                  <span>{s.business_name}</span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: s.verification_status === "approved" ? "var(--leaf)" : "var(--clay)" }}
                  >
                    {s.verification_status}
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
