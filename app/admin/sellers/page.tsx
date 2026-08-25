import { requireAdmin } from "@/lib/require-admin";
import { SiteHeader } from "@/components/SiteHeader";
import { approveSeller, rejectSeller } from "./actions";

type UserInfo = {
  id: string;
  phone_number: string | null;
  city: string | null;
};

export default async function AdminSellersPage() {
  const { supabase } = await requireAdmin();

  // ---------------------------------------------------------
  // 1. LOAD PENDING SELLERS
  // ---------------------------------------------------------

  const { data: pending, error: pendingError } = await supabase
    .from("sellers")
    .select(
      `
        id,
        business_name,
        id_document_url,
        verification_status,
        created_at
      `,
    )
    .eq("verification_status", "pending")
    .order("created_at", {
      ascending: true,
    });

  if (pendingError) {
    console.error("Could not load pending sellers:", pendingError);
  }

  // ---------------------------------------------------------
  // 2. LOAD MATCHING USER INFORMATION SEPARATELY
  //
  // sellers.id and users.id both use the authenticated user's
  // UUID, so we do not need to rely on Supabase detecting an
  // embedded relationship.
  // ---------------------------------------------------------

  const sellerIds = pending?.map((seller) => seller.id) ?? [];

  let users: UserInfo[] = [];

  if (sellerIds.length > 0) {
    const { data: userRows, error: usersError } = await supabase
      .from("users")
      .select(
        `
          id,
          phone_number,
          city
        `,
      )
      .in("id", sellerIds);

    if (usersError) {
      console.error("Could not load seller user information:", usersError);
    } else {
      users = (userRows ?? []) as UserInfo[];
    }
  }

  // ---------------------------------------------------------
  // 3. LOAD RECENT APPROVAL / REJECTION DECISIONS
  // ---------------------------------------------------------

  const { data: recent, error: recentError } = await supabase
    .from("sellers")
    .select(
      `
        id,
        business_name,
        verification_status,
        created_at
      `,
    )
    .in("verification_status", ["approved", "rejected"])
    .order("created_at", {
      ascending: false,
    })
    .limit(10);

  if (recentError) {
    console.error("Could not load recent seller decisions:", recentError);
  }

  // ---------------------------------------------------------
  // 4. GENERATE TEMPORARY PRIVATE ID DOCUMENT URLS
  // ---------------------------------------------------------

  const sellersWithUrls = await Promise.all(
    (pending ?? []).map(async (seller) => {
      let signedUrl: string | null = null;

      if (seller.id_document_url) {
        const { data, error } = await supabase.storage
          .from("seller-documents")
          .createSignedUrl(seller.id_document_url, 300);

        if (error) {
          console.error(
            `Could not create signed URL for seller ${seller.id}:`,
            error,
          );
        } else {
          signedUrl = data?.signedUrl ?? null;
        }
      }

      const userInfo = users.find((user) => user.id === seller.id) ?? null;

      return {
        ...seller,
        signedUrl,
        userInfo,
      };
    }),
  );

  return (
    <>
      <SiteHeader />

      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="mb-6">
          <p className="text-xs text-gray-500 mb-1">Admin</p>

          <h1
            className="font-display text-2xl mb-1"
            style={{
              color: "var(--ink)",
            }}
          >
            Seller verification
          </h1>

          <p className="text-sm text-gray-500">
            {sellersWithUrls.length} seller
            {sellersWithUrls.length === 1 ? "" : "s"} awaiting review
          </p>
        </div>

        {pendingError && (
          <div
            className="rounded-xl border p-4 mb-5 text-sm"
            style={{
              borderColor: "#e0a0a0",
              background: "#fdf0f0",
              color: "#8c3232",
            }}
          >
            Teraa couldn&apos;t load the seller verification queue. Please try
            again.
          </div>
        )}

        {!pendingError && sellersWithUrls.length === 0 && (
          <div
            className="rounded-xl border p-8 text-center"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <p className="font-medium mb-1">No sellers awaiting review</p>

            <p className="text-sm text-gray-500">
              New verification submissions will appear here.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {sellersWithUrls.map((seller) => (
            <div
              key={seller.id}
              className="rounded-xl border p-4 bg-white"
              style={{
                borderColor: "var(--sand)",
              }}
            >
              <div className="flex gap-4 flex-wrap sm:flex-nowrap">
                {/* ID DOCUMENT */}

                <div className="w-full sm:w-48 shrink-0">
                  {seller.signedUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={seller.signedUrl}
                      alt={`Verification document for ${seller.business_name}`}
                      className="w-full aspect-[4/3] object-cover rounded-lg border"
                      style={{
                        borderColor: "var(--sand)",
                      }}
                    />
                  ) : (
                    <div
                      className="w-full aspect-[4/3] rounded-lg border flex flex-col items-center justify-center text-center px-3"
                      style={{
                        borderColor: "var(--sand)",
                        background: "#fafafa",
                      }}
                    >
                      <p className="text-xs text-gray-500">
                        No document available
                      </p>
                    </div>
                  )}
                </div>

                {/* SELLER DETAILS */}

                <div className="flex-1 min-w-0">
                  <div className="mb-3">
                    <p className="font-semibold">{seller.business_name}</p>

                    {seller.userInfo && (
                      <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                        {seller.userInfo.phone_number && (
                          <p>Phone: {seller.userInfo.phone_number}</p>
                        )}

                        {seller.userInfo.city && (
                          <p>Location: {seller.userInfo.city}</p>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-gray-400 mt-2">
                      Submitted{" "}
                      {new Date(seller.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  {/* STATUS */}

                  <div className="mb-4">
                    <span
                      className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{
                        background: "#fbf3df",
                        color: "var(--gold)",
                      }}
                    >
                      Pending review
                    </span>
                  </div>

                  {/* ACTIONS */}

                  <div className="flex gap-2 flex-wrap">
                    <form action={approveSeller.bind(null, seller.id)}>
                      <button
                        type="submit"
                        className="rounded-full px-5 py-2 text-xs font-medium text-white"
                        style={{
                          background: "var(--leaf)",
                        }}
                      >
                        Approve seller
                      </button>
                    </form>

                    <form action={rejectSeller.bind(null, seller.id)}>
                      <button
                        type="submit"
                        className="rounded-full px-5 py-2 text-xs font-medium border"
                        style={{
                          borderColor: "var(--clay)",
                          color: "var(--clay)",
                        }}
                      >
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* RECENT DECISIONS */}

        {recent && recent.length > 0 && (
          <section className="mt-10">
            <h2 className="font-semibold mb-3">Recent decisions</h2>

            <div
              className="rounded-xl border overflow-hidden bg-white"
              style={{
                borderColor: "var(--sand)",
              }}
            >
              {recent.map((seller) => (
                <div
                  key={seller.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 border-b last:border-b-0"
                  style={{
                    borderColor: "var(--sand)",
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {seller.business_name}
                    </p>

                    <p className="text-xs text-gray-400">
                      {new Date(seller.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <span
                    className="text-xs font-semibold capitalize"
                    style={{
                      color:
                        seller.verification_status === "approved"
                          ? "var(--leaf)"
                          : "var(--clay)",
                    }}
                  >
                    {seller.verification_status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
