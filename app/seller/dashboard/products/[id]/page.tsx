import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";

import { hideListing, reactivateListing, updateListing } from "./actions";

export default async function ManageListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/seller/dashboard/products/${id}`);
  }

  const { data: product, error } = await supabase
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
    .eq("id", id)
    .maybeSingle();

  if (error || !product) {
    notFound();
  }

  if (product.seller_id !== user.id) {
    redirect("/seller/dashboard");
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

  const isHidden = product.status === "hidden";
  const isOutOfStock = product.status === "out_of_stock";
  const isAdminHidden = product.status === "admin_hidden";

  return (
    <>
      <SiteHeader />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-start justify-between gap-4 mb-7">
          <div>
            <Link
              href="/seller/dashboard"
              className="text-xs text-gray-500 hover:underline"
            >
              ← Seller dashboard
            </Link>

            <h1
              className="font-display text-3xl mt-2"
              style={{ color: "var(--ink)" }}
            >
              Manage listing
            </h1>

            <p className="text-sm text-gray-500 mt-1">
              Update your product, stock, price or listing visibility.
            </p>
          </div>

          <ListingStatus status={product.status} />
        </div>

        {cover && (
          <div className="mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover}
              alt={product.title}
              className="w-full max-h-72 object-cover rounded-xl border"
              style={{
                borderColor: "var(--sand)",
              }}
            />
          </div>
        )}

        {isAdminHidden && (
          <div
            className="rounded-xl border p-5 mb-6"
            style={{
              borderColor: "var(--clay)",
              background: "#fdf0f0",
            }}
          >
            <p
              className="font-semibold"
              style={{
                color: "var(--clay)",
              }}
            >
              Listing removed by Teraa
            </p>

            <p className="text-sm text-gray-700 mt-2">
              This listing is no longer visible to buyers because it violated or
              may have violated Teraa marketplace policy.
            </p>

            {product.moderation_reason && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase text-gray-500">
                  Reason
                </p>

                <p className="text-sm mt-1">{product.moderation_reason}</p>
              </div>
            )}

            {product.moderated_at && (
              <p className="text-xs text-gray-500 mt-3">
                Removed on {new Date(product.moderated_at).toLocaleDateString()}
              </p>
            )}

            <p className="text-xs text-gray-500 mt-4">
              You may edit the listing to correct the problem, but you cannot
              reactivate it yourself. Only Teraa can restore this listing.
            </p>
          </div>
        )}

        {!isAdminHidden && isOutOfStock && (
          <div
            className="rounded-xl border p-4 mb-6 text-sm"
            style={{
              borderColor: "var(--gold)",
              background: "#fbf3df",
            }}
          >
            <p className="font-semibold mb-1">This product is out of stock</p>

            <p className="text-gray-600">
              Increase the stock quantity below and Teraa will automatically
              make the listing active again.
            </p>
          </div>
        )}

        {!isAdminHidden && isHidden && (
          <div
            className="rounded-xl border p-4 mb-6 text-sm"
            style={{
              borderColor: "var(--sand)",
              background: "#f5f5f5",
            }}
          >
            <p className="font-semibold mb-1">This listing is hidden</p>

            <p className="text-gray-600">
              Buyers cannot see it on the homepage or in search results.
            </p>
          </div>
        )}

        <form
          action={updateListing.bind(null, product.id)}
          className="space-y-5"
        >
          <div>
            <label className="block text-sm font-medium mb-1">
              Product title
            </label>

            <input
              name="title"
              required
              defaultValue={product.title}
              className="w-full rounded-lg border px-3 py-2.5 outline-none"
              style={{
                borderColor: "var(--sand)",
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Description
            </label>

            <textarea
              name="description"
              required
              rows={5}
              defaultValue={product.description ?? ""}
              className="w-full rounded-lg border px-3 py-2.5 outline-none resize-y"
              style={{
                borderColor: "var(--sand)",
              }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Price (GMD)
              </label>

              <input
                name="price"
                type="number"
                required
                min="1"
                step="0.01"
                defaultValue={Number(product.price)}
                className="w-full rounded-lg border px-3 py-2.5 outline-none"
                style={{
                  borderColor: "var(--sand)",
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Stock quantity
              </label>

              <input
                name="stock_quantity"
                type="number"
                required
                min="0"
                step="1"
                defaultValue={product.stock_quantity}
                className="w-full rounded-lg border px-3 py-2.5 outline-none"
                style={{
                  borderColor: "var(--sand)",
                }}
              />

              {product.stock_quantity === 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Increase this number to restock the product.
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Condition</label>

            <select
              name="condition"
              defaultValue={product.condition}
              className="w-full rounded-lg border px-3 py-2.5 outline-none bg-white"
              style={{
                borderColor: "var(--sand)",
              }}
            >
              <option value="new">Brand new</option>
              <option value="used">Used</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Location</label>

            <input
              name="location_city"
              required
              defaultValue={product.location_city}
              placeholder="Banjul, Serrekunda, Brikama..."
              className="w-full rounded-lg border px-3 py-2.5 outline-none"
              style={{
                borderColor: "var(--sand)",
              }}
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-full py-3 text-white font-medium"
            style={{
              background: "var(--indigo)",
            }}
          >
            Save changes
          </button>
        </form>

        <div
          className="border-t mt-8 pt-6"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          <h2 className="font-semibold mb-2">Listing visibility</h2>

          {isAdminHidden ? (
            <div
              className="rounded-lg border p-4 text-sm"
              style={{
                borderColor: "var(--clay)",
                background: "#fdf0f0",
              }}
            >
              <p className="font-medium">
                This listing cannot be reactivated by the seller.
              </p>

              <p className="text-gray-600 mt-1">
                Teraa must review and restore the listing.
              </p>
            </div>
          ) : !isHidden ? (
            <>
              <p className="text-sm text-gray-500 mb-4">
                Hiding a listing removes it from the marketplace without
                deleting its order history.
              </p>

              <form action={hideListing.bind(null, product.id)}>
                <button
                  type="submit"
                  className="rounded-full border px-5 py-2 text-sm font-medium"
                  style={{
                    borderColor: "var(--clay)",
                    color: "var(--clay)",
                  }}
                >
                  Hide listing
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-4">
                This listing was hidden by you. You can make it available again
                whenever you want.
              </p>

              <form action={reactivateListing.bind(null, product.id)}>
                <button
                  type="submit"
                  className="rounded-full px-5 py-2 text-white text-sm font-medium"
                  style={{
                    background: "var(--leaf)",
                  }}
                >
                  Reactivate listing
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </>
  );
}

function ListingStatus({ status }: { status: string }) {
  const styles: Record<
    string,
    {
      label: string;
      bg: string;
      color: string;
    }
  > = {
    active: {
      label: "Active",
      bg: "#e3f0e8",
      color: "var(--leaf)",
    },

    out_of_stock: {
      label: "Out of stock",
      bg: "#fbf3df",
      color: "var(--gold)",
    },

    hidden: {
      label: "Hidden",
      bg: "#eeeeee",
      color: "#666",
    },

    admin_hidden: {
      label: "Removed by Teraa",
      bg: "#fdf0f0",
      color: "var(--clay)",
    },
  };

  const style = styles[status] ?? styles.hidden;

  return (
    <span
      className="rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap"
      style={{
        background: style.bg,
        color: style.color,
      }}
    >
      {style.label}
    </span>
  );
}
